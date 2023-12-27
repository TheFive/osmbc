import _debug from "debug";
import async from "async";
import LogModuleReceiver from "../notification/LogModuleReceiver.js";

import config from "../config.js";
const debug = _debug("OSMBC:notification:messageCenter");



class MessageCenter {
  constructor() {
    debug("MessageCenter::MessageCenter");
    this.receiverList = [];
  }

  sendInfo(object, callback) {
    debug("MessageCenter::sendInfo");
    async.each(this.receiverList, function sendIt(element, cb) {
      element.sendInfo(object, cb);
    }, function final(err) { callback(err); });
  }

  updateArticle(user, article, change, callback) {
    debug("MessageCenter::updateArticle");
    async.each(this.receiverList, function sendIt(element, cb) {
      element.updateArticle(user, article, change, cb);
    }, function final(err) { callback(err); });
  }

  updateBlog(user, blog, change, callback) {
    debug("MessageCenter::updateBlog");
    async.each(this.receiverList, function sendIt(element, cb) {
      element.updateBlog(user, blog, change, cb);
    }, function final(err) { callback(err); });
  }

  sendReviewStatus(user, blog, lang, status, callback) {
    debug("MessageCenter.prototype.sendReviewStatus");
    async.each(this.receiverList, function sendIt(element, cb) {
      element.sendReviewStatus(user, blog, lang, status, cb);
    }, function final(err) { callback(err); });
  }

  sendCloseStatus(user, blog, lang, status, callback) {
    debug("MessageCenter.prototype.sendCloseStatus");
    async.each(this.receiverList, function sendIt(element, cb) {
      element.sendCloseStatus(user, blog, lang, status, cb);
    }, function final(err) { callback(err); });
  }

  registerReceiver(receiver) {
    debug("MessageCenter::registerReceiver");
    this.receiverList.push(receiver);
  }

  addComment(user, article, text, callback) {
    debug("MessageCenter.prototype.addComment");
    async.each(this.receiverList, function sendIt(element, cb) {
      element.addComment(user, article, text, cb);
    }, function final(err) { callback(err); });
  }

  editComment(user, article, index, text, callback) {
    debug("MessageCenter.prototype.addComment");
    async.each(this.receiverList, function sendIt(element, cb) {
      element.editComment(user, article, index, text, cb);
    }, function final(err) { callback(err); });
  }
}








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
