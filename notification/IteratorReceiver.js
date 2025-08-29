

import { eachOf } from "async";
import _debug from "debug";
import logger from "../config.js";
const debug = _debug("OSMBC:notification:iteratorReceiver");


class IteratorReceiver {
  constructor(receiverMap) {
    debug("IteratorReceiver");
    this.receiverMap = receiverMap;
  }

  sendReviewStatus(user, blog, lang, status, callback) {
    debug("IteratorReceiver.prototype.sendReviewStatus");
    // first return callback then execute notification
    callback();

    eachOf(this.receiverMap, function (value, key, cb) {
      value.sendReviewStatus(user, blog, lang, status, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error("Error in sendReviewStatus " + err.message());
    });
  }

  sendCloseStatus(user, blog, lang, status, callback) {
    debug("IteratorReceiver.prototype.sendCloseStatus");
    // first return callback then execute notification
    callback();
    eachOf(this.receiverMap, function (value, key, cb) {
      value.sendCloseStatus(user, blog, lang, status, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error("Error in sendReviewStatus " + err.message());
    });
  }

  updateArticle(user, article, change, callback) {
    debug("IteratorReceiver.prototype.updateArticle");
    // first return callback then execute notification
    callback();
    eachOf(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.updateArticle(user, article, change, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error("Error in sendReviewStatus " + err.message());
      console.log("------------------------------");
      console.log("updated article");
      console.dir(err);
      console.log("------------------------");
    });
  }

  addComment(user, article, comment, callback) {
    debug("IteratorReceiver.prototype.addComment");
    // first return callback then execute notification
    callback();
    eachOf(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.addComment(user, article, comment, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error("Error in sendReviewStatus " + err.message());
    });
  }

  editComment(user, article, index, comment, callback) {
    debug("IteratorReceiver.prototype.editComment");
    // first return callback then execute notification
    callback();
    eachOf(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.editComment(user, article, index, comment, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error("Error in sendReviewStatus " + err.message());
    });
  }

  updateBlog(user, blog, change, callback) {
    debug("IteratorReceiver.prototype.updateBlog");
    // first return callback then execute notification
    callback();
    eachOf(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.updateBlog(user, blog, change, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error("Error in sendReviewStatus " + err.message());
    });
  }

  sendInfo(data, cb) {
    debug("IteratorReceiver.prototype.sendInfo");
    return cb();
  }
}






export default IteratorReceiver;
