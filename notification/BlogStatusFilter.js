

import _debug from "debug";
import config from "../model/config.js";
const debug = _debug("OSMBC:notification:messageFilter");





class BlogStatusFilter {
  constructor(receiver, languages) {
    debug("BlogStatusFilter");
    this.receiver = receiver;
    if (!languages) languages = config.language.getLanguages();
    this.languages = languages;
  }

  sendInfo(object, callback) {
    debug("BlogStatusFilter.prototype.sendInfo");
    return callback();
  }

  updateArticle(user, article, change, cb) {
    debug("BlogStatusFilter.prototype.updateArticle");
    return cb();
  }

  addComment(user, article, comment, cb) {
    debug("BlogStatusFilter.prototype.addComment");
    return cb();
  }

  editComment(user, article, index, comment, cb) {
    debug("BlogStatusFilter.prototype.editComment");
    return cb();
  }

  updateBlog(user, blog, change, cb) {
    debug("BlogStatusFilter.prototype.updateBlog");
    this.receiver.updateBlog(user, blog, change, cb);
  }

  sendReviewStatus(user, blog, lang, status, cb) {
    debug("BlogStatusFilter.prototype.sendReviewStatus");
    if (this.languages[lang]) {
      this.receiver.sendReviewStatus(user, blog, lang, status, cb);
    } else return cb();
  }

  /**
   * Auto Close could not close a reviewed language (issue #1130).
   * @param {object} user actor of the rule
   * @param {object} blog the blog
   * @param {string} lang language id
   * @param {string[]} problems messages for the editors
   * @param {function(Error=)} cb called when done
   */
  sendCloseBlocked(user, blog, lang, problems, cb) {
    debug("BlogStatusFilter.prototype.sendCloseBlocked");
    if (this.languages[lang]) {
      this.receiver.sendCloseBlocked(user, blog, lang, problems, cb);
    } else return cb();
  }

  sendCloseStatus(user, blog, lang, status, cb) {
    debug("BlogStatusFilter.prototype.sendCloseStatus");
    if (this.languages[lang]) {
      this.receiver.sendCloseStatus(user, blog, lang, status, cb);
    } else return cb();
  }
}


BlogStatusFilter.prototype.updateArticle = function ucfUpdateArticle(user, article, change, cb) {
  debug("BlogStatusFilter.prototype.updateArticle");
  return cb();
};




export default BlogStatusFilter;

