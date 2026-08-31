// Listens on the same messageCenter `updateBlog` broadcast every
// setAndSave() call produces (same mechanism MailReceiver/SlackReceiver
// use), and reacts only when a change actually touches `exportedBy` - see
// Blog.prototype.markAsExported in model/blog.js. Relevant lang(s) get
// written to the export text log (notification/exportLogWriter.js).
//
// Deliberately NOT wired through the blog's normal Postgres changes-log:
// marking a blog as exported is an operational record for admins, not
// editorial content. LogModuleReceiver is wrapped in a FilterReceiver
// instead (see notification/messageCenter.js) so this doesn't ALSO end up
// in the changes-log editors see in the blog history tab, and doesn't
// trigger the mail/Slack "blog changed" notifications either (those two
// receivers already decide based on `change.status`, which a
// markAsExported call never sets).

import exportLogWriter from "./exportLogWriter.js";
import _debug from "debug";

const debug = _debug("OSMBC:notification:exportReceiver");

class ExportReceiver {
  sendInfo(object, cb) { return cb(); }
  updateArticle(user, article, change, cb) { return cb(); }
  sendReviewStatus(user, blog, lang, status, cb) { return cb(); }
  sendCloseStatus(user, blog, lang, status, cb) { return cb(); }
  addComment(user, article, text, cb) { return cb(); }
  editComment(user, article, index, text, cb) { return cb(); }

  updateBlog(user, blog, change, cb) {
    debug("ExportReceiver::updateBlog");
    if (!change.exportedBy || typeof change.exportedBy !== "object") return cb();

    for (const exportProfile in change.exportedBy) {
      const newMarkers = change.exportedBy[exportProfile] || {};
      const previousMarkers = (blog.exportedBy && blog.exportedBy[exportProfile]) || {};
      for (const lang in newMarkers) {
        if (newMarkers[lang] === previousMarkers[lang]) continue;
        exportLogWriter.logMarkAsExported({ user: user.OSMUser, blog: blog.name, exportProfile, lang });
      }
    }
    return cb();
  }
}

export default ExportReceiver;
