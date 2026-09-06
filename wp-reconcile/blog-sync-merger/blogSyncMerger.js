// Blog-Sync-Merger: pure planning logic.
//
// Given a local (source-of-truth) blog+articles and the current remote
// (production) blog+articles for the same WN issue, computes what would
// need to change on the remote side - without performing any I/O itself.
// Keeping this side-effect free makes the actual merge decision fully
// unit-testable; routes/api.js is the only place that talks to the
// database, and merger/rollback.js the only place that reverts one.
//
// See CLAUDE.local.md (osmbc-develop worktree) for the full design
// discussion this implements, in particular:
// - ID matching is primarily done by `id` alone. That is only valid
//   because the local test/working DB is (or descends from) a literal
//   snapshot copy of the real production database - callers are
//   responsible for having verified that assumption before relying on
//   this, it is not re-checked here. For an article this same tool already
//   created on an earlier run (whose remote id is necessarily unrelated to
//   its local id), the caller-supplied `knownRemoteIds` map (see
//   planArticleMerge, syncState.js) covers the gap instead - deliberately
//   kept out of the remote's own data, see planArticleMerge for why.
// - predecessorId is an intra-category sort chain per blog, not a
//   translation link - remapPredecessorIds() exists because a
//   newly-created article's real id is only known after it has actually
//   been created remotely (bigserial), so a two-phase create-then-patch
//   is required whenever two new articles reference each other.

const WN_NUMBER_RE = /^WN(\d+)$/i;

// Fields carried unconditionally in addition to whatever language-specific
// markdown fields the caller passes in trackedFields (e.g. "markdownDE").
//
// unpublishReason: found missing via a real WN275 dry/commit run (see
// CLAUDE.local.md) - Article.prototype.setAndSave (model/article.js)
// refuses to set categoryEN to "--unpublished--" (or blog to "Trash")
// unless the write carries a non-empty unpublishReason (or the article
// already has one). Without this field tracked, a genuine local
// unpublish-correction (categoryEN diff alone) is rejected by that guard
// as "Missing reason for unpublishing article." - not a data-loss risk
// (the patch is cleanly refused, reported in the caller's `errors`), but
// the correction never lands. Treated as informational/read-only content
// (never independently reconciled against a differing remote value the
// way, say, a real editor's own unpublish note might be) - the local
// side's value is simply carried along whenever it has one, same as any
// other tracked field.
export const BASE_TRACKED_FIELDS = ["categoryEN", "predecessorId", "title", "unpublishReason"];

