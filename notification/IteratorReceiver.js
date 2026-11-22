import { eachOfSeries } from "async";
import _debug from "debug";
import config from "../config.js";
import util from "../util/util.js";
const debug = _debug("OSMBC:notification:iteratorReceiver");


/**
 * Passes every notification event on to a map of receivers, one after the
 * other: one receiver per Mattermost channel (slackReceiver.js) or per user
 * (mailReceiver.js). The map can be replaced at any time via `receiverMap`.
 *
 * Fire and forget: every method calls back at once and sends afterwards,
 * so saving an article does not wait for mails and webhooks. A receiver
 * that fails (error in its callback or an exception) is logged with the
 * event name and does not stop the receivers after it. Errors are not
 * shown to anyone but the server log yet (issue #1182).
 */
class IteratorReceiver {
  /**
   * @param {Object<string, object>} receiverMap receivers by a name used in
   *   the error log; each implements all receiver methods (FilterReceiver.js)
   */
  constructor(receiverMap) {
    this.receiverMap = receiverMap;
  }

  /**
   * A changed user or configuration (logged in the changes table by
   * LogModuleReceiver). Channels and users get no message for it.
   * @param {object} data the change log entry
   * @param {function(Error=)} callback called at once
   */
  sendInfo(data, callback) {
    this._sendToAll("sendInfo", [data], callback);
  }

  /**
   * An article was created or changed.
   * @param {object} user who changed it
   * @param {object} article the article before the change
   * @param {object} change the changed fields
   * @param {function(Error=)} callback called at once
   */
  updateArticle(user, article, change, callback) {
    this._sendToAll("updateArticle", [user, article, change], callback);
  }

  /**
   * A blog was created or changed.
   * @param {object} user who changed it
   * @param {object} blog the blog before the change
   * @param {object} change the changed fields
   * @param {function(Error=)} callback called at once
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
   * @param {function(Error=)} callback called at once
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
   * @param {function(Error=)} callback called at once
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
   * @param {function(Error=)} callback called at once
   */
  sendCloseBlocked(user, blog, lang, problems, callback) {
    this._sendToAll("sendCloseBlocked", [user, blog, lang, problems], callback);
  }

  /**
   * A comment was added to an article.
   * @param {object} user who wrote it
   * @param {object} article the article
   * @param {string} comment the text
   * @param {function(Error=)} callback called at once
   */
  addComment(user, article, comment, callback) {
    this._sendToAll("addComment", [user, article, comment], callback);
  }

  /**
   * A comment of an article was edited.
   * @param {object} user who edited it
   * @param {object} article the article
   * @param {number} index position of the comment
   * @param {string} comment the new text
   * @param {function(Error=)} callback called at once
   */
  editComment(user, article, index, comment, callback) {
    this._sendToAll("editComment", [user, article, index, comment], callback);
  }

  /**
   * Calls back at once, then hands the event to each receiver in turn;
   * logs a failing receiver and goes on with the next.
   * @param {string} method one of RECEIVER_METHODS
   * @param {Array} args the event arguments without the callback
   * @param {function()} callback called at once
   */
  _sendToAll(method, args, callback) {
    debug("IteratorReceiver::%s", method);
    callback();
    eachOfSeries(this.receiverMap, function (receiver, name, next) {
      let done = false;
      const logAndContinue = function (err) {
        if (err) logFailure(method, name, err);
        // a receiver that calls back and throws afterwards must not continue twice
        if (done) return;
        done = true;
        next();
      };
      try {
        receiver[method](...args, logAndContinue);
      } catch (err) {
        logAndContinue(err);
      }
    });
  }
}

function logFailure(method, receiverName, err) {
  config.logger.error(JSON.stringify(util.summarizeError(err, { operation: method, receiver: receiverName })));
}


export default IteratorReceiver;
