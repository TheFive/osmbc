"use strict";

var async         = require("../util/async_wrap.js");
var debug         = require("debug")("OSMBC:notification:iteratorReceiver");


function IteratorReceiver(receiverMap) {
  debug("IteratorReceiver");
  this.receiverMap = receiverMap;
}

IteratorReceiver.prototype.sendReviewStatus = function sendReviewStatus(user, blog, lang, status, callback) {
  debug("IteratorReceiver.prototype.sendReviewStatus");
  async.eachOf(this.receiverMap, function(value, key, cb) {
    value.sendReviewStatus(user, blog, lang, status, cb);
  }, function(err) {
    return callback(err);
  });
};

IteratorReceiver.prototype.sendCloseStatus = function sendCloseStatus(user, blog, lang, status, callback) {
  debug("IteratorReceiver.prototype.sendCloseStatus");
  async.eachOf(this.receiverMap, function(value, key, cb) {
    value.sendCloseStatus(user, blog, lang, status, cb);
  }, function(err) {
    return callback(err);
  });
};

IteratorReceiver.prototype.updateArticle = function murUpdateArticle(user, article, change, callback) {
  debug("IteratorReceiver.prototype.updateArticle");
  async.eachOf(this.receiverMap, function(value, key, cb) {
    debug("forEachOf Item: " + key);
    value.updateArticle(user, article, change, cb);
  }, function(err) {
    return callback(err);
  });
};
IteratorReceiver.prototype.addComment = function addComment(user, article, comment, callback) {
  debug("IteratorReceiver.prototype.addComment");
  async.eachOf(this.receiverMap, function(value, key, cb) {
    debug("forEachOf Item: " + key);
    value.addComment(user, article, comment, cb);
  }, function(err) {
    return callback(err);
  });
};
IteratorReceiver.prototype.editComment = function editComment(user, article, index, comment, callback) {
  debug("IteratorReceiver.prototype.editComment");
  async.eachOf(this.receiverMap, function(value, key, cb) {
    debug("forEachOf Item: " + key);
    value.editComment(user, article, index, comment, cb);
  }, function(err) {
    return callback(err);
  });
};
IteratorReceiver.prototype.updateBlog = function murUpdateBlog(user, blog, change, callback) {
  debug("IteratorReceiver.prototype.updateBlog");
  async.eachOf(this.receiverMap, function(value, key, cb) {
    debug("forEachOf Item: " + key);
    value.updateBlog(user, blog, change, cb);
  }, function(err) {
    return callback(err);
  });
};

IteratorReceiver.prototype.sendInfo = function sendInfo(data, cb) {
  debug("IteratorReceiver.prototype.sendInfo");
  return cb();
};


module.exports = IteratorReceiver;
