

import _debug from "debug";
import express from "express";
import userModule from "../model/user.js";
import async from "async";
import htmlTitle from "../model/htmltitle.js";
import util from "../util/util.js";
import articleModule from "../model/article.js";
import config from "../config.js";
import language from "../model/language.js";
import blogModule from "../model/blog.js";
import { ZipArchive } from "archiver";
import { CONFLICT } from "http-status-codes";
import blogSyncMerger from "../wp-reconcile/blog-sync-merger/blogSyncMerger.js";
import { withReopenedBlog } from "../wp-reconcile/blog-sync-merger/withReopenedBlog.js";
import { SYNTHETIC_MIGRATION_USER_NAME } from "../notification/migrationFilter.js";

const debug = _debug("OSMBC:routes:api");
const publicApiRouter  = express.Router();



const apiKeys = config.getValue("apiKeys", { mustExist: true });

function checkApiKey(req, res, next) {
  debug("checkApiKey");
  const apiKey = req.params.apiKey;

  if (apiKeys[apiKey]) {
    req.apiKey = apiKeys[apiKey];
    return next();
  }

  userModule.findOne({ apiKey: req.params.apiKey }, function(err, user) {
    if (err || !user) {
      const err = new Error("Not Authorised");
      err.status = 401;
      err.type = "API";
      return next(err);
    }
    req.user = user;
    return next();
  });
}

// If function is called just return OK
function isServerUp(req, res) {
  debug("isServerUp");
  res.end("OK");
}

// If function is called query a postgres user,
// and check, wether there is a postgres error
function isPostgresUp(req, res) {
  debug("isPostgresUp");
  userModule.find({ OSMUser: "test" }, function(err) {
    if (err) return res.end("Postgres Error");
    res.end("OK");
  });
}

function collectArticle(req, res, next) {
  debug("collectArticle");
  const changes = {};
  changes.categoryEN = "-- no category yet --";
  if (req.body.categoryEN) {
    changes.categoryEN = req.body.categoryEN;
  }
  changes.blog = "TBC";
  let user = "";

  for (const lang in language.getLanguages()) {
    if (req.body["markdown" + lang]) {
      changes["markdown" + lang] = req.body["markdown" + lang];
    }
  }

  async.series([
    function getTitle(cb) {
      if (req.body.title) {
        changes.title = req.body.title;
        return cb();
      } else {
        let url = [];
        if (typeof req.body.collection === "string") url = util.getAllURL(req.body.collection);
        if (url.length === 0) {
          changes.title = "NOT GIVEN";
          return cb();
        }
        htmlTitle.getTitle(url[0]).then(function(title) {
          changes.title = title;
          return cb();
        }).catch((err) => { return cb(err); });
      }
    },
    function getCollection(cb) {
      if (req.body.collection) {
        changes.collection = req.body.collection;
        return cb();
      } else {
        const error = new Error("Missing Collection");
        error.status = 422;
        error.type = "API";
        return cb(error);
      }
    },
    function getOSMuser(cb) {
      const query = {};
      if (req.body.OSMUser) {
        query.OSMUser = req.body.OSMUser;
      } else {
        if (!req.body.email) {
          const err = new Error("No OSMUser && EMail given");
          err.type = "API";
          err.status = 422;
          return cb(err);
        }
        query.email = req.body.email;
      }
      userModule.findOne(query, function(err, userFound) {
        if (err || !userFound) {
          const err = new Error("No OSMUser given, could not resolve email address");
          err.type = "API";
          err.status = 422;
          return cb(err);
        }
        user = userFound;
        changes.firstCollector = user.OSMUser;
        return cb();
      });
    }
  ], function(err) {
    if (err) return next(err);

    // check on existence of markdown in body

    if (req.body.markdown && typeof user === "object" && user.language) {
      changes["markdown" + user.language] = req.body.markdown;
    }
    articleModule.createNewArticle(function(err, result) {
      if (err) return next(err);
      changes.version = result.version;

      result.setAndSave(user, changes, function(err) {
        if (err) return next(err);
        res.send("Article Collected in TBC.");
      });
    });
  });
}

