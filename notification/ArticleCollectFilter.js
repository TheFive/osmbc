"use strict";

const debug = require("debug")("OSMBC:notification:messageFilter");





function ArticleCollectFilter(receiver) {
  debug("ArticleCollectFilter");
  this.receiver = receiver;
}

ArticleCollectFilter.prototype.sendInfo = function(object, callback) {
  debug("ArticleCollectFilter.prototype.sendInfo");
  return callback();
};

ArticleCollectFilter.prototype.updateArticle = function ucfUpdateArticle(user, article, change, cb) {
  debug("ArticleCollectFilter.prototype.updateArticle");
  if (change.collection && change.collection === article.collection) return cb();
  this.receiver.updateArticle(user, article, change, cb);
};

ArticleCollectFilter.prototype.updateBlog = function ucfUpdateArticle(user, blog, change, cb) {
  debug("ArticleCollectFilter.prototype.updateBlog");
  return cb();
};
ArticleCollectFilter.prototype.addComment = function addComment(user, article, comment, cb) {
  debug("ArticleCollectFilter.prototype.addComment");
  this.receiver.addComment(user, article, comment, cb);
};
ArticleCollectFilter.prototype.editComment = function editComment(user, article, index, comment, cb) {
  debug("ArticleCollectFilter.prototype.editComment");
  this.receiver.editComment(user, article, index, comment, cb);
};


ArticleCollectFilter.prototype.sendReviewStatus = function sendReviewStatus(user, blog, lang, status, cb) {
  debug("ArticleCollectFilter.prototype.sendReviewStatus");
  return cb();
};
ArticleCollectFilter.prototype.sendCloseStatus = function sendCloseStatus(user, blog, lang, status, cb) {
  debug("ArticleCollectFilter.prototype.sendCloseStatus");
  return cb();
};

module.exports = ArticleCollectFilter;

