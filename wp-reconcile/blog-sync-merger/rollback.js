// Reverts changes previously written by the Blog-Sync-Merger's synthetic
// "wp-backport" user, by replaying the audit trail setAndSave() itself
// already wrote to the Postgres `changes` table - see CLAUDE.local.md
// "Safety net...d)": a full-table backup restore would also wipe unrelated,
// real editor changes made to OTHER articles/blogs since the backup was
// taken; replaying only this run's own log entries does not.
//
// Deliberately scoped to entries written under SYNTHETIC_MIGRATION_USER_NAME
// only (see CLAUDE.local.md "d2") - this is not a generic "revert any field
// to any historical value" tool, a real editor's changes are never touched.
//
// Safety: for every property being reverted, the value setAndSave is asked
// to verify as "still current" is the migration's own last known value for
// that property (not just whatever a moment-before read happens to see) -
// so if a real editor touched the same field after the migration ran,
// setAndSave's own optimistic-concurrency check (model/article.js) reports
// a conflict instead of silently clobbering that later edit.
//
// Like the write side (routes/api.js applyBlogSync), reverting
// categoryEN/predecessorId/title is only possible at all once the blog is
// temporarily reopened - see merger/withReopenedBlog.js.

import async from "async";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import logModule from "../../model/logModule.js";
import { withReopenedBlog } from "./withReopenedBlog.js";
import { SYNTHETIC_MIGRATION_USER_NAME } from "../../notification/migrationFilter.js";
import syncState from "./syncState.js";

const migrationUser = { OSMUser: SYNTHETIC_MIGRATION_USER_NAME };