function collectArticleLink(req, res, next) {
  debug("collectArticleLink");
  const changes = {};
  changes.categoryEN = "-- no category yet --";
  changes.blog = "TBC";
  const collection = encodeURI(req.query.collection);
  if (!req.user) return next(new Error("for collect not defined"));
  changes.firstCollector = req.user.OSMUser;
  async.series([
    function getTitle(cb) {
      if (req.query.title) {
        changes.title = req.query.title;
        return cb();
      } else {
        let url = [];
        if (typeof collection === "string") url = util.getAllURL(collection);
        if (url.length === 0) {
          changes.title = "NOT GIVEN";
          return cb();
        }
        htmlTitle.getTitle(url[0]).then(function(title) {
          changes.title = title;
          return cb();
        }).catch(function(err) {
          return cb(err);
        });
      }
    },
    function getCollection(cb) {
      if (req.query.collection) {
        changes.collection = collection;
        return cb();
      } else {
        const error = new Error("Missing Collection");
        error.status = 422;
        error.type = "API";
        return cb(error);
      }
    }
  ], function(err) {
    if (err) return next(err);

    // check on existence of markdown in body
    articleModule.createNewArticle(function(err, result) {
      if (err) return next(err);
      changes.version = result.version;

      result.setAndSave(req.user, changes, function(err) {
        if (err) return next(err);
        res.set("Access-Control-Allow-Origin", "*");
        res.send(config.getValue("url") + config.htmlRoot() + "/article/" + result.id);
      });
    });
  });
}

function checkBlogId(req, res, next, id) {
  debug("checkBlogId");
  blogModule.findBlogByRouteId(id, function(err, blog) {
    if (err) return next(err);
    if (!blog) {
      const notFound = new Error("Blog not found");
      notFound.status = 404;
      notFound.type = "API";
      return next(notFound);
    }
    req.blog = blog;
    return next();
  });
}

// Exclusive-per-profile guard so two concurrent outstanding-export requests
// for the SAME exportProfile cannot pick up and re-deliver the same blogs
// before either has had a chance to mark them as exported.
// NOTE: this is an in-process guard only (a Set kept in memory). It does not
// protect a multi-instance/cluster deployment - that would need a Postgres
// advisory lock or similar. Requests for different exportProfiles, or plain
// dry-run requests, are never blocked by it.
const outstandingExportLocks = new Set();

// Resolves the identity to attribute the exportedBy change-log entry to.
// checkApiKey sets req.user for a per-user apiKey, or req.apiKey to the
// label configured under `apiKeys` for a shared key.
function getOutstandingExportUser(req) {
  if (req.user && req.user.OSMUser) return { OSMUser: req.user.OSMUser };
  return { OSMUser: "apikey:" + (req.apiKey || "unknown") };
}

// Parses an optional minBlogNumber/maxBlogNumber query param into a
// non-negative integer. Returns { value: undefined } when the param wasn't
// given at all, or { error } (a ready-to-use API error) when it was given
// but isn't a valid non-negative integer.
function parseBlogNumberBound(raw, fieldName) {
  if (typeof raw === "undefined") return { value: undefined };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    const error = new Error(`Invalid ${fieldName}: must be a non-negative integer`);
    error.status = 422;
    error.type = "API";
    return { error };
  }
  return { value: parsed };
}

/**
 * Download a combined ZIP of all blogs with outstanding (not yet delivered) export,
 * or (with `dryRun=true`) just list what that download would currently contain.
 *
 * Route params:
 * - apiKey {string} API key used by middleware `checkApiKey`
 *
 * Query params:
 * - exportProfile {string} required profile name from config key `ExportProfiles`
 * - lang {string} optional language code or `ALL` (defaults to all configured languages)
 * - minBlogNumber {number} optional, inclusive lower bound on the WN number (e.g. 256 for "WN256")
 * - maxBlogNumber {number} optional, inclusive upper bound on the WN number
 * - dryRun {string} optional, "true" returns a JSON preview instead of building/marking anything
 *
 * Behavior:
 * - Finds all WeeklyNote blogs that are closed for the requested lang(s) and not yet exported,
 *   optionally narrowed to [minBlogNumber, maxBlogNumber] to page through a large backlog
 * - Returns a combined ZIP with one file per blog+lang
 * - A rendering failure for one blog/lang is skipped and reported via the
 *   `X-Outstanding-Export-Warnings` response header, it does not abort the whole batch
 * - Sets exportedBy markers (with a change-log entry) after the response is fully sent
 * - If no eligible blogs: respects `noContentBehavior` in the ExportProfile config
 *   ("404" = default, "emptyZip" = return empty ZIP with HTTP 200)
 * - Rejects with 409 if another outstanding export for the same exportProfile is in flight
 */