export function extractBlogNumber(name) {
  if (typeof name !== "string") return null;
  const match = name.match(WN_NUMBER_RE);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

// Safety net (a): only ever touch blogs that are closed and at or below a
// caller-given WN number ceiling - never the blog(s) currently being
// worked on live. Returns { eligible: true } or { eligible: false, reason }.
export function checkBlogEligibility(remoteBlog, { maxBlogNumber } = {}) {
  if (!remoteBlog) return { eligible: false, reason: "Remote blog does not exist" };
  const number = extractBlogNumber(remoteBlog.name);
  if (number === null) {
    return { eligible: false, reason: `Blog name "${remoteBlog.name}" is not a WN issue, refusing to sync` };
  }
  if (typeof maxBlogNumber === "number" && number > maxBlogNumber) {
    return { eligible: false, reason: `Blog number ${number} is above maxBlogNumber ${maxBlogNumber} (too recent/still active)` };
  }
  if (remoteBlog.status !== "closed") {
    return { eligible: false, reason: `Blog status is "${remoteBlog.status}", only "closed" blogs are eligible for sync` };
  }
  return { eligible: true };
}

// Matches Article.prototype.setAndSave's own \r\n normalisation
// (model/article.js) so a plan never flags a Windows/Unix line-ending
// difference as a real content change.
function normalize(value) {
  return (typeof value === "string") ? value.replace(/\r\n/g, "\n") : value;
}

function fieldsEqual(a, b) {
  return normalize(a) === normalize(b);
}

// Computes the set of tracked fields that differ between a local article
// and its matched remote counterpart. Returns null if nothing differs.
// Exported (not just used internally for article/blogPatch diffing) so
// routes/api.js can reuse it to diff close<LANG> flags directly against
// the blog's *live* state at write time - see withReopenedBlog.js for why
// that one specifically is never trusted from a client-precomputed value.
export function diffFields(localArticle, remoteArticle, trackedFields) {
  const changes = {};
  const old = {};
  for (const field of trackedFields) {
    const localValue = localArticle[field];
    // A field the local side has no opinion on (undefined) is never
    // pushed - it must not be mistaken for "clear this field".
    if (typeof localValue === "undefined") continue;
    const remoteValue = remoteArticle[field];
    if (fieldsEqual(localValue, remoteValue)) continue;
    changes[field] = localValue;
    old[field] = remoteValue;
  }
  if (Object.keys(changes).length === 0) return null;
  return { changes, old };
}

// Like diffFields but SETS every field where local has a value, even one
// that looks equal to remote's. planReplace uses this (not diffFields) for
// blog-level fields because it is a WHOLESALE replace, and because the read
// endpoint serializes an unset remote field as "" (setAndSave's old-value
// sentinel) - so diffFields can't tell "remote already has ''" from
// "remote has nothing", which for teamString<LANG> renders differently
// (model/blog.js createTeamString: "" suppresses the auto-from-changelog
// credit, unset triggers it - garbage "erstellt von ." for a rebuilt
// old-era blog whose only editors are synthetic). setAndSave still drops a
// genuine no-op (value === self[key]), so re-runs stay quiet.
export function forceSetFields(localObj, remoteObj, trackedFields) {
  const changes = {};
  const old = {};
  for (const field of trackedFields) {
    const localValue = localObj[field];
    if (typeof localValue === "undefined") continue;
    changes[field] = localValue;
    old[field] = remoteObj[field];
  }
  if (Object.keys(changes).length === 0) return null;
  return { changes, old };
}

// Matches local and remote articles for one blog and produces a merge
// plan: articles missing remotely (toCreate), articles present on both
// sides with at least one tracked-field difference (toPatch, already
// carrying the `old` values needed for setAndSave's optimistic-concurrency
// check), articles present on both sides with no difference (unchanged),
// and articles that only exist remotely (remoteOnly - created by a real
// editor after the local snapshot was taken; must be left untouched, but
// are surfaced here because their presence in a shared category can affect
// predecessorId ordering for anything this plan does touch).
//
// Matching is by `id`, OR - for an article this same tool already created
// on a previous run - by a locally-remembered id mapping the CALLER passes
// in as `knownRemoteIds` (a Map: local id -> remote id). Found the hard
// way: running the same blog through the merger twice duplicated every
// article the first run had created, because a newly-created remote
// article gets its own bigserial id, permanently unrelated to the local id
// it came from - re-running never found "local id 47680" in the remote
// list again, so it created it a second time.
//
// Deliberately NOT solved by writing a marker field onto the remote
// article itself: this is a one-off migration-tool concern tied to a
// specific local snapshot (e.g. `osmbc_prod_copie`) that gets deleted once
// the project is done - a field like that would linger in real production
// data forever, meaningless to anyone once its local counterpart is gone,
// and useless for a *different* integration that happens to touch the same
// articles later. The mapping lives entirely on the caller's side instead
// (see syncState.js) - nothing is ever written to the target for this.
export function planArticleMerge(localArticles, remoteArticles, trackedFields, knownRemoteIds = new Map()) {
  const remoteById = new Map(remoteArticles.map((a) => [a.id, a]));
  function findRemoteMatch(localId) {
    if (remoteById.has(localId)) return remoteById.get(localId);
    // knownRemoteIds (syncState.js) always stores/looks up by string -
    // Postgres bigint ids can come back as either a JS number or a
    // numeric string depending on the driver, and this map survives a
    // JSON round-trip to disk between runs, so its keys can't be assumed
    // to match remoteById's key type without normalizing both sides.
    const knownRemoteId = knownRemoteIds.get(String(localId));
    if (typeof knownRemoteId === "undefined") return undefined;
    return remoteById.get(knownRemoteId) || remoteById.get(Number(knownRemoteId));
  }

  // Any local id that already has a remote counterpart maps to that
  // remote's real id - used to translate predecessorId references before
  // comparing/patching, since a local predecessorId pointing at an
  // already-migrated article is expressed in *local* id space and must
  // never be written as-is onto a remote article's own predecessorId
  // field (the same bug as above, one level removed: a stale local id
  // silently corrupting an already-correct remote sort chain instead of
  // just duplicating an article).
  const localIdToRemoteId = new Map();
  for (const local of localArticles) {
    const remote = findRemoteMatch(local.id);
    if (remote) localIdToRemoteId.set(local.id, remote.id);
  }
  const remappedLocalArticles = remapPredecessorIds(localArticles, localIdToRemoteId);

  const toCreate = [];
  const toPatch = [];
  const unchanged = [];
  const matchedRemoteIds = new Set();

  for (const local of remappedLocalArticles) {
    const remote = findRemoteMatch(local.id);
    if (!remote) {
      toCreate.push(local);
      continue;
    }
    matchedRemoteIds.add(remote.id);
    const diff = diffFields(local, remote, trackedFields);
    if (!diff) {
      unchanged.push({ id: remote.id });
      continue;
    }
    // remote.id, not local.id: once knownRemoteIds matching kicks in the
    // two can differ, and remote.id is the only one that's ever a valid
    // target for a PATCH against the remote instance.
    toPatch.push({ id: remote.id, changes: diff.changes, old: diff.old });
  }

  const remoteOnly = remoteArticles
    .filter((remote) => !matchedRemoteIds.has(remote.id))
    .map((remote) => ({ id: remote.id, categoryEN: remote.categoryEN, title: remote.title }));

  return { toCreate, toPatch, unchanged, remoteOnly };
}

// After phase-1 creation, `createdIdMap` maps a local-only article's local
// id -> the id the remote side actually assigned it. This remaps any
// predecessorId in `articles` that pointed at one of those local-only ids
// to the real remote id, so phase-2 patching sends a valid reference.
// predecessorId values that already point at a shared (pre-existing) id,
// or are unset, are left untouched.
export function remapPredecessorIds(articles, createdIdMap) {
  return articles.map((article) => {
    if (!article.predecessorId) return article;
    if (!createdIdMap.has(article.predecessorId)) return article;
    return { ...article, predecessorId: createdIdMap.get(article.predecessorId) };
  });
}

// Shared serialization for a set of tracked fields, used by the read
// endpoint (routes/api.js) to turn a live model instance (Article or Blog)
// into a JSON-safe plain object for the wire. An unset field is coerced to
// "" rather than left `undefined`: JSON.stringify silently drops
// `undefined`-valued keys, and "" is the sentinel setAndSave's own
// optimistic-concurrency check (model/article.js) already treats as
// "caller correctly believes there is no prior value".
//
// Only ever used for the REMOTE side (going out over HTTP as JSON) or the
// read endpoint's own response - never for the orchestrator's LOCAL side,
// which must keep genuine `undefined` meaning "local has no opinion on
// this field, don't touch remote's value" (see diffFields/planMerge).
export function serializeFieldsForSync(object, trackedFields) {
  const result = {};
  for (const field of trackedFields) {
    const value = object[field];
    result[field] = (typeof value === "undefined") ? "" : value;
  }
  return result;
}

export function serializeArticleForSync(article, trackedFields) {
  return { id: article.id, ...serializeFieldsForSync(article, trackedFields) };
}

// A blog category is either a plain string, or (as actually stored in
// production) a per-language label object like { EN: "Mapping", DE:
// "Mapping", FR: "Cartographie", ... }. Its identity for matching purposes
// is the "EN" label - the same canonical key `article.categoryEN` already
// uses everywhere else in this codebase - never a deep/structural
// comparison of the whole object: jsonb does not guarantee stable key
// order, so two DB copies of the exact same category can serialize with
// different key order and must still compare as identical.
function categoryIdentity(category) {
  if (category && typeof category === "object") return category.EN;
  return category;
}

// Deep-equal for one category entry, ignoring jsonb key order (see
// categoryIdentity above for the same rationale) - unlike categoryIdentity,
// this compares the FULL translation content, not just the EN label, so it
// catches a category that exists on both sides but whose translated text
// has drifted (found via a real Hugo-export diff across 100 blogs, see
// CLAUDE.local.md: e.g. a stale/never-translated "Programming" where the
// corrected local copy already has "Programování").
function categoriesEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return a === b;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

// Is `oldSeq` an (order-preserving, not necessarily contiguous) subsequence
// of `newSeq`? True exactly when `newSeq` could have been produced from
// `oldSeq` by only ever *inserting* new items - never removing or
// reordering one that was already there.
function isSubsequence(oldSeq, newSeq) {
  let i = 0;
  for (const item of newSeq) {
    if (i < oldSeq.length && item === oldSeq[i]) i++;
  }
  return i === oldSeq.length;
}

// Plans what to do about a blog's `categories` array - deliberately its
// own function, not folded into the generic per-scalar-field diffFields:
// the array's *order* is itself meaningful (drives heading order and the
// lead-picture caption position, see CLAUDE.md) and jsonb doesn't
// guarantee stable key order within an entry, so this needs its own
// identity- and content-aware comparison.
//
// - "none": already identical (by content, ignoring key order) - nothing
//   to do.
// - "replace": every category that existed remotely still exists locally,
//   in the same relative order (remote is an ordered subsequence of
//   local) - i.e. local only ever *added* categories (or corrected some of
//   their translation text) since the shared snapshot. Safe to replace the
//   whole array wholesale with local's, since local's order already
//   equals "remote's order + insertions" by construction.
// - "review": something more than pure insertion happened (a category was
//   removed, or the relative order of existing ones changed) - never
//   auto-applied, needs a human to look at the two arrays individually.
export function planCategoriesMerge(localCategories, remoteCategories) {
  const local = Array.isArray(localCategories) ? localCategories : [];
  const remote = Array.isArray(remoteCategories) ? remoteCategories : [];

  const localIds = local.map(categoryIdentity);
  const remoteIds = remote.map(categoryIdentity);

  // localCategories/remoteCategories are always present, regardless of
  // action - buildApplyBody (syncBlog.js) relies on localCategories being
  // there unconditionally to build the apply request body.
  if (!isSubsequence(remoteIds, localIds)) {
    return { action: "review", localCategories: local, remoteCategories: remote };
  }

  const identical = local.length === remote.length && local.every((c, i) => categoriesEqual(c, remote[i]));
  if (identical) return { action: "none", localCategories: local, remoteCategories: remote };

  return { action: "replace", localCategories: local, remoteCategories: remote, categories: local, old: remote };
}

// Full plan for one blog: eligibility check, article-level diff, a
// blog-level field diff, `missingCategories` (a plain informational list,
// kept for backward-compat/display), and `categoriesPlan` - the actionable
// decision of whether the whole `categories` array can be safely replaced
// (see planCategoriesMerge). Pure/side-effect free - safe to call
// repeatedly for a dry-run preview.
//
// trackedBlogFields: blog-level fields to diff/patch, e.g.
//   ["teamStringDE", "teamStringEN", ...] - deliberately opt-in and
//   separate from article trackedFields; categories/status are handled
//   via eligibility/missingCategories above, never via this generic diff.
//
// trackedCloseFields: close<LANG> flags to sync (e.g. ["closeDE", ...]) -
// deliberately kept separate from trackedBlogFields even though it's the
// exact same diffFields mechanism: render/Renderer.js skips a language's
// content entirely unless close<LANG> is true, found via a real
// Hugo-export diff (see CLAUDE.local.md) - but unlike teamString, this
// can never be applied at the *start* of a write batch (would lock this
// same batch's own markdown<LANG> patches for that language, see
// withReopenedBlog.js) - routes/api.js applies it as a `withReopenedBlog`
// restoreOverride instead, after all article patches have already run.
// Deliberately excludes exported<LANG> - that's export-delivery
// bookkeeping (see notification/exportReceiver.js), not a rendering gate,
// and syncing it could make a real delivery pipeline think a blog needs
// re-exporting when it doesn't.
export function planMerge({ localBlog, localArticles, remoteBlog, remoteArticles, trackedFields, trackedBlogFields = [], trackedCloseFields = [], maxBlogNumber, knownRemoteIds }) {
  const eligibility = checkBlogEligibility(remoteBlog, { maxBlogNumber });
  if (!eligibility.eligible) {
    return { eligible: false, reason: eligibility.reason, toCreate: [], toPatch: [], unchanged: [], remoteOnly: [], missingCategories: [], blogPatch: null, closeFlagsPatch: null, localCloseFlags: {}, categoriesPlan: { action: "none" } };
  }
  const articlePlan = planArticleMerge(localArticles, remoteArticles, trackedFields, knownRemoteIds);
  const localCategories = Array.isArray(localBlog && localBlog.categories) ? localBlog.categories : [];
  const remoteCategories = Array.isArray(remoteBlog && remoteBlog.categories) ? remoteBlog.categories : [];
  const remoteCategoryIds = new Set(remoteCategories.map(categoryIdentity));
  const missingCategories = localCategories.filter((c) => !remoteCategoryIds.has(categoryIdentity(c)));
  const categoriesPlan = planCategoriesMerge(localCategories, remoteCategories);
  // teamString<LANG> is deliberately REPLACE-mode only (see planReplace /
  // routes/api.js getSyncTrackedBlogFields): its old-era values in
  // osmbc_prod_copie are curated (setLegacyTeamStrings/clearTeamStrings),
  // but a merge-era blog on the remote may carry a fresher teamString than
  // this possibly-staler local snapshot - never reconcile it here.
  const mergeBlogFields = trackedBlogFields.filter((f) => !/^teamString/.test(f));
  const blogPatch = diffFields(localBlog || {}, remoteBlog || {}, mergeBlogFields);
  const closeFlagsPatch = diffFields(localBlog || {}, remoteBlog || {}, trackedCloseFields);
  // The full local snapshot (not just the diff) - like planCategoriesMerge's
  // localCategories, this is what syncBlog.js actually sends: the write
  // endpoint always recomputes the diff itself against live state, never
  // trusting a client-precomputed one for this field.
  const localCloseFlags = {};
  for (const field of trackedCloseFields) {
    if (localBlog && typeof localBlog[field] !== "undefined") localCloseFlags[field] = localBlog[field];
  }
  return { eligible: true, blog: remoteBlog.name, missingCategories, categoriesPlan, blogPatch, closeFlagsPatch, localCloseFlags, ...articlePlan };
}

// Old-era "replace" plan (WN001–WN271). The local side rebuilt these blogs
// from scratch: `wp-oldimport` moved every original article to
// `blog:"Trash"` and recreated fresh bigserial ids, so there are ZERO
// shared article ids between the two instances. planArticleMerge/id-matching
// would then classify every remote original as `remoteOnly` (left in place)
// and every local article as `toCreate` - producing a full DUPLICATE set
// instead of a merge (found the hard way by a real full-range run, see
// CLAUDE.local.md). This plan does the only correct thing for that case:
// trash every remote article, recreate every local one, and replace the
// blog's `categories` wholesale (no subsequence check - the old era is a
// clean replace, never a pure insertion).
//
// Replace-vs-merge is decided by the caller (syncBlog.js) on the
// 0-shared-ids test; the write endpoint (routes/api.js) independently
// refuses replace mode for any blog above a configured WN ceiling (default
// 271) as a backstop, exactly the way it re-checks `maxBlogNumber`.
export function planReplace({ localBlog, localArticles, remoteBlog, remoteArticles, trackedBlogFields = [], trackedCloseFields = [], maxBlogNumber }) {
  const eligibility = checkBlogEligibility(remoteBlog, { maxBlogNumber });
  if (!eligibility.eligible) {
    return { eligible: false, reason: eligibility.reason, mode: "replace", toTrash: [], toCreate: [], toPatch: [], unchanged: [], remoteOnly: [], missingCategories: [], blogPatch: null, closeFlagsPatch: null, localCloseFlags: {}, categoriesPlan: { action: "none" } };
  }
  const localCategories = Array.isArray(localBlog && localBlog.categories) ? localBlog.categories : [];
  const remoteCategories = Array.isArray(remoteBlog && remoteBlog.categories) ? remoteBlog.categories : [];
  // forceSetFields, not diffFields: a wholesale replace SETS blog-level
  // fields to local's values (see forceSetFields for the teamString<LANG>
  // "" vs unset reason). Dates ride along too - harmless, setAndSave drops
  // the no-op on a re-run.
  const blogPatch = forceSetFields(localBlog || {}, remoteBlog || {}, trackedBlogFields);
  const closeFlagsPatch = diffFields(localBlog || {}, remoteBlog || {}, trackedCloseFields);
  const localCloseFlags = {};
  for (const field of trackedCloseFields) {
    if (localBlog && typeof localBlog[field] !== "undefined") localCloseFlags[field] = localBlog[field];
  }
  return {
    eligible: true,
    mode: "replace",
    blog: remoteBlog.name,
    // every remote article (server re-reads the live list itself; this is
    // for the CLI's dry-run display only)
    toTrash: remoteArticles.map((a) => ({ id: a.id, categoryEN: a.categoryEN, title: a.title })),
    // every local article - carries its local id (buildApplyBody turns that
    // into `localId`), predecessorId left intact for the apply endpoint's
    // existing two-phase remap (a local predecessorId chain among articles
    // that are ALL being created is exactly what that pass handles)
    toCreate: localArticles.map((a) => ({ ...a })),
    toPatch: [],
    unchanged: [],
    remoteOnly: [],
    missingCategories: [],
    categoriesPlan: { action: "replace", localCategories, categories: localCategories, old: remoteCategories, remoteCategories },
    blogPatch,
    closeFlagsPatch,
    localCloseFlags
  };
}

export default {
  BASE_TRACKED_FIELDS,
  extractBlogNumber,
  checkBlogEligibility,
  diffFields,
  forceSetFields,
  serializeFieldsForSync,
  serializeArticleForSync,
  planArticleMerge,
  planCategoriesMerge,
  remapPredecessorIds,
  planMerge,
  planReplace
};
