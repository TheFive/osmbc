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
import language from "../../model/language.js";

export function withReopenedBlog(blog, user, action, callback) {
  const langlist = language.getLanguages();
  const original = { status: blog.status };
  const openData = { status: "edit" };
  for (const l in langlist) {
    original["close" + l] = blog["close" + l];
    original["exported" + l] = blog["exported" + l];
    openData["close" + l] = false;
    openData["exported" + l] = false;
  }
  blog.setAndSave(user, openData, function(err) {
    if (err) return callback(err);
    action(function(actionErr, actionResult) {
      blog.setAndSave(user, original, function(restoreErr) {
        if (actionErr) return callback(actionErr);
        if (restoreErr) return callback(restoreErr);
        callback(null, actionResult);
      });
    });
  });
}

export default { withReopenedBlog };