function getBlogPreviewDownloadOutstanding(req, res, next) {
  debug("getBlogPreviewDownloadOutstanding");

  const exportProfile = (typeof req.query.exportProfile === "string") ? req.query.exportProfile.trim() : "";
  if (!exportProfile) {
    const error = new Error("Missing exportProfile");
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  const profileConfig = config.getValue("ExportProfiles", exportProfile);
  if (!profileConfig) {
    const error = new Error("Unknown export profile: " + exportProfile);
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  if (!profileConfig.pathTemplate) {
    const error = new Error(`Export profile '${exportProfile}' has no pathTemplate and cannot be used for outstanding bundle export`);
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  let langs = req.query.lang;
  if (!langs || langs === "ALL") {
    langs = language.getLid();
  } else if (typeof langs === "string") {
    langs = [langs];
  } else if (!Array.isArray(langs)) {
    langs = language.getLid();
  }

  // Optional WN-number range, so a consumer can page through a large
  // backlog (e.g. an initial catch-up run) instead of getting everything
  // outstanding in one response.
  const minBound = parseBlogNumberBound(req.query.minBlogNumber, "minBlogNumber");
  if (minBound.error) return next(minBound.error);
  const maxBound = parseBlogNumberBound(req.query.maxBlogNumber, "maxBlogNumber");
  if (maxBound.error) return next(maxBound.error);
  if (typeof minBound.value === "number" && typeof maxBound.value === "number" && minBound.value > maxBound.value) {
    const error = new Error("minBlogNumber must not be greater than maxBlogNumber");
    error.status = 422;
    error.type = "API";
    return next(error);
  }
  const blogNumberOptions = {};
  if (typeof minBound.value === "number") blogNumberOptions.minBlogNumber = minBound.value;
  if (typeof maxBound.value === "number") blogNumberOptions.maxBlogNumber = maxBound.value;

  const dryRun = req.query.dryRun === "true";

  if (dryRun) {
    return blogModule.findBlogsForOutstandingExport(exportProfile, langs, blogNumberOptions, function(err, blogs) {
      if (err) return next(err);
      const preview = blogs.map(function(blog) {
        return { name: blog.name, langs: blogModule.getOutstandingLangsForBlog(blog, exportProfile, langs) };
      });
      res.set("content-type", "application/json");
      res.end(JSON.stringify({
        exportProfile: exportProfile,
        minBlogNumber: blogNumberOptions.minBlogNumber ?? null,
        maxBlogNumber: blogNumberOptions.maxBlogNumber ?? null,
        count: preview.length,
        blogs: preview
      }));
    });
  }

  if (outstandingExportLocks.has(exportProfile)) {
    const conflict = new Error(`Outstanding export for profile '${exportProfile}' is already in progress, please retry shortly`);
    conflict.status = 409;
    conflict.type = "API";
    return next(conflict);
  }
  outstandingExportLocks.add(exportProfile);
  let markingStarted = false;
  function releaseLock() { outstandingExportLocks.delete(exportProfile); }

  blogModule.buildOutstandingExportZip(exportProfile, langs, blogNumberOptions, function(err, result) {
    if (err) {
      releaseLock();
      return next(err);
    }

    const { archive, toMark, failures } = result;

    if (failures && failures.length > 0) {
      const failureList = failures.map((f) => `${f.blog.name}:${f.lang}`).join(",");
      debug("Skipped %d blog/lang exports due to render errors: %s", failures.length, failureList);
      res.set("X-Outstanding-Export-Warnings", failureList);
    }

    if (!archive) {
      releaseLock();
      const noContentBehavior = profileConfig.noContentBehavior || "404";
      if (noContentBehavior === "emptyZip") {
        const emptyArchive = new ZipArchive("zip", { zlib: { level: 9 } });
        res.set("content-type", "application/zip");
        res.attachment("outstanding.zip");
        emptyArchive.pipe(res);
        emptyArchive.finalize();
        return;
      }
      const notFound = new Error("No blogs available for outstanding export");
      notFound.status = 404;
      notFound.type = "API";
      return next(notFound);
    }

    let zipFileName = "outstanding.zip";
    if (profileConfig.fileNameTemplate) {
      const templated = profileConfig.fileNameTemplate.replace(/##[^#]+##/g, "outstanding");
      if (templated && templated.trim()) {
        zipFileName = templated.toLowerCase().endsWith(".zip") ? templated : `${templated}.zip`;
      }
    }

    res.set("content-type", "application/zip");
    res.attachment(zipFileName);

    const user = getOutstandingExportUser(req);

    res.on("finish", function() {
      markingStarted = true;
      const markingFailures = [];
      async.eachSeries(toMark, function(item, cb) {
        item.blog.markAsExported(user, exportProfile, item.lang, function(err) {
          // A single blog's marker failing to save must not stop the rest
          // from being marked - the content for ALL of them was already
          // delivered in the response that just finished.
          if (err) markingFailures.push({ blog: item.blog.name, lang: item.lang, error: err.message });
          cb();
        });
      }, function() {
        if (markingFailures.length > 0) {
          debug("Some exportedBy markers could not be set (blog stays 'outstanding' and will be re-offered next time): %j", markingFailures);
        }
        releaseLock();
      });
    });
    // Safety net: if the client disconnects before "finish" fires, marking
    // never starts, so release the lock here instead of leaving it stuck.
    res.on("close", function() {
      if (!markingStarted) releaseLock();
    });

    archive.pipe(res);
  });
}

// Parses the required `since` query param into a string usable with the
// changes-log "GE:" query operator. Returns { value } or { error }.
function parseSinceParam(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    const error = new Error("Missing since");
    error.status = 422;
    error.type = "API";
    return { error };
  }
  const trimmed = raw.trim();
  if (Number.isNaN(Date.parse(trimmed))) {
    const error = new Error("Invalid since: must be a parseable date (e.g. 2026-01-01)");
    error.status = 422;
    error.type = "API";
    return { error };
  }
  return { value: trimmed };
}

/**
 * Download a combined ZIP of all blogs closed for a language on or after a
 * given date, or (with `dryRun=true`) just list what that download would
 * currently contain.
 *
 * Route params:
 * - apiKey {string} API key used by middleware `checkApiKey`
 *
 * Query params:
 * - exportProfile {string} required profile name from config key `ExportProfiles`
 * - since {string} required date (e.g. "2026-01-01"); looks at the changes log for
 *   close{LANG} transitions on or after this date
 * - lang {string} optional language code or `ALL` (defaults to all configured languages)
 * - minBlogNumber {number} optional, inclusive lower bound on the WN number (e.g. 256 for "WN256")
 * - maxBlogNumber {number} optional, inclusive upper bound on the WN number
 * - dryRun {string} optional, "true" returns a JSON preview instead of building anything
 *
 * Behavior:
 * - Finds all WeeklyNote blogs that were closed for the requested lang(s) on/after
 *   `since` AND are still closed now (a later reopen excludes them again)
 * - Returns a combined ZIP with one file per blog+lang, same shape as `outstanding`
 * - A rendering failure for one blog/lang is skipped and reported via the
 *   `X-ClosedSince-Export-Warnings` response header, it does not abort the whole batch
 * - Read-only: unlike `outstanding`, it never sets exportedBy markers, so re-running it
 *   for the same (or an overlapping) date range is safe and does not affect `outstanding`
 * - If no eligible blogs: respects `noContentBehavior` in the ExportProfile config
 *   ("404" = default, "emptyZip" = return empty ZIP with HTTP 200)
 */
function getBlogPreviewDownloadClosedSince(req, res, next) {
  debug("getBlogPreviewDownloadClosedSince");

  const exportProfile = (typeof req.query.exportProfile === "string") ? req.query.exportProfile.trim() : "";
  if (!exportProfile) {
    const error = new Error("Missing exportProfile");
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  const profileConfig = config.getValue("ExportProfiles", exportProfile);
  if (!profileConfig) {
    const error = new Error("Unknown export profile: " + exportProfile);
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  if (!profileConfig.pathTemplate) {
    const error = new Error(`Export profile '${exportProfile}' has no pathTemplate and cannot be used for closedSince bundle export`);
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  const since = parseSinceParam(req.query.since);
  if (since.error) return next(since.error);

  let langs = req.query.lang;
  if (!langs || langs === "ALL") {
    langs = language.getLid();
  } else if (typeof langs === "string") {
    langs = [langs];
  } else if (!Array.isArray(langs)) {
    langs = language.getLid();
  }

  const minBound = parseBlogNumberBound(req.query.minBlogNumber, "minBlogNumber");
  if (minBound.error) return next(minBound.error);
  const maxBound = parseBlogNumberBound(req.query.maxBlogNumber, "maxBlogNumber");
  if (maxBound.error) return next(maxBound.error);
  if (typeof minBound.value === "number" && typeof maxBound.value === "number" && minBound.value > maxBound.value) {
    const error = new Error("minBlogNumber must not be greater than maxBlogNumber");
    error.status = 422;
    error.type = "API";
    return next(error);
  }
  const blogNumberOptions = {};
  if (typeof minBound.value === "number") blogNumberOptions.minBlogNumber = minBound.value;
  if (typeof maxBound.value === "number") blogNumberOptions.maxBlogNumber = maxBound.value;

  const dryRun = req.query.dryRun === "true";

  if (dryRun) {
    return blogModule.findBlogsClosedSince(since.value, langs, blogNumberOptions, function(err, blogsWithLangs) {
      if (err) return next(err);
      const preview = blogsWithLangs.map(function(entry) {
        return { name: entry.blog.name, langs: entry.langs };
      });
      res.set("content-type", "application/json");
      res.end(JSON.stringify({
        exportProfile: exportProfile,
        since: since.value,
        minBlogNumber: blogNumberOptions.minBlogNumber ?? null,
        maxBlogNumber: blogNumberOptions.maxBlogNumber ?? null,
        count: preview.length,
        blogs: preview
      }));
    });
  }

  blogModule.buildClosedSinceExportZip(exportProfile, since.value, langs, blogNumberOptions, function(err, result) {
    if (err) return next(err);

    const { archive, failures } = result;

    if (failures && failures.length > 0) {
      const failureList = failures.map((f) => `${f.blog.name}:${f.lang}`).join(",");
      debug("Skipped %d blog/lang exports due to render errors: %s", failures.length, failureList);
      res.set("X-ClosedSince-Export-Warnings", failureList);
    }

    if (!archive) {
      const noContentBehavior = profileConfig.noContentBehavior || "404";
      if (noContentBehavior === "emptyZip") {
        const emptyArchive = new ZipArchive("zip", { zlib: { level: 9 } });
        res.set("content-type", "application/zip");
        res.attachment("closedSince.zip");
        emptyArchive.pipe(res);
        emptyArchive.finalize();
        return;
      }
      const notFound = new Error("No blogs available for closedSince export");
      notFound.status = 404;
      notFound.type = "API";
      return next(notFound);
    }

    let zipFileName = "closedSince.zip";
    if (profileConfig.fileNameTemplate) {
      const templated = profileConfig.fileNameTemplate.replace(/##[^#]+##/g, "closedsince");
      if (templated && templated.trim()) {
        zipFileName = templated.toLowerCase().endsWith(".zip") ? templated : `${templated}.zip`;
      }
    }

    res.set("content-type", "application/zip");
    res.attachment(zipFileName);

    archive.pipe(res);
  });
}

/**
 * Download a rendered blog preview using a configured export profile.
 *
 * Route params:
 * - apiKey {string} API key used by middleware `checkApiKey`
 * - blog_id {string} blog identifier (internal id or name), resolved by `checkBlogId`
 *
 * Query params:
 * - exportProfile {string} required profile name from config key `ExportProfiles`
 * - lang {string} optional language code or `ALL` (defaults are handled in model layer)
 *
 * Behavior:
 * - Always forces download semantics (`forceDownload: true`)
 * - Returns stream or string payload from `buildPreviewExport`
 * - Sets `content-type` according to renderer result
 * - On missing `exportProfile` returns API error 422
 */
function getBlogPreviewDownload(req, res, next) {
  debug("getBlogPreviewDownload");

  const exportProfile = (typeof req.query.exportProfile === "string") ? req.query.exportProfile.trim() : "";
  if (!exportProfile) {
    const error = new Error("Missing exportProfile");
    error.status = 422;
    error.type = "API";
    return next(error);
  }

  req.blog.buildPreviewExport({
    lang: req.query.lang,
    exportProfile: exportProfile,
    forceDownload: true
  }, function(err, result) {
    if (err) return next(err);
    res.set("content-type", result.mimeType);
    if (result.bodyType === "string") {
      return res.attachment(result.fileName).end(result.body);
    }
    res.attachment(result.fileName);
    result.body.pipe(res);
  });
}

function getSyncTrackedFields() {
  const fields = [...blogSyncMerger.BASE_TRACKED_FIELDS];
  for (const lang in language.getLanguages()) fields.push("markdown" + lang);
  return fields;
}

// Blog-level fields the Blog-Sync-Merger also diffs/patches, in addition
// to categories/status (handled separately via eligibility/
// missingCategories). Currently just teamString<LANG> ("who produced this
// issue" credit line, feeds the Hugo footer) - found missing after a real
// osmbc_prod_copie vs. osmbc Hugo-export byte-diff (see CLAUDE.local.md).
// Deliberately opt-in and separate from article fields: Blog.setAndSave
// (model/blog.js) has no isChangeAllowed-style lock (so, unlike article
// patches, doesn't strictly need the reopen window below), but its
// optimistic-concurrency check via `data.old` is opt-in per key rather
// than required, since most other Blog callers never set it.
function getSyncTrackedBlogFields() {
  const fields = [];
  for (const lang in language.getLanguages()) fields.push("teamString" + lang);
  return fields;
}

/**
 * Blog-Sync-Merger read endpoint: returns one blog and all of its articles
 * as raw JSON (not rendered through any export profile) - the input the
 * merger's planning logic (merger/blogSyncMerger.js) needs to compute a
 * diff against a local copy.
 *
 * Route params:
 * - apiKey {string} API key used by middleware `checkApiKey`
 * - blog_id {string} blog identifier (internal id or name), resolved by `checkBlogId`
 */
function getBlogSync(req, res, next) {
  debug("getBlogSync");
  const blog = req.blog;
  const trackedFields = getSyncTrackedFields();
  const trackedBlogFields = getSyncTrackedBlogFields();

  articleModule.find({ blog: blog.name }, function(err, articles) {
    if (err) return next(err);
    const blogData = {
      id: blog.id,
      name: blog.name,
      status: blog.status,
      categories: blog.categories,
      ...blogSyncMerger.serializeFieldsForSync(blog, trackedBlogFields)
    };
    res.set("content-type", "application/json");
    res.end(JSON.stringify({
      blog: blogData,
      trackedFields: trackedFields,
      trackedBlogFields: trackedBlogFields,
      articles: articles.map((a) => blogSyncMerger.serializeArticleForSync(a, trackedFields))
    }));
  });
}

/**
 * Blog-Sync-Merger write endpoint: applies a merge plan (as produced by
 * merger/blogSyncMerger.js against a client-side download of getBlogSync)
 * against this blog. Every write is attributed to the synthetic
 * `wp-backport` user (see notification/migrationFilter.js) so it stays out
 * of editor mail/Slack notifications while remaining fully visible in the
 * changes-log audit trail, which merger/rollback.js depends on.
 *
 * Route params: apiKey, blog_id - as getBlogSync.
 *
 * Body:
 * - maxBlogNumber {number} required - safety net (a): re-checked here
 *   server-side, never trusted from a client-computed plan alone.
 * - dryRun {boolean} optional - if true, only re-validates eligibility and
 *   reports counts, no write of any kind happens.
 * - creates {Array<{localId, fields}>} optional - articles to create.
 *   `fields.predecessorId`, if present, may reference another entry's
 *   `localId` in this same batch - resolved in a second pass once real ids
 *   are known (see merger/blogSyncMerger.js remapPredecessorIds).
 * - patches {Array<{id, changes, old}>} optional - existing articles to
 *   patch; `old` is passed straight through to setAndSave for its
 *   optimistic-concurrency check.
 * - blogPatch {{changes, old}} optional - blog-level fields to patch (e.g.
 *   teamString<LANG>, see getSyncTrackedBlogFields). `old` is passed
 *   straight through to Blog.prototype.setAndSave (model/blog.js), same
 *   as an article patch's `old` - its optimistic-concurrency check is
 *   opt-in per key there specifically so this works without touching the
 *   many other Blog callers that never set `old`.
 * - categories {Array} optional - the local side's full `categories`
 *   array. Unlike blogPatch, the decision of what to actually do about it
 *   is never trusted from the client: this endpoint always recomputes
 *   `blogSyncMerger.planCategoriesMerge(body.categories, blog.categories)`
 *   against the blog's *current* live state, and only ever applies it when
 *   that still comes back "replace" (remote's existing categories are an
 *   ordered subsequence of local's - i.e. local only added to them, never
 *   removed/reordered one). Anything else is left untouched and reported
 *   for manual review, never auto-applied - see CLAUDE.md on why
 *   `categories` order is sensitive (heading order + lead-picture caption
 *   position).
 *
 * Response: { created, patched, conflicts, errors, blogPatched,
 * blogConflicts, categoriesAction, categoriesConflict } - a conflict (409
 * from setAndSave, for an article or a blog/categories patch) or a
 * per-item error never aborts the rest of the batch.
 */
function applyBlogSync(req, res, next) {
  debug("applyBlogSync");
  const blog = req.blog;
  const body = req.body || {};

  const eligibility = blogSyncMerger.checkBlogEligibility(blog, { maxBlogNumber: body.maxBlogNumber });
  if (!eligibility.eligible) {
    const error = new Error(eligibility.reason);
    error.status = 409;
    error.type = "API";
    return next(error);
  }

  const creates = Array.isArray(body.creates) ? body.creates : [];
  const patches = Array.isArray(body.patches) ? body.patches : [];
  const blogPatch = (body.blogPatch && typeof body.blogPatch.changes === "object") ? body.blogPatch : null;
  const migrationUser = { OSMUser: SYNTHETIC_MIGRATION_USER_NAME };

  // Always recomputed against the blog's current live categories - never
  // trust a client-precomputed "replace" decision for this, since it's the
  // one write here with no per-field optimistic-concurrency check to fall
  // back on (a whole-array replace either happens or it doesn't).
  const categoriesPlan = Array.isArray(body.categories)
    ? blogSyncMerger.planCategoriesMerge(body.categories, blog.categories)
    : { action: "none" };

  if (body.dryRun === true) {
    res.set("content-type", "application/json");
    return res.end(JSON.stringify({
      blog: blog.name,
      wouldCreate: creates.length,
      wouldPatch: patches.length,
      wouldPatchBlogFields: blogPatch ? Object.keys(blogPatch.changes) : [],
      wouldPatchCategories: categoriesPlan.action
    }));
  }

  const createdIdMap = new Map(); // localId -> id actually assigned remotely
  const result = {
    created: [], patched: [], conflicts: [], errors: [],
    blogPatched: [], blogConflicts: {},
    categoriesAction: categoriesPlan.action, categoriesConflict: null
  };

  // One single reopen/restore cycle around the whole batch (blog-level
  // patch included, even though Blog.setAndSave itself has no
  // isChangeAllowed-style lock to work around) - simpler than a separate
  // open/close per concern, and keeps the changes-log audit trail to one
  // status edit->closed pair per migration run instead of one per step.
  withReopenedBlog(blog, migrationUser, function runBatch(done) {
    async.series([
      doBlogPatch,
      doCategoriesPatch,
      doCreates,
      doPredecessorPatchForCreated,
      doPatches
    ], done);
  }, function(err) {
    if (err) return next(err);
    res.set("content-type", "application/json");
    res.end(JSON.stringify(result));
  });

  function doCategoriesPatch(cb) {
    if (categoriesPlan.action !== "replace") return cb();
    blog.setAndSave(migrationUser, { categories: categoriesPlan.categories, old: { categories: categoriesPlan.old } }, function(err) {
      if (err) {
        if (err.status === CONFLICT) {
          result.categoriesConflict = { error: err.message, detail: err.detail };
        } else {
          result.errors.push({ blog: blog.name, error: err.message });
        }
        return cb();
      }
      cb();
    });
  }

  function doBlogPatch(cb) {
    if (!blogPatch || Object.keys(blogPatch.changes).length === 0) return cb();
    blog.setAndSave(migrationUser, { ...blogPatch.changes, old: blogPatch.old }, function(err) {
      if (err) {
        if (err.status === CONFLICT) {
          // setAndSave reports the first conflicting key it finds, not
          // every one - same behavior as Article.prototype.setAndSave.
          result.blogConflicts = { error: err.message, detail: err.detail };
        } else {
          result.errors.push({ blog: blog.name, error: err.message });
        }
        return cb();
      }
      result.blogPatched = Object.keys(blogPatch.changes);
      cb();
    });
  }

  function doCreates(cb) {
    async.eachSeries(creates, function(item, cbEach) {
      const fields = { ...item.fields };
      delete fields.predecessorId; // set in the pass below, once real ids are known
      fields.blog = blog.name;
      articleModule.createNewArticle(function(err, article) {
        if (err) return cbEach(err);
        fields.version = article.version;
        fields.firstCollector = SYNTHETIC_MIGRATION_USER_NAME;
        article.setAndSave(migrationUser, fields, function(err) {
          if (err) {
            result.errors.push({ localId: item.localId, error: err.message });
            return cbEach();
          }
          createdIdMap.set(item.localId, article.id);
          result.created.push({ localId: item.localId, id: article.id });
          cbEach();
        });
      });
    }, cb);
  }

  function doPredecessorPatchForCreated(cb) {
    async.eachSeries(creates, function(item, cbEach) {
      const wantedPredecessorId = item.fields && item.fields.predecessorId;
      if (!wantedPredecessorId) return cbEach();
      const createdId = createdIdMap.get(item.localId);
      if (typeof createdId === "undefined") return cbEach(); // creation itself failed, already recorded above
      const remotePredecessorId = createdIdMap.has(wantedPredecessorId)
        ? createdIdMap.get(wantedPredecessorId)
        : wantedPredecessorId; // already a shared/pre-existing id, no remap needed
      articleModule.findById(createdId, function(err, article) {
        if (err) return cbEach(err);
        article.setAndSave(migrationUser, { predecessorId: remotePredecessorId, old: { predecessorId: article.predecessorId || "" } }, function(err) {
          if (err) result.errors.push({ localId: item.localId, error: err.message });
          cbEach();
        });
      });
    }, cb);
  }

  function doPatches(cb) {
    async.eachSeries(patches, function(item, cbEach) {
      // An existing article's predecessorId can legitimately need to
      // point at a brand-new sibling created earlier in this very batch
      // (e.g. a new article inserted between two already-migrated ones) -
      // that reference is still a local id at plan time, only resolvable
      // once doCreates has actually run and populated createdIdMap.
      if (item.changes && item.changes.predecessorId && createdIdMap.has(item.changes.predecessorId)) {
        item.changes.predecessorId = createdIdMap.get(item.changes.predecessorId);
      }
      articleModule.findById(item.id, function(err, article) {
        if (err) return cbEach(err);
        if (!article) {
          result.errors.push({ id: item.id, error: "Article not found" });
          return cbEach();
        }
        article.setAndSave(migrationUser, { ...item.changes, old: item.old }, function(err) {
          if (err) {
            if (err.status === CONFLICT) {
              result.conflicts.push({ id: item.id, error: err.message, detail: err.detail });
            } else {
              result.errors.push({ id: item.id, error: err.message });
            }
            return cbEach();
          }
          result.patched.push({ id: item.id });
          cbEach();
        });
      });
    }, cb);
  }
}

publicApiRouter.param("apiKey", checkApiKey);
publicApiRouter.param("blog_id", checkBlogId);

publicApiRouter.get("/monitor/:apiKey", isServerUp);
publicApiRouter.get("/monitorPostgres/:apiKey", isPostgresUp);

publicApiRouter.post("/collectArticle/:apiKey", collectArticle);
publicApiRouter.get("/collect/:apiKey", collectArticleLink);
publicApiRouter.get("/blogPreviewDownload/:apiKey/outstanding", getBlogPreviewDownloadOutstanding);
publicApiRouter.get("/blogPreviewDownload/:apiKey/closedSince", getBlogPreviewDownloadClosedSince);
publicApiRouter.get("/blogPreviewDownload/:apiKey/:blog_id", getBlogPreviewDownload);
publicApiRouter.get("/blogSync/:apiKey/:blog_id", getBlogSync);
publicApiRouter.post("/blogSync/:apiKey/:blog_id/apply", applyBlogSync);

export default publicApiRouter;
