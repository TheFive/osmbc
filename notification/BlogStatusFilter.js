

import _debug from "debug";
import config from "../model/config.js";
const debug = _debug("OSMBC:notification:messageFilter");





function BlogStatusFilter(receiver, languages) {
  debug("BlogStatusFilter");
  this.receiver = receiver;
  if (!languages) languages = config.language.getLanguages();
  this.languages = languages;
}


BlogStatusFilter.prototype.sendInfo = function(object, callback) {
  debug("BlogStatusFilter.prototype.sendInfo");
  return callback();
};
BlogStatusFilter.prototype.updateArticle = function ucfUpdateArticle(user, article, change, cb) {
  debug("BlogStatusFilter.prototype.updateArticle");
  return cb();
};
BlogStatusFilter.prototype.addComment = function addComment(user, article, comment, cb) {
  debug("BlogStatusFilter.prototype.addComment");
  return cb();
};
BlogStatusFilter.prototype.editComment = function editComment(user, article, index, comment, cb) {
  debug("BlogStatusFilter.prototype.editComment");
  return cb();
};
BlogStatusFilter.prototype.updateArticle = function ucfUpdateArticle(user, article, change, cb) {
  debug("BlogStatusFilter.prototype.updateArticle");
  return cb();
};

BlogStatusFilter.prototype.updateBlog = function ucfUpdateArticle(user, blog, change, cb) {
  debug("BlogStatusFilter.prototype.updateBlog");
  this.receiver.updateBlog(user, blog, change, cb);
};


BlogStatusFilter.prototype.sendReviewStatus = function sendReviewStatus(user, blog, lang, status, cb) {
  debug("BlogStatusFilter.prototype.sendReviewStatus");
  if (this.languages[lang]) {
    this.receiver.sendReviewStatus(user, blog, lang, status, cb);
  } else return cb();
};
BlogStatusFilter.prototype.sendCloseStatus = function sendCloseStatus(user, blog, lang, status, cb) {
  debug("BlogStatusFilter.prototype.sendCloseStatus");
  if (this.languages[lang]) {
    this.receiver.sendCloseStatus(user, blog, lang, status, cb);
  } else return cb();
};

module.exports = BlogStatusFilter;

