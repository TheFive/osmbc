import util from "../util/util.js";
import { classifyArticleChange, articleChangeWanted, channelArticleSettings } from "./articleChangeFilter.js";

import _debug from "debug";
const debug = _debug("OSMBC:notification:messageFilter");


/* ConfigFilter Class
*
* ConfigFilter class is filtering the OSMBC Notification Stream
* it requires a config object with the following properties
*
* notifyNewCollection
*   true: every new submission (first collection of an article) is
*   forwarded, "guest": only submissions by guests, "editor": only
*   submissions by non-guests
* notifyCollectionChange
*   true / "guest" / "editor" for changed collections; missing = same as
*   notifyNewCollection (which covered both before issue #1170)
* notifyGuestTextChange
*   true: text changes (markdown) made by guests are forwarded
* notifyAllComment
*   if true every comment is forewarded
* notifyComment
*   if given, this is interpreted as a list of user, for that comments has to be forewarded
* notifyBlogStatusChange
*   if "true" all notifications regarding blog status changes are forewarded
* notifyBlogLanguageStatusChange
*   if given, this is interpreted as a list of languages, for that status changes are forewarded
* */


function languageInFilter(filter, lang) {
  if (typeof filter === "string") {
    if (filter.toLowerCase() === "all") return true;
  }
  if (Array.isArray(filter)) {
    if (filter.includes(lang)) return true;
  }
  return false;
}

class ConfigFilter {
  constructor(config, receiver) {
    debug("ConfigFilter");
    this.config = config;
    this.receiver = receiver;
  }

  /**
   * A changed user or configuration: no message for a channel.
   * @param {object} data the change log entry
   * @param {function(Error=)} cb called at once
   */
  sendInfo(data, cb) {
    return cb();
  }

  /**
   * Passes an article change on if the channel wants it, see the
   * notifyNewCollection / notifyCollectionChange / notifyGuestTextChange
   * keys above (issue #1170).
   * @param {object} user the user who made the change
   * @param {object} article the article before the change
   * @param {object} change the changed fields
   * @param {function(Error=)} cb called when done
   */
  updateArticle(user, article, change, cb) {
    debug("ConfigFilter::updateArticle");
    const kind = classifyArticleChange(user, article, change);
    if (!articleChangeWanted(kind, channelArticleSettings(this.config))) return cb();
    debug("Notification because of article change");
    this.receiver.updateArticle(user, article, change, cb);
  }

  addComment(user, article, comment, cb) {
    debug("ConfigFilter::addComment");
    let notify = false;

    // check Collection
    if (util.isTrue(this.config.notifyAllComment)) {
      notify = true;
    }
    let userList = [];
    if (this.config.notifyComment) userList = this.config.notifyComment;
    for (let i = 0; i < userList.length; i++) {
      if (util.mentions(comment, userList[i])) {
        notify = true;
        debug("Notification because comment for @" + userList[i]);
      }
    }
    if (!notify) return cb();
    this.receiver.addComment(user, article, comment, cb);
  }

  editComment(user, article, index, comment, cb) {
    debug("ConfigFilter::addComment");
    let notify = false;

    // check Collection
    if (util.isTrue(this.config.notifyAllComment)) {
      notify = true;
    }
    let userList = [];
    if (this.config.notifyComment) userList = this.config.notifyComment;
    for (let i = 0; i < userList.length; i++) {
      if (util.mentions(comment, userList[i])) {
        notify = true;
        debug("Notification because comment for @" + userList[i]);
      }
    }
    if (!notify) return cb();
    this.receiver.editComment(user, article, index, comment, cb);
  }

  updateBlog(user, blog, change, cb) {
    debug("ConfigFilter::updateBlog");
    let notify = false;


    // check Collection
    if (util.isTrue(this.config.notifyBlogStatusChange)) {
      if (change.status && change.status !== blog.status && change.status !== "closed") {
        notify = true;
      }
    }

    if (!notify) return cb();
    this.receiver.updateBlog(user, blog, change, cb);
  }

  sendReviewStatus(user, blog, lang, status, cb) {
    debug("ConfigFilter::sendReviewStatus");
    if (languageInFilter(this.config.notifyBlogLanguageStatusChange, lang)) {
      debug("Send out notification");
      return this.receiver.sendReviewStatus(user, blog, lang, status, cb);
    }
    return cb();
  }

  /**
   * Auto Close could not close a reviewed language (issue #1130).
   * @param {object} user actor of the rule
   * @param {object} blog the blog
   * @param {string} lang language id
   * @param {string[]} problems messages for the editors
   * @param {function(Error=)} cb called when done
   */
  sendCloseBlocked(user, blog, lang, problems, cb) {
    debug("ConfigFilter::sendCloseBlocked");
    if (languageInFilter(this.config.notifyBlogLanguageStatusChange, lang) ||
      languageInFilter(this.config.notifyBlogLanguageClosed, lang)) {
      return this.receiver.sendCloseBlocked(user, blog, lang, problems, cb);
    }
    return cb();
  }

  sendCloseStatus(user, blog, lang, status, cb) {
    debug("ConfigFilter::sendCloseStatus");
    if (languageInFilter(this.config.notifyBlogLanguageStatusChange, lang)) {
      debug("Send out notification");
      return this.receiver.sendCloseStatus(user, blog, lang, status, cb);
    }
    if (languageInFilter(this.config.notifyBlogLanguageClosed, lang)) {
      debug("Send out notification");
      return this.receiver.sendCloseStatus(user, blog, lang, status, cb);
    }
    return cb();
  }
}









export default ConfigFilter;

