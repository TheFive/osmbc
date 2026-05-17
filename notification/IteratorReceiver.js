

import { eachOfSeries } from "async";
import _debug from "debug";
import logger from "../config.js";
import util from "../util/util.js";
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

    eachOfSeries(this.receiverMap, function (value, key, cb) {
      value.sendReviewStatus(user, blog, lang, status, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error(JSON.stringify(util.summarizeError(err, { operation: "sendReviewStatus" })));
    });
  }

  sendCloseStatus(user, blog, lang, status, callback) {
    debug("IteratorReceiver.prototype.sendCloseStatus");
    // first return callback then execute notification
    callback();
    eachOfSeries(this.receiverMap, function (value, key, cb) {
      value.sendCloseStatus(user, blog, lang, status, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error(JSON.stringify(util.summarizeError(err, { operation: "sendCloseStatus" })));
    });
  }

  updateArticle(user, article, change, callback) {
    debug("IteratorReceiver.prototype.updateArticle");
    // first return callback then execute notification
    callback();
    eachOfSeries(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.updateArticle(user, article, change, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error(JSON.stringify(util.summarizeError(err, { operation: "updateArticle" })));
    });
  }

  addComment(user, article, comment, callback) {
    debug("IteratorReceiver.prototype.addComment");
    // first return callback then execute notification
    callback();
    eachOfSeries(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.addComment(user, article, comment, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error(JSON.stringify(util.summarizeError(err, { operation: "addComment" })));
    });
  }

  editComment(user, article, index, comment, callback) {
    debug("IteratorReceiver.prototype.editComment");
    // first return callback then execute notification
    callback();
    eachOfSeries(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.editComment(user, article, index, comment, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error(JSON.stringify(util.summarizeError(err, { operation: "editComment" })));
    });
  }

  updateBlog(user, blog, change, callback) {
    debug("IteratorReceiver.prototype.updateBlog");
    // first return callback then execute notification
    callback();
    eachOfSeries(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.updateBlog(user, blog, change, cb);
    }, function (err) {
      // in case of error log it
      if (err) logger.error(JSON.stringify(util.summarizeError(err, { operation: "updateBlog" })));
    });
  }

  sendInfo(data, cb) {
    debug("IteratorReceiver.prototype.sendInfo");
    return cb();
  }
}






export default IteratorReceiver;
