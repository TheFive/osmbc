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
// Blog.prototype.markAsExported / markAsAutoTranslated in model/blog.js and
// notification/exportReceiver.js.
const OPERATIONAL_ONLY_BLOG_FIELDS = ["exportedBy", "autoTranslated", "closeBlockedNotified"];

function isEditorialBlogChange(user, blog, change) {
  const keys = Object.keys(change).filter((k) => typeof change[k] !== "undefined");
  if (keys.length === 0) return false;
  return keys.some((k) => !OPERATIONAL_ONLY_BLOG_FIELDS.includes(k));
}



/**
 * The notification stream of OSMBC. Models report every editorial change
 * here (usually through setAndSave); the message center passes it on to
 * every registered receiver: changes log, export marker, Mattermost
 * channels, mails and direct messages. Each receiver decides itself
 * whether the event is relevant for it.
 *
 * Every method waits for all receivers and calls back with the first error,
 * so a failing receiver does not keep the others from getting the event.
 * The method list is RECEIVER_METHODS in FilterReceiver.js; every receiver
 * implements all of them.
 */
class MessageCenter {
  constructor() {
    this.receiverList = [];
  }

  /**
   * Adds a receiver; it gets every event from now on.
   * @param {object} receiver implements all RECEIVER_METHODS
   */
  registerReceiver(receiver) {
    debug("MessageCenter::registerReceiver");
    this.receiverList.push(receiver);
  }

  /**
   * A changed user or configuration, for the changes log.
   * @param {object} data the change log entry (oid, user, table, property, from, to)
   * @param {function(Error=)} callback called when all receivers are done
   */
  sendInfo(data, callback) {
    this._sendToAll("sendInfo", [data], callback);
  }

  /**
   * An article was created or changed.
   * @param {object} user who changed it
   * @param {object} article the article before the change
   * @param {object} change the changed fields
   * @param {function(Error=)} callback called when all receivers are done
   */
  updateArticle(user, article, change, callback) {
    this._sendToAll("updateArticle", [user, article, change], callback);
  }

  /**
   * A blog was created or changed.
   * @param {object} user who changed it
   * @param {object} blog the blog before the change
   * @param {object} change the changed fields
   * @param {function(Error=)} callback called when all receivers are done
   */
  updateBlog(user, blog, change, callback) {
    this._sendToAll("updateBlog", [user, blog, change], callback);
  }

  /**
   * The review state of a language changed (review started, comment, exported).
   * @param {object} user who did it
   * @param {object} blog the blog
   * @param {string} lang language id
   * @param {string} status the review comment or state marker
   * @param {function(Error=)} callback called when all receivers are done
   */
  sendReviewStatus(user, blog, lang, status, callback) {
    this._sendToAll("sendReviewStatus", [user, blog, lang, status], callback);
  }

  /**
   * A language was closed or reopened.
   * @param {object} user who did it
   * @param {object} blog the blog
   * @param {string} lang language id
   * @param {boolean} status true = closed
   * @param {function(Error=)} callback called when all receivers are done
   */
  sendCloseStatus(user, blog, lang, status, callback) {
    this._sendToAll("sendCloseStatus", [user, blog, lang, status], callback);
  }

  /**
   * Auto Close could not close a reviewed language (issue #1130).
   * @param {object} user actor of the rule
   * @param {object} blog the blog
   * @param {string} lang language id
   * @param {string[]} problems messages for the editors
   * @param {function(Error=)} callback called when all receivers are done
   */
  sendCloseBlocked(user, blog, lang, problems, callback) {
    this._sendToAll("sendCloseBlocked", [user, blog, lang, problems], callback);
  }

  /**
   * A comment was added to an article.
   * @param {object} user who wrote it
   * @param {object} article the article
   * @param {string} text the comment
   * @param {function(Error=)} callback called when all receivers are done
   */
  addComment(user, article, text, callback) {
    this._sendToAll("addComment", [user, article, text], callback);
  }

  /**
   * A comment of an article was edited.
   * @param {object} user who edited it
   * @param {object} article the article
   * @param {number} index position of the comment
   * @param {string} text the new comment
   * @param {function(Error=)} callback called when all receivers are done
   */
  editComment(user, article, index, text, callback) {
    this._sendToAll("editComment", [user, article, index, text], callback);
  }

  /**
   * Hands the event to all receivers in parallel and calls back when all
   * are done, with the first error if any failed.
   * @param {string} method one of RECEIVER_METHODS
   * @param {Array} args the event arguments without the callback
   * @param {function(Error=)} callback called when all receivers are done
   */
  _sendToAll(method, args, callback) {
    debug("MessageCenter::%s", method);
    let firstError = null;
    async.each(this.receiverList, function (receiver, next) {
      receiver[method](...args, function (err) {
        if (err && !firstError) firstError = err;
        next();
      });
    }, function () { callback(firstError); });
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
