import _debug from "debug";
import async from "async";
import LogModuleReceiver from "../notification/LogModuleReceiver.js";
import FilterReceiver from "../notification/FilterReceiver.js";
import ExportReceiver from "../notification/exportReceiver.js";

import config from "../config.js";
const debug = _debug("OSMBC:notification:messageCenter");

// Blog fields that are purely operational (not editorial content) and
// therefore must not turn a setAndSave() call into a Postgres changes-log
// row that editors see in the blog history tab. See
// Blog.prototype.markAsExported in model/blog.js and
// notification/exportReceiver.js.
const OPERATIONAL_ONLY_BLOG_FIELDS = ["exportedBy"];

function isEditorialBlogChange(user, blog, change) {
  const keys = Object.keys(change).filter((k) => typeof change[k] !== "undefined");
  if (keys.length === 0) return false;
  return keys.some((k) => !OPERATIONAL_ONLY_BLOG_FIELDS.includes(k));
}



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



  messageCenter.global.registerReceiver(
    new FilterReceiver(new LogModuleReceiver(), { updateBlog: isEditorialBlogChange })
  );
  messageCenter.global.registerReceiver(new ExportReceiver());

  config.logger.info("Message Center initialised.");
  if (callback) return callback();
};




export default messageCenter;
