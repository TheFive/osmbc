// Certain article fields (categoryEN, predecessorId, title, blog,
// collection, and each markdown<LANG>) are guarded by
// Article.prototype.isChangeAllowed() (model/article.js) once a blog - or
// one of its languages - is closed/exported, by design, so a finished
// issue can't be edited by accident. The Blog-Sync-Merger's safety net (a)
// requires exactly the opposite: it only ever targets closed blogs.
//
// This mirrors the existing, already-proven `withReopenedBlog` precedent
// from wp-reconcile/backport/fixManualReviewConflicts.js (sibling worktree
// `osmbc`, branch `feature/wp-reconcile`): temporarily reopen the blog,
// run the write, then restore the blog exactly as it was - including
// `exported<LANG>`, so the outstanding-export tracking is not disturbed
// beyond the edit window.
//
// restoreOverrides (optional): fields to restore to a DIFFERENT value than
// what the blog originally had, merged on top of the captured original
// state right before the final setAndSave. Exists for close<LANG>: found
// via a real Hugo-export diff that the renderer (render/Renderer.js) skips
// a language's content entirely unless close<LANG> is true
// (render/Renderer.js: `if (onlyClosed && !this.blog["close"+lang])`), so
// syncing that flag matters for correct output - but it must never be set
// to its new (possibly `true`) value *before* `action` runs
// Article.prototype.isChangeAllowed() locks markdown<LANG> once that
// language's close/exported flag is true, which would then block this
// very batch's own markdown<LANG> patches for that language. Restoring to
// the new value only *after* `action` has already run avoids that
// entirely, without ever needing the open window widened.
import language from "../../model/language.js";

export function withReopenedBlog(blog, user, action, callback, restoreOverrides = {}) {
  const langlist = language.getLanguages();
  const original = { status: blog.status };
  const openData = { status: "edit" };
  for (const l in langlist) {
    original["close" + l] = blog["close" + l];
    original["exported" + l] = blog["exported" + l];
    openData["close" + l] = false;
    openData["exported" + l] = false;
  }
  const restoreData = { ...original, ...restoreOverrides };
  blog.setAndSave(user, openData, function(err) {
    if (err) return callback(err);
    action(function(actionErr, actionResult) {
      blog.setAndSave(user, restoreData, function(restoreErr) {
        if (actionErr) return callback(actionErr);
        if (restoreErr) return callback(restoreErr);
        callback(null, actionResult);
      });
    });
  });
}

export default { withReopenedBlog };
