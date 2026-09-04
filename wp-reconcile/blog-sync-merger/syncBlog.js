#!/usr/bin/env node
// Blog-Sync-Merger orchestrator - the missing "glue" between
// blogSyncMerger.js (pure planning) and the GET/POST /api/blogSync/...
// endpoints in routes/api.js (see CLAUDE.local.md, Phase 4 checklist).
//
// Reads one blog + its articles directly from the LOCAL OSMBC database
// (whatever this process's config.<env>.yaml / config.<branch>.yaml
// points at), downloads the same blog from a REMOTE OSMBC instance's
// blogSync API, computes a merge plan locally, and - only with --commit -
// posts that plan to the remote's apply endpoint.
//
// Dry-run by default (matches the wp-reconcile convention: safe to run
// repeatedly, nothing is written anywhere until --commit is given). Even
// in dry-run mode, the remote is asked to confirm eligibility (its own
// dryRun=true response) so a maxBlogNumber/status rejection is caught
// before anyone tries --commit for real.
//
// Usage:
//   node wp-reconcile/blog-sync-merger/syncBlog.js WN300 \
//     --remote-url https://osmbc.example.com --api-key <key> \
//     --max-blog-number 500 [--commit]
//
// Add --insecure only when --remote-url points at a local dev server with
// a self-signed cert (e.g. https://localhost:3002) - never for a real
// remote, it disables TLS certificate verification.

import { program } from "commander";
import axios from "axios";
import https from "https";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";

import blogSyncMerger from "./blogSyncMerger.js";
import syncState from "./syncState.js";

function stripTrailingSlash(url) {
  return url.replace(/\/$/, "");
}

// Downloads one blog + its articles from a remote OSMBC instance's
// GET /api/blogSync/:apiKey/:blog_id endpoint. `httpsAgent` is only ever
// non-default for local smoke-testing against a self-signed dev cert
// (--insecure on the CLI) - never used for a real remote.
export async function fetchRemoteBlog(remoteUrl, apiKey, blogName, httpsAgent) {
  const url = `${stripTrailingSlash(remoteUrl)}/api/blogSync/${apiKey}/${encodeURIComponent(blogName)}`;
  const response = await axios.get(url, { validateStatus: () => true, httpsAgent });
  if (response.status !== 200) {
    throw new Error(`GET ${url} -> HTTP ${response.status}: ${typeof response.data === "string" ? response.data : JSON.stringify(response.data)}`);
  }
  return response.data;
}

// Posts a plan to a remote OSMBC instance's
// POST /api/blogSync/:apiKey/:blog_id/apply endpoint. See fetchRemoteBlog
// for `httpsAgent`.
export async function applyRemote(remoteUrl, apiKey, blogName, body, httpsAgent) {
  const url = `${stripTrailingSlash(remoteUrl)}/api/blogSync/${apiKey}/${encodeURIComponent(blogName)}/apply`;
  const response = await axios.post(url, body, { validateStatus: () => true, httpsAgent });
  if (response.status !== 200) {
    throw new Error(`POST ${url} -> HTTP ${response.status}: ${typeof response.data === "string" ? response.data : JSON.stringify(response.data)}`);
  }
  return response.data;
}

// Turns a merge plan into the request body the apply endpoint expects.
// `toPatch` entries already have exactly the required { id, changes, old }
// shape (see blogSyncMerger.planArticleMerge) - passed straight through.
// `toCreate` entries carry every tracked field including `id` (the LOCAL
// id) - that becomes `localId`, and `predecessorId` is passed through
// as-is: if it still points at another `toCreate` entry's local id, the
// apply endpoint's own createdIdMap remaps it once that article is
// actually created (see routes/api.js doPredecessorPatchForCreated); if it
// already points at a pre-existing shared id, no remap is needed.
export function buildApplyBody(plan, maxBlogNumber, dryRun) {
  const creates = plan.toCreate.map((article) => {
    const fields = {};
    for (const key of Object.keys(article)) {
      if (key === "id") continue; // identifies the local article for this batch (-> localId below), not a field to create
      fields[key] = article[key];
    }
    return { localId: article.id, fields };
  });
  const patches = plan.toPatch.map((item) => ({ id: item.id, changes: item.changes, old: item.old }));
  const body = { maxBlogNumber, dryRun, creates, patches };
  if (plan.blogPatch) body.blogPatch = plan.blogPatch;
  // The actual "replace or not" decision is always re-made server-side
  // against the blog's live categories (see routes/api.js applyBlogSync) -
  // this only ever needs to carry the raw local array. Sent whenever we
  // have one at all, even for a "review"/"none" categoriesPlan: the server
  // recomputes independently, so there's no harm (and no benefit) in
  // filtering client-side first.
  if (plan.categoriesPlan && plan.categoriesPlan.localCategories) {
    body.categories = plan.categoriesPlan.localCategories;
  }
  return body;
}

