

import { eachOfSeries } from "async";
import _debug from "debug";
import config from "../config.js";
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
      if (err) config.logger.error(JSON.stringify(util.summarizeError(err, { operation: "sendReviewStatus" })));
    });
  }

  /**
   * Auto Close could not close a reviewed language (issue #1130).
   * @param {object} user actor of the rule
   * @param {object} blog the blog
   * @param {string} lang language id
   * @param {string[]} problems messages for the editors
   * @param {function(Error=)} callback called when done
   */
  sendCloseBlocked(user, blog, lang, problems, callback) {
    debug("IteratorReceiver.prototype.sendCloseBlocked");
    // first return callback then execute notification
    callback();
    eachOfSeries(this.receiverMap, function (value, key, cb) {
      value.sendCloseBlocked(user, blog, lang, problems, cb);
    }, function (err) {
      // in case of error log it
      if (err) config.logger.error(JSON.stringify(util.summarizeError(err, { operation: "sendCloseBlocked" })));
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
      if (err) config.logger.error(JSON.stringify(util.summarizeError(err, { operation: "sendCloseStatus" })));
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
      if (err) config.logger.error(JSON.stringify(util.summarizeError(err, { operation: "updateArticle" })));
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
      if (err) config.logger.error(JSON.stringify(util.summarizeError(err, { operation: "addComment" })));
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
      if (err) config.logger.error(JSON.stringify(util.summarizeError(err, { operation: "editComment" })));
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
      if (err) config.logger.error(JSON.stringify(util.summarizeError(err, { operation: "updateBlog" })));
    });
  }

  sendInfo(data, cb) {
    debug("IteratorReceiver.prototype.sendInfo");
    return cb();
  }
}






export default IteratorReceiver;
