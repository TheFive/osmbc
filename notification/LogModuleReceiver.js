"use strict";

const debug     = require("debug")("OSMBC:notification:LogModuleReceiver");
const async     = require("../util/async_wrap.js");
const assert    = require("assert");
const logModule = require("../model/logModule.js");






function LogModuleReceiver() {}

LogModuleReceiver.prototype.sendInfo = function(object, cb) {
  debug("LogModuleReceiver::sendInfo");
  logModule.log(object, cb);
};

LogModuleReceiver.prototype.updateArticle = function(user, article, change, cb) {
  debug("LogModuleReceiver::updateArticle");
  assert(article.id);
  assert(article.id !== 0);
  assert(typeof (user) === "object");
  assert(typeof user.OSMUser === "string");
  let logblog = article.blog;
  if (change.blog) logblog = change.blog;
  let timestamp = new Date();
  if (change.timestamp) timestamp = change.timestamp;
  async.eachOfSeries(change, function setAndSaveEachOf(value, key, cbEachOf) {
    // There is no Value for the key, so do nothing
    if (typeof (value) === "undefined") return cbEachOf();

    // The Value to be set, is the same then in the object itself
    // so do nothing
    if (!change.action && value === article[key]) return cbEachOf();
    if (typeof (article[key]) === "undefined" && value === "") return cbEachOf();

    async.series([
      function(cb) {
        logModule.log({
          oid: article.id,
          blog: logblog,
          user: user.OSMUser,
          table: "article",
          property: key,
          from: article[key],
          to: value,
          timestamp: timestamp
        }, cb);
      }
    ], function(err) {
      cbEachOf(err);
    });
  }, function finalFunction(err) { cb(err); });
};


LogModuleReceiver.prototype.updateBlog = function(user, blog, change, cb) {
  debug("LogModuleReceiver::updateBlog");

  assert(blog.id);
  assert(blog.id !== 0);
  assert(typeof (user) === "object");
  assert(typeof user.OSMUser === "string");
  const timestamp = new Date();
  async.eachOfSeries(change, function setAndSaveEachOf(value, key, cbEachOf) {
    debug("setAndSaveEachOf");
    // There is no Value for the key, so do nothing

    if (typeof (value) === "undefined") return cbEachOf();
    // The Value to be set, is the same then in the object itself

    // so do nothing
    if (value === blog[key]) return cbEachOf();

    if (typeof (blog[key]) === "undefined" && value === "") return cbEachOf();

    if (typeof (value) === "object") {
      if (JSON.stringify(value) === JSON.stringify(blog[key])) return cbEachOf();
    }

    async.series([
      function writeLog(cb) {
        debug("writeLog");
        logModule.log({
          oid: blog.id,
          blog: blog.name,
          user: user.OSMUser,
          table: "blog",
          property: key,
          from: blog[key],
          to: value,
          timestamp: timestamp
        }, cb);
      }
    ], function(err) {
      cbEachOf(err);
    });
  }, function finalFunction(err) { cb(err); });
};

LogModuleReceiver.prototype.sendReviewStatus = function sendReviewStatus(user, blog, lang, status, cb) {
  debug("LogModuleReceiver.prototype.sendReviewStatus");
  assert(blog.id);
  assert(blog.id !== 0);
  assert(typeof (user) === "object");
  assert(typeof user.OSMUser === "string");
  assert(user.OSMUser);
  const timestamp = new Date();
  logModule.log({
    oid: blog.id,
    blog: blog.name,
    user: user.OSMUser,
    table: "blog",
    property: "reviewComment" + lang,
    from: "Add",
    to: status,
    timestamp: timestamp
  }, cb);
};
LogModuleReceiver.prototype.sendCloseStatus = function sendCloseStatus(user, blog, lang, status, cb) {
  debug("LogModuleReceiver.prototype.sendCloseStatus");
  assert(blog.id);
  assert(blog.id !== 0);
  assert(typeof (user) === "object");
  assert(typeof user.OSMUser === "string");
  assert(user.OSMUser);
  const timestamp = new Date();
  logModule.log({
    oid: blog.id,
    blog: blog.name,
    user: user.OSMUser,
    table: "blog",
    property: "close" + lang,
    to: status,
    timestamp: timestamp
  }, cb);
};

LogModuleReceiver.prototype.editComment = function editComment(user, article, index, text, callback) {
  debug("LogModuleReceiver.prototype.editComment");
  assert(article.id);
  assert(article.id !== 0);
  assert(typeof (user) === "object");
  assert(typeof user.OSMUser === "string");
  assert(user.OSMUser);
  const timestamp = new Date();
  logModule.log({
    oid: article.id,
    blog: article.blog,
    user: user.OSMUser,
    table: "article",
    property: "comment" + index,
    from: article.commentList[index].text,
    to: text,
    timestamp: timestamp
  }, callback);
};

LogModuleReceiver.prototype.addComment = function addComment(user, article, text, callback) {
  debug("LogModuleReceiver.prototype.addComment");
  assert(article.id);
  assert(article.id !== 0);
  assert(typeof (user) === "object");
  assert(typeof user.OSMUser === "string");
  assert(user.OSMUser);
  const timestamp = new Date();
  logModule.log({
    oid: article.id,
    blog: article.blog,
    user: user.OSMUser,
    table: "article",
    property: "comment" + article.commentList.length,
    from: "",
    to: text,
    timestamp: timestamp
  }, callback);
};

module.exports = LogModuleReceiver;