// Core orchestration, side-effect free w.r.t. the local DB (read-only) and
// only writes remotely when `commit` is true. Exported (rather than only
// reachable via the CLI) so tests can drive it directly against a mocked
// remote (see test/wp-reconcile.syncBlog.test.js) without spawning a
// subprocess.
export async function runSync({ blogName, remoteUrl, apiKey, maxBlogNumber, commit, httpsAgent }) {
  const localBlog = await blogModule.findOne({ name: blogName });
  if (!localBlog) throw new Error(`Local blog ${blogName} not found`);
  const localArticlesRaw = await articleModule.find({ blog: blogName });

  const remoteData = await fetchRemoteBlog(remoteUrl, apiKey, blogName, httpsAgent);
  const trackedFields = remoteData.trackedFields;
  const trackedBlogFields = remoteData.trackedBlogFields || [];
  const localArticles = localArticlesRaw.map((a) => blogSyncMerger.serializeArticleForSync(a, trackedFields));

  // Which local ids this tool already migrated to which remote ids on an
  // earlier run - see syncState.js for why this lives in a local file
  // instead of on the remote data itself.
  const knownRemoteIds = syncState.loadKnownRemoteIds(blogName);

  // localBlog is passed as the live model instance, NOT pre-serialized:
  // an unset field here must stay genuinely `undefined` (planMerge's
  // diffFields skips it, meaning "local has no opinion, don't touch
  // remote's value") - unlike the remote side, which only ever exists as
  // already-JSON-serialized data (see blogSyncMerger.serializeFieldsForSync
  // for why "" is the right sentinel *there*, not here).
  const plan = blogSyncMerger.planMerge({
    localBlog,
    localArticles,
    remoteBlog: remoteData.blog,
    remoteArticles: remoteData.articles,
    trackedFields,
    trackedBlogFields,
    maxBlogNumber,
    knownRemoteIds
  });

  if (!plan.eligible) {
    return { plan, applyResult: null };
  }

  const body = buildApplyBody(plan, maxBlogNumber, !commit);
  const applyResult = await applyRemote(remoteUrl, apiKey, blogName, body, httpsAgent);
  if (commit) syncState.recordCreated(blogName, applyResult.created);
  return { plan, applyResult };
}

function summarizePlan(plan) {
  return {
    eligible: plan.eligible,
    reason: plan.reason,
    toCreate: plan.toCreate.length,
    toPatch: plan.toPatch.length,
    unchanged: plan.unchanged.length,
    remoteOnly: plan.remoteOnly.length,
    missingCategories: plan.missingCategories,
    categoriesAction: plan.categoriesPlan ? plan.categoriesPlan.action : "none",
    blogPatch: plan.blogPatch ? plan.blogPatch.changes : null
  };
}

async function main() {
  program
    .argument("<blogName>", "WN issue to sync, e.g. WN300")
    .requiredOption("--remote-url <url>", "Base URL of the target OSMBC instance, e.g. https://osmbc.example.com")
    .requiredOption("--api-key <key>", "API key for the remote instance's blogSync endpoint")
    .requiredOption("--max-blog-number <n>", "Safety ceiling: refuse to touch a blog newer than this WN number", Number)
    .option("--commit", "Actually write to the remote (default: dry-run, only prints the plan)", false)
    .option("--insecure", "Skip TLS certificate verification - ONLY for a local dev server with a self-signed cert, never for a real remote", false)
    .parse(process.argv);

  const blogName = program.args[0];
  const options = program.opts();

  await new Promise((resolve, reject) => configModule.initialise((err) => (err ? reject(err) : resolve())));

  console.info(`Local side: NODE_ENV=${process.env.NODE_ENV || "development"}, blog ${blogName}`);
  console.info(`Remote side: ${options.remoteUrl}`);
  if (options.insecure) console.warn("--insecure given: TLS certificate verification is OFF for this run.");

  const httpsAgent = options.insecure ? new https.Agent({ rejectUnauthorized: false }) : undefined;

  const { plan, applyResult } = await runSync({
    blogName,
    remoteUrl: options.remoteUrl,
    apiKey: options.apiKey,
    maxBlogNumber: options.maxBlogNumber,
    commit: options.commit === true,
    httpsAgent
  });

  console.info("Plan:", JSON.stringify(summarizePlan(plan), null, 2));

  if (!plan.eligible) {
    console.error(`Blog is not eligible for sync: ${plan.reason}`);
    process.exitCode = 1;
    return;
  }

  if (plan.remoteOnly.length > 0) {
    console.warn(`WARNING: ${plan.remoteOnly.length} article(s) exist only remotely (created after the local snapshot) - left untouched, but check for predecessorId/category interactions:`);
    console.warn(JSON.stringify(plan.remoteOnly, null, 2));
  }

  if (plan.categoriesPlan && plan.categoriesPlan.action === "review") {
    console.warn("WARNING: categories differ in a way that isn't a pure insertion (something removed/reordered) - NOT auto-applied, review manually:");
    console.warn(JSON.stringify({ local: plan.categoriesPlan.localCategories, remote: plan.categoriesPlan.remoteCategories }, null, 2));
  }

  if (!options.commit) {
    console.info("Dry-run only (pass --commit to actually write). Remote's own eligibility confirmation:");
    console.info(JSON.stringify(applyResult, null, 2));
    return;
  }

  console.info("Applied (--commit given). Result:");
  console.info(JSON.stringify(applyResult, null, 2));
  if (applyResult.conflicts && applyResult.conflicts.length > 0) {
    console.warn(`${applyResult.conflicts.length} conflict(s) reported - NOT overwritten, review manually.`);
  }
  if (applyResult.blogConflicts && Object.keys(applyResult.blogConflicts).length > 0) {
    console.warn("Blog-level field conflict reported - NOT overwritten, review manually:", applyResult.blogConflicts);
  }
  if (applyResult.categoriesConflict) {
    console.warn("Categories conflict reported - NOT overwritten, review manually:", applyResult.categoriesConflict);
  }
  if (applyResult.errors && applyResult.errors.length > 0) {
    console.error(`${applyResult.errors.length} error(s) reported.`);
    process.exitCode = 1;
  }
}

// Only run the CLI when this file is the actual entry point - importing it
// for tests (see test/wp-reconcile.syncBlog.test.js) must not trigger it.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
