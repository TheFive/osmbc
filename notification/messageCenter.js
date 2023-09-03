import _debug from "debug";
import async from "async";
import LogModuleReceiver from "../notification/LogModuleReceiver.js";

import config from "../config.js";
const debug = _debug("OSMBC:notification:messageCenter");



function MessageCenter() {
  debug("MessageCenter::MessageCenter");
  this.receiverList = [];
}

MessageCenter.prototype.sendInfo = function(object, callback) {
  debug("MessageCenter::sendInfo");
  async.each(this.receiverList, function sendIt(element, cb) {
    element.sendInfo(object, cb);
  }, function final(err) { callback(err); });
};

MessageCenter.prototype.updateArticle = function (user, article, change, callback) {
  debug("MessageCenter::updateArticle");
  async.each(this.receiverList, function sendIt(element, cb) {
    element.updateArticle(user, article, change, cb);
  }, function final(err) { callback(err); });
};
MessageCenter.prototype.updateBlog = function (user, blog, change, callback) {
  debug("MessageCenter::updateBlog");
  async.each(this.receiverList, function sendIt(element, cb) {
    element.updateBlog(user, blog, change, cb);
  }, function final(err) { callback(err); });
};
MessageCenter.prototype.sendReviewStatus = function(user, blog, lang, status, callback) {
  debug("MessageCenter.prototype.sendReviewStatus");
  async.each(this.receiverList, function sendIt(element, cb) {
    element.sendReviewStatus(user, blog, lang, status, cb);
  }, function final(err) { callback(err); });
};
MessageCenter.prototype.sendCloseStatus = function(user, blog, lang, status, callback) {
  debug("MessageCenter.prototype.sendCloseStatus");
  async.each(this.receiverList, function sendIt(element, cb) {
    element.sendCloseStatus(user, blog, lang, status, cb);
  }, function final(err) { callback(err); });
};

MessageCenter.prototype.registerReceiver = function(receiver) {
  debug("MessageCenter::registerReceiver");
  this.receiverList.push(receiver);
};

MessageCenter.prototype.addComment = function addComment(user, article, text, callback) {
  debug("MessageCenter.prototype.addComment");
  async.each(this.receiverList, function sendIt(element, cb) {
    element.addComment(user, article, text, cb);
  }, function final(err) { callback(err); });
};
MessageCenter.prototype.editComment = function editComment(user, article, index, text, callback) {
  debug("MessageCenter.prototype.addComment");
  async.each(this.receiverList, function sendIt(element, cb) {
    element.editComment(user, article, index, text, cb);
  }, function final(err) { callback(err); });
};




const messageCenter = {
  initialise: initialise,
  global: null
};

function initialise(callback) {
  debug("initialise");
  if (messageCenter.global) {
    if (callback) return callback();
    return;
  }
  messageCenter.global = new MessageCenter();



  messageCenter.global.registerReceiver(new LogModuleReceiver());

  config.logger.info("Message Center initialised.");
  if (callback) return callback();
};




export default messageCenter;
