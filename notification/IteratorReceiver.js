

import { eachOf } from "async";
import _debug from "debug";
const debug = _debug("OSMBC:notification:iteratorReceiver");


class IteratorReceiver {
  constructor(receiverMap) {
    debug("IteratorReceiver");
    this.receiverMap = receiverMap;
  }

  sendReviewStatus(user, blog, lang, status, callback) {
    debug("IteratorReceiver.prototype.sendReviewStatus");
    eachOf(this.receiverMap, function (value, key, cb) {
      value.sendReviewStatus(user, blog, lang, status, cb);
    }, function (err) {
      return callback(err);
    });
  }

  sendCloseStatus(user, blog, lang, status, callback) {
    debug("IteratorReceiver.prototype.sendCloseStatus");
    eachOf(this.receiverMap, function (value, key, cb) {
      value.sendCloseStatus(user, blog, lang, status, cb);
    }, function (err) {
      return callback(err);
    });
  }

  updateArticle(user, article, change, callback) {
    debug("IteratorReceiver.prototype.updateArticle");
    eachOf(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.updateArticle(user, article, change, cb);
    }, function (err) {
      return callback(err);
    });
  }

  addComment(user, article, comment, callback) {
    debug("IteratorReceiver.prototype.addComment");
    eachOf(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.addComment(user, article, comment, cb);
    }, function (err) {
      return callback(err);
    });
  }

  editComment(user, article, index, comment, callback) {
    debug("IteratorReceiver.prototype.editComment");
    eachOf(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.editComment(user, article, index, comment, cb);
    }, function (err) {
      return callback(err);
    });
  }

  updateBlog(user, blog, change, callback) {
    debug("IteratorReceiver.prototype.updateBlog");
    eachOf(this.receiverMap, function (value, key, cb) {
      debug("forEachOf Item: " + key);
      value.updateBlog(user, blog, change, cb);
    }, function (err) {
      return callback(err);
    });
  }

  sendInfo(data, cb) {
    debug("IteratorReceiver.prototype.sendInfo");
    return cb();
  }
}






export default IteratorReceiver;