function escapeForSql(value) {
  return String(value).replace(/'/g, "''");
}

// Reads the migration's own change-log rows for one article and folds them
// into, per property: the earliest `from` (the revert target - the value
// the property had before the migration first touched it) and the latest
// `to` (what the migration itself last wrote - the value setAndSave should
// verify is still current before reverting).
function summarizeLogForArticle(articleId, callback) {
  const numericId = Number(articleId);
  if (!Number.isInteger(numericId)) return callback(new Error("Invalid articleId: " + articleId));
  const query = " where data->>'oid' = '" + numericId + "'" +
    " and data->>'table' = 'article'" +
    " and data->>'user' = '" + escapeForSql(SYNTHETIC_MIGRATION_USER_NAME) + "'" +
    " and data->>'property' not like 'comment%'";
  logModule.find(query, { column: "id", desc: false }, function(err, rows) {
    if (err) return callback(err);
    const earliestFrom = {};
    const latestTo = {};
    for (const row of rows) {
      if (!(row.property in earliestFrom)) earliestFrom[row.property] = row.from;
      latestTo[row.property] = row.to; // rows are ascending by log id, so the last one wins
    }
    callback(null, { earliestFrom, latestTo });
  });
}

// Core revert logic for one article, WITHOUT reopening the blog itself -
// callers are responsible for already being inside a withReopenedBlog()
// window (rollbackBlog reopens once for the whole batch; rollbackArticle
// reopens around this single call).
function revertArticleFields(articleId, callback) {
  summarizeLogForArticle(articleId, function(err, summary) {
    if (err) return callback(err);
    // Only properties where the migration's own writes amounted to a real
    // net change are worth reverting - e.g. a field the migration set and
    // later set back to its original value is already at rest.
    const properties = Object.keys(summary.earliestFrom).filter(
      (property) => summary.earliestFrom[property] !== summary.latestTo[property]
    );
    if (properties.length === 0) return callback(null, { articleId, reverted: [], skipped: true });
    articleModule.findById(articleId, function(err, article) {
      if (err) return callback(err);
      if (!article) return callback(new Error("Article " + articleId + " not found"));
      const changes = { old: {} };
      for (const property of properties) {
        changes[property] = summary.earliestFrom[property];
        changes.old[property] = summary.latestTo[property];
      }
      article.setAndSave(migrationUser, changes, function(err) {
        if (err) {
          return callback(null, { articleId, reverted: [], conflict: true, error: err.message, detail: err.detail });
        }
        callback(null, { articleId, reverted: properties });
      });
    });
  });
}

// Reverts every property the migration touched on one article back to its
// pre-migration value. Never rejects with an error for a per-article
// conflict/no-op - those are reported in the result object.
export function rollbackArticle(articleId, callback) {
  articleModule.findById(articleId, function(err, article) {
    if (err) return callback(err);
    if (!article) return callback(new Error("Article " + articleId + " not found"));
    blogModule.findOne({ name: article.blog }, function(err, blog) {
      if (err) return callback(err);
      if (!blog) return callback(new Error("Blog " + article.blog + " not found"));
      withReopenedBlog(blog, migrationUser, function(done) {
        revertArticleFields(articleId, done);
      }, callback);
    });
  });
}

// Reverts every article the migration touched within one blog, reopening
// the blog only once for the whole batch. A single article's error/
// conflict does not stop the rest from being processed - their content was
// already delivered/reverted independently.
export function rollbackBlog(blogName, callback) {
  const query = " where data->>'blog' = '" + escapeForSql(blogName) + "'" +
    " and data->>'table' = 'article'" +
    " and data->>'user' = '" + escapeForSql(SYNTHETIC_MIGRATION_USER_NAME) + "'";
  logModule.find(query, { column: "id", desc: false }, function(err, rows) {
    if (err) return callback(err);
    const articleIds = [...new Set(rows.map((r) => r.oid))];
    if (articleIds.length === 0) return callback(null, []);
    blogModule.findOne({ name: blogName }, function(err, blog) {
      if (err) return callback(err);
      if (!blog) return callback(new Error("Blog " + blogName + " not found"));
      withReopenedBlog(blog, migrationUser, function(done) {
        const results = [];
        async.eachSeries(articleIds, function(articleId, cb) {
          revertArticleFields(articleId, function(err, result) {
            results.push(result || { articleId, error: err && err.message });
            cb();
          });
        }, function() { done(null, results); });
      }, callback);
    });
  });
}

// Moves one article to the Trash (see model/article.js setAndSave - a
// two-step transition, categoryEN -> "--unpublished--" THEN blog ->
// "Trash", same mechanism as routes/api.js applyBlogSync's doTrashExisting)
// under the migration's synthetic user. Not a "revert" - a created article
// has no meaningful prior value to replay - so this is a plain forward
// write via `version`, not the `old`-replay pattern the rest of this file
// uses. WITHOUT reopening the blog - callers must already be inside a
// withReopenedBlog() window, like revertArticleFields.
const ROLLBACK_REPLACE_UNPUBLISH_REASON = "Blog-Sync-Merger rollbackReplace: reverting an old-era replace run";

function trashArticle(articleId, callback) {
  articleModule.findById(articleId, function(err, article) {
    if (err) return callback(err);
    if (!article) return callback(null, { articleId, error: "Article not found" });
    article.setAndSave({ OSMUser: SYNTHETIC_MIGRATION_USER_NAME }, { categoryEN: "--unpublished--", unpublishReason: ROLLBACK_REPLACE_UNPUBLISH_REASON, version: article.version }, function(err) {
      if (err) return callback(null, { articleId, error: err.message });
      articleModule.findById(articleId, function(err, reloaded) {
        if (err) return callback(null, { articleId, error: err.message });
        reloaded.setAndSave({ OSMUser: SYNTHETIC_MIGRATION_USER_NAME }, { blog: "Trash", unpublishReason: ROLLBACK_REPLACE_UNPUBLISH_REASON, version: reloaded.version }, function(err) {
          if (err) return callback(null, { articleId, error: err.message });
          callback(null, { articleId, trashed: true });
        });
      });
    });
  });
}

// Reverts an old-era "replace" run (routes/api.js applyBlogSync
// mode:"replace", planned by merger/blogSyncMerger.js planReplace):
// - every article this run moved to Trash is un-trashed by replaying the
//   migration's own logged `categoryEN`/`blog` `from` values, via the same
//   revertArticleFields() this file already uses for a normal merge patch
//   (both properties were changed together by the migration, so one
//   setAndSave call restores both).
// - every article this run CREATED is trashed back out. These have no
//   meaningful prior value to "revert" (their `from` is "nothing existed"),
//   so they cannot be found via the changes-log the way the trashed
//   originals are - instead this reads the local, disposable syncState
//   marker (syncState.js loadReplacedCreatedIds) that routes/api.js's own
//   client (syncBlog.js) wrote after a successful --commit.
//
// Like rollbackBlog, a single article's error/conflict does not stop the
// rest of the batch from being processed. Scoped to article-level fields
// only - like rollbackArticle/rollbackBlog, this does NOT revert blog-level
// fields (categories, teamString<LANG>, close<LANG>) the replace run may
// have changed; those would need their own blog-field revert, not yet
// built for either rollback path.
export function rollbackReplace(blogName, callback) {
  const trashedQuery = " where data->>'blog' = 'Trash'" +
    " and data->>'table' = 'article'" +
    " and data->>'user' = '" + escapeForSql(SYNTHETIC_MIGRATION_USER_NAME) + "'" +
    " and data->>'property' = 'blog'" +
    " and data->>'from' = '" + escapeForSql(blogName) + "'";
  logModule.find(trashedQuery, { column: "id", desc: false }, function(err, rows) {
    if (err) return callback(err);
    const trashedArticleIds = [...new Set(rows.map((r) => r.oid))];
    const createdArticleIds = syncState.loadReplacedCreatedIds(blogName);
    if (trashedArticleIds.length === 0 && createdArticleIds.length === 0) {
      return callback(null, { untrashed: [], trashed: [] });
    }
    blogModule.findOne({ name: blogName }, function(err, blog) {
      if (err) return callback(err);
      if (!blog) return callback(new Error("Blog " + blogName + " not found"));
      withReopenedBlog(blog, migrationUser, function(done) {
        async.series({
          untrashed: function(cb) {
            const results = [];
            async.eachSeries(trashedArticleIds, function(articleId, cbEach) {
              revertArticleFields(articleId, function(err, result) {
                results.push(result || { articleId, error: err && err.message });
                cbEach();
              });
            }, function(err) { cb(err, results); });
          },
          trashed: function(cb) {
            const results = [];
            async.eachSeries(createdArticleIds, function(articleId, cbEach) {
              trashArticle(articleId, function(err, result) {
                results.push(result || { articleId, error: err && err.message });
                cbEach();
              });
            }, function(err) { cb(err, results); });
          }
        }, function(err, results) { done(err, results); });
      }, callback);
    });
  });
}

export default { rollbackArticle, rollbackBlog, rollbackReplace };
