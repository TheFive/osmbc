"use strict";

const should = require("should");

var debug = require("debug")("OSMBC:notification:messageFilter");


function UserConfigFilter(user, receiver) {
  debug("UserConfigFilter");

  this.user = user;
  this.receiver = receiver;
  should.exist(this.user.OSMUser);
  should.exist(this.user.access);
}

UserConfigFilter.prototype.updateArticle = function ucfUpdateArticle(user, article, change, cb) {
  debug("UserConfigFilter.prototype.updateArticle");
  var sendMail = false;

  // check Collection
  if (this.user.mailNewCollection === "true" && this.user.access === "full") {
    if (change.collection && change.collection !== article.collection) {
      sendMail = true;
      debug("Mail sent because new Collection");
    }
  }

  // Guest are only informed about comments they are adressed to
  if (!sendMail) return cb();
  this.receiver.updateArticle(user, article, change, cb);
};

UserConfigFilter.prototype.addComment = function ucfAddComment(user, article, comment, cb) {
  debug("UserConfigFilter.prototype.addComment");
  var sendMail = false;

  // check Collection
  if (this.user.mailAllComment === "true") {
    sendMail = true;
  }
  let checkComment = comment;
  var userList = [];
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
  for (var i = 0; i < userList.length; i++) {
    if (checkComment.search(new RegExp("@" + userList[i] + "\\b", "i")) >= 0) {
      sendMail = true;
      debug("Mail send because comment for @" + userList[i]);
    }
  }


  if (this.user.access === "guest") {
    sendMail = false;
    if (comment.search(new RegExp("@" + this.user.OSMUser + "\\b", "i")) >= 0) sendMail = true;
  }

  if (!sendMail) return cb();
  this.receiver.addComment(user, article, comment, cb);
};

UserConfigFilter.prototype.editComment = function ucfEditComment(user, article, index, comment, cb) {
  debug("UserConfigFilter.prototype.addComment");
  var sendMail = false;

  // check Collection
  if (this.user.mailAllComment === "true") {
    sendMail = true;
  }
  let checkComment = comment;
  var userList = [];
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
  for (var i = 0; i < userList.length; i++) {
    if (comment.search(new RegExp("@" + userList[i] + "\\b", "i")) >= 0) {
      sendMail = true;
      debug("Mail send because comment for @" + userList[i]);
    }
  }
  if (this.user.access === "guest") {
    sendMail = false;
    if (comment.search(new RegExp("@" + this.user.OSMUser + "\\b", "i")) >= 0) sendMail = true;
  }
  if (!sendMail) return cb();
  this.receiver.editComment(user, article, index, comment, cb);
};

UserConfigFilter.prototype.updateBlog = function ucfUpdateArticle(user, blog, change, cb) {
  debug("UserConfigFilter.prototype.updateBlog");
  var sendMail = false;


  // check Collection
  if (this.user.mailBlogStatusChange === "true") {
    if (change.status && change.status !== blog.status && change.status !== "closed") {
      sendMail = true;
    }
  }
  if (this.user.access === "guest") sendMail = false;

  if (!sendMail) return cb();
  this.receiver.updateBlog(user, blog, change, cb);
};


UserConfigFilter.prototype.sendReviewStatus = function sendReviewStatus(user, blog, lang, status, cb) {
  debug("UserConfigFilter.prototype.sendReviewStatus");
  var wnList = [];
  var sendMail = false;
  if (this.user.mailBlogLanguageStatusChange) wnList = this.user.mailBlogLanguageStatusChange;
  for (var i = 0; i < wnList.length; i++) {
    var l = wnList[i];
    if (l === lang) sendMail = true;
  }
  if (this.user.access === "guest") sendMail = false;
  if (!sendMail) return cb();
  debug("Send out mail");
  this.receiver.sendReviewStatus(user, blog, lang, status, cb);
};

UserConfigFilter.prototype.sendCloseStatus = function sendCloseStatus(user, blog, lang, status, cb) {
  debug("UserConfigFilter.prototype.sendCloseStatus");
  var wnList = [];
  var sendMail = false;
  if (this.user.mailBlogLanguageStatusChange) wnList = this.user.mailBlogLanguageStatusChange;
  for (var i = 0; i < wnList.length; i++) {
    var l = wnList[i];
    if (l === lang) sendMail = true;
  }
  if (this.user.access === "guest") sendMail = false;
  if (!sendMail) return cb();
  debug("Send out mail");
  this.receiver.sendCloseStatus(user, blog, lang, status, cb);
};

module.exports = UserConfigFilter;

