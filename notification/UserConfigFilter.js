

import { classifyArticleChange, articleChangeWanted, userArticleSettings } from "./articleChangeFilter.js";
import _debug from "debug";
import util from "../util/util.js";

import { strict as assert } from "assert";
const debug = _debug("OSMBC:notification:messageFilter");


class UserConfigFilter {
  constructor(user, receiver) {
    debug("UserConfigFilter");

    this.user = user;
    this.receiver = receiver;
    assert(this.user.OSMUser);
    assert(this.user.access);
  }

  /**
   * A changed user or configuration: no message for a user.
   * @param {object} data the change log entry
   * @param {function(Error=)} cb called at once
   */
  sendInfo(data, cb) {
    return cb();
  }

  /**
   * Passes an article change on if the user wants it: new submission,
   * collection change (each "all" or "only by guests") or a text change by
   * a guest (issue #1170). Only full users get article changes; guests are
   * only informed about comments they are addressed to.
   * @param {object} user the user who made the change
   * @param {object} article the article before the change
   * @param {object} change the changed fields
   * @param {function(Error=)} cb called when done
   */
  updateArticle(user, article, change, cb) {
    debug("UserConfigFilter::updateArticle");
    if (this.user.access !== "full") return cb();
    const kind = classifyArticleChange(user, article, change);
    if (!articleChangeWanted(kind, userArticleSettings(this.user))) return cb();
    debug("Notification because of article change");
    this.receiver.updateArticle(user, article, change, cb);
  }

  addComment(user, article, comment, cb) {
    debug("UserConfigFilter::addComment");
    let sendMail = false;

    // check Collection
    if (this.user.mailAllComment === "true") {
      sendMail = true;
    }
    let checkComment = comment;
    let userList = [];
    if (this.user.mailComment) userList = this.user.mailComment;

    // if mailCommentGeneral search for mention in all comments of an article
    // and if user has written one comment in the list, so he has to be informed to.
    if (this.user.mailCommentGeneral === "true") {
      checkComment = null;
      article.commentList.forEach(function doPush(item) {
        if (checkComment) checkComment = checkComment + " ### "; else checkComment = "";
        checkComment = checkComment + item.text;

        if (item.text !== comment) checkComment = checkComment + " @" + item.user + " ";
      });
    }
    for (let i = 0; i < userList.length; i++) {
      if (util.mentions(checkComment, userList[i])) {
        sendMail = true;
        debug("Mail send because comment for @" + userList[i]);
      }
    }


    if (this.user.access === "guest") {
      sendMail = false;
      if (util.mentions(comment, this.user.OSMUser)) sendMail = true;
    }

    if (!sendMail) return cb();
    this.receiver.addComment(user, article, comment, cb);
  }

  editComment(user, article, index, comment, cb) {
    debug("UserConfigFilter::addComment");
    let sendMail = false;

    // check Collection
    if (this.user.mailAllComment === "true") {
      sendMail = true;
    }
    let checkComment = comment;
    let userList = [];
    if (this.user.mailComment) userList = this.user.mailComment;

    // if mailCommentGeneral search for mention in all comments of an article
    // and if user has written one comment in the list, so he has to be informed to.
    if (this.user.mailCommentGeneral === "true") {
      checkComment = null;
      article.commentList.forEach(function doPush(item) {
        if (checkComment) checkComment = checkComment + "###"; else checkComment = "";
        checkComment = checkComment + item.text;

        if (item.text !== comment) checkComment = checkComment + " @" + item.user + " ";
      });
    }
    if (this.user.mailComment) userList = this.user.mailComment;
    for (let i = 0; i < userList.length; i++) {
      if (util.mentions(comment, userList[i])) {
        sendMail = true;
        debug("Mail send because comment for @" + userList[i]);
      }
    }
    if (this.user.access === "guest") {
      sendMail = false;
      if (util.mentions(comment, this.user.OSMUser)) sendMail = true;
    }
    if (!sendMail) return cb();
    this.receiver.editComment(user, article, index, comment, cb);
  }

  updateBlog(user, blog, change, cb) {
    debug("UserConfigFilter::updateBlog");
    let sendMail = false;


    // check Collection
    if (this.user.mailBlogStatusChange === "true") {
      if (change.status && change.status !== blog.status && change.status !== "closed") {
        sendMail = true;
      }
    }
    if (this.user.access === "guest") sendMail = false;

    if (!sendMail) return cb();
    this.receiver.updateBlog(user, blog, change, cb);
  }

  sendReviewStatus(user, blog, lang, status, cb) {
    debug("UserConfigFilter::sendReviewStatus");
    let wnList = [];
    let sendMail = false;
    if (this.user.mailBlogLanguageStatusChange) wnList = this.user.mailBlogLanguageStatusChange;
    for (let i = 0; i < wnList.length; i++) {
      const l = wnList[i];
      if (l === lang) sendMail = true;
    }
    if (this.user.access === "guest") sendMail = false;
    if (!sendMail) return cb();
    debug("Send out mail");
    this.receiver.sendReviewStatus(user, blog, lang, status, cb);
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
    debug("UserConfigFilter::sendCloseBlocked");
    return cb();
  }

  sendCloseStatus(user, blog, lang, status, cb) {
    debug("UserConfigFilter::sendCloseStatus");
    let wnList = [];
    let sendMail = false;
    if (this.user.mailBlogLanguageStatusChange) wnList = this.user.mailBlogLanguageStatusChange;
    for (let i = 0; i < wnList.length; i++) {
      const l = wnList[i];
      if (l === lang) sendMail = true;
    }
    if (this.user.access === "guest") sendMail = false;
    if (!sendMail) return cb();
    debug("Send out mail");
    this.receiver.sendCloseStatus(user, blog, lang, status, cb);
  }
}








export default UserConfigFilter;
