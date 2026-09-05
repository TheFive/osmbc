// Local, disposable bookkeeping for the Blog-Sync-Merger: remembers which
// remote id a previous --commit run created for each local article id, per
// blog, so a later run can recognize it again instead of duplicating it
// (see blogSyncMerger.planArticleMerge).
//
// Deliberately never written into the target/remote data itself. This
// whole tool exists for a specific, one-off integration project tied to a
// specific local snapshot (e.g. `osmbc_prod_copie`) that gets deleted once
// the project is done - a marker field on the article would linger in real
// production data forever, meaningless to anyone once its local
// counterpart is gone, and would carry no benefit for a *different*
// integration that happens to touch the same articles later. This file -
// gitignored, sitting right next to the rest of this one-off tool - is
// meant to be deleted right along with it.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, ".sync-state.json");

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

// Returns a Map(localId -> remoteId), both as strings, of everything
// previously recorded as created for this blog - the shape
// blogSyncMerger.planArticleMerge's `knownRemoteIds` parameter expects.
export function loadKnownRemoteIds(blogName) {
  const forBlog = readState()[blogName] || {};
  return new Map(Object.entries(forBlog));
}

// Merges newly-created { localId, id } pairs (as returned in
// applyResult.created, see routes/api.js doCreates) into the persisted
// state for this blog. A no-op if nothing was created this run.
export function recordCreated(blogName, created) {
  if (!Array.isArray(created) || created.length === 0) return;
  const state = readState();
  if (!state[blogName]) state[blogName] = {};
  for (const { localId, id } of created) {
    state[blogName][String(localId)] = String(id);
  }
  writeState(state);
}

// Old-era "replace" mode (syncBlog.js runReplace) is not idempotent by
// id-matching: a completed replace leaves the remote article ids unrelated
// to the local ones, so the 0-shared-ids auto-detect would say "replace"
// again on a re-run and trash+recreate the whole blog a second time. This
// marker - under a reserved top-level key that can never collide with a
// "WN..." blog name - is what lets a re-run short-circuit instead. Kept
// here (local, disposable) for the same reason as the id map above: nothing
// about this one-off migration belongs in the target's own data.
const REPLACED_KEY = "__replaced__";

export function isReplaced(blogName) {
  const replaced = readState()[REPLACED_KEY] || {};
  return Boolean(replaced[blogName]);
}

export function markReplaced(blogName, created) {
  const state = readState();
  if (!state[REPLACED_KEY]) state[REPLACED_KEY] = {};
  state[REPLACED_KEY][blogName] = {
    at: new Date().toISOString(),
    created: Array.isArray(created)
      ? created.map(({ localId, id }) => ({ localId: String(localId), id: String(id) }))
      : []
  };
  writeState(state);
}

// The remote ids a replace run created for this blog (used by
// rollback.js rollbackReplace to know which articles to trash back out).
export function loadReplacedCreatedIds(blogName) {
  const entry = (readState()[REPLACED_KEY] || {})[blogName];
  if (!entry || !Array.isArray(entry.created)) return [];
  return entry.created.map((c) => c.id);
}

export default { loadKnownRemoteIds, recordCreated, isReplaced, markReplaced, loadReplacedCreatedIds };
