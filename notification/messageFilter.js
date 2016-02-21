"use strict";

var debug = require('debug')('OSMBC:notification:messageFilter');
var config = require("../config.js");
  



function UserConfigFilter(user,receiver){
  debug('UserConfigFilter');
  this.user = user;
  this.receiver = receiver;
}

UserConfigFilter.prototype.updateArticle = function ucfUpdateArticle(user,article,change,cb) {
  debug('UserConfigFilter.prototype.updateArticle');
  var sendMail = false;

  // check Collection
  if (this.user.mailNewCollection == "true") {
    if (change.collection && change.collection != article.collection) {
      sendMail = true;
      debug("Mail sent because new Collection");
    }
  }
  if (this.user.mailAllComment == "true") {
    if (change.comment && change.comment != article.comment) {
      sendMail = true;
      debug("Mail send because changed comment");
    }
  }
  var userList = [];
  if (this.user.mailComment) userList = this.user.mailComment;
  for (var i=0;i<userList.length;i++) {

  

    if (change.comment && change.comment.search(new RegExp("@"+userList[i],"i"))>=0) {
      sendMail = true; 
      debug("Mail send because comment for @"+userList[i]);
    }
  }
  if (!sendMail) return cb();
  this.receiver.updateArticle(user,article,change,cb);
};

UserConfigFilter.prototype.addComment = function ucfAddComment(user,article,comment,cb) {
  debug('UserConfigFilter.prototype.addComment');
  var sendMail = false;

  // check Collection
  if (this.user.mailAllComment == "true") {
    sendMail = true;
  }
  var userList = [];
  if (this.user.mailComment) userList = this.user.mailComment;
  for (var i=0;i<userList.length;i++) {
    if (comment.search(new RegExp("@"+userList[i],"i"))>=0) {
      sendMail = true;
      debug("Mail send because comment for @"+userList[i]);
    }
  }
  if (!sendMail) return cb();
  this.receiver.addComment(user,article,comment,cb);
};

UserConfigFilter.prototype.editComment = function ucfEditComment(user,article,index,comment,cb) {
  debug('UserConfigFilter.prototype.addComment');
  var sendMail = false;

  // check Collection
  if (this.user.mailAllComment == "true") {
    sendMail = true;
  }
  var userList = [];
  if (this.user.mailComment) userList = this.user.mailComment;
  for (var i=0;i<userList.length;i++) {
    if (comment.search(new RegExp("@"+userList[i],"i"))>=0) {
      sendMail = true;
      debug("Mail send because comment for @"+userList[i]);
    }
  }
  if (!sendMail) return cb();
  this.receiver.editComment(user,article,index,comment,cb);
};

UserConfigFilter.prototype.updateBlog = function ucfUpdateArticle(user,blog,change,cb) {
  debug('UserConfigFilter.prototype.updateBlog');
  var sendMail = false;
  var wnList = [];

  // send out status change if User is interested in review comments.
  if (this.user.mailBlogLanguageStatusChange) wnList = this.user.mailBlogLanguageStatusChange;
  if (wnList.length>0) sendMail = true;


  // check Collection
  if (this.user.mailBlogStatusChange == "true") {
    if (change.status && change.status != blog.status) {
      sendMail = true;
    }
  }
 
  if (!sendMail) return cb();
  this.receiver.updateBlog(user,blog,change,cb);
};


UserConfigFilter.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,cb) {
  debug('UserConfigFilter.prototype.sendLanguageStatus');
  var wnList = [];
  var sendMail = false;
  if (this.user.mailBlogLanguageStatusChange) wnList = this.user.mailBlogLanguageStatusChange;
  for (var i=0;i<wnList.length;i++) {
    var l = wnList[i];
    if (l === lang) sendMail = true;
  }
  if (!sendMail) return cb();
  debug("Send out mail");
  this.receiver.sendLanguageStatus(user,blog,lang,status,cb);
};

UserConfigFilter.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,cb) {
  debug('UserConfigFilter.prototype.sendCloseStatus');
  var wnList = [];
  var sendMail = false;
  if (this.user.mailBlogLanguageStatusChange) wnList = this.user.mailBlogLanguageStatusChange;
  for (var i=0;i<wnList.length;i++) {
    var l = wnList[i];
    if (l === lang) sendMail = true;
  }
  if (!sendMail) return cb();
  debug("Send out mail");
  this.receiver.sendCloseStatus(user,blog,lang,status,cb);
};

function BlogStatusFilter(receiver,languages) {
  debug("BlogStatusFilter");
  this.receiver = receiver;
  if (!languages) languages = config.getLanguages();
  this.languages = languages;

}


BlogStatusFilter.prototype.sendInfo = function(object,callback) {
  debug('BlogStatusFilter.prototype.sendInfo');
  return callback();
};
BlogStatusFilter.prototype.updateArticle = function ucfUpdateArticle(user,article,change,cb) {
  debug('BlogStatusFilter.prototype.updateArticle');
  return cb();
};
BlogStatusFilter.prototype.addComment = function addComment(user,article,comment,cb) {
  debug('BlogStatusFilter.prototype.addComment');
  return cb();
};
BlogStatusFilter.prototype.editComment = function editComment(user,article,index,comment,cb) {
  debug('BlogStatusFilter.prototype.editComment');
  return cb();
};
BlogStatusFilter.prototype.updateArticle = function ucfUpdateArticle(user,article,change,cb) {
  debug('BlogStatusFilter.prototype.updateArticle');
  return cb();
};

BlogStatusFilter.prototype.updateBlog = function ucfUpdateArticle(user,blog,change,cb) {
  debug('BlogStatusFilter.prototype.updateBlog');
  this.receiver.updateBlog(user,blog,change,cb);
};


BlogStatusFilter.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,cb) {
  debug('BlogStatusFilter.prototype.sendLanguageStatus');
  if (this.languages.indexOf(lang)>=0) {
    this.receiver.sendLanguageStatus(user,blog,lang,status,cb);
  } else return cb();
};
BlogStatusFilter.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,cb) {
  debug('BlogStatusFilter.prototype.sendLanguageStatus');
  if (this.languages.indexOf(lang)>=0) {
    this.receiver.sendCloseStatus(user,blog,lang,status,cb);
  } else return cb();
};

function ArticleCollectFilter(receiver) {
  debug("ArticleCollectFilter");
  this.receiver = receiver;
}

ArticleCollectFilter.prototype.sendInfo = function(object,callback) {
  debug('ArticleCollectFilter.prototype.sendInfo');
  return callback();
};

ArticleCollectFilter.prototype.updateArticle = function ucfUpdateArticle(user,article,change,cb) {
  debug('ArticleCollectFilter.prototype.updateArticle');
  if (change.collection && change.collection == article.collection) return cb();
  this.receiver.updateArticle(user,article,change,cb);
};

ArticleCollectFilter.prototype.updateBlog = function ucfUpdateArticle(user,blog,change,cb) {
  debug('ArticleCollectFilter.prototype.updateBlog');
  return cb();
};
ArticleCollectFilter.prototype.addComment = function addComment(user,article,comment,cb) {
  debug('ArticleCollectFilter.prototype.addComment');
  this.receiver.addComment(user,article,comment,cb);
};
ArticleCollectFilter.prototype.editComment = function editComment(user,article,index,comment,cb) {
  debug('ArticleCollectFilter.prototype.editComment');
  this.receiver.editComment(user,article,index,comment,cb);
};


ArticleCollectFilter.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,cb) {
  debug('ArticleCollectFilter.prototype.sendLanguageStatus');
  return cb();
};
ArticleCollectFilter.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,cb) {
  debug('ArticleCollectFilter.prototype.sendCloseStatus');
  return cb();
};

module.exports.UserConfigFilter = UserConfigFilter;
module.exports.ArticleCollectFilter = ArticleCollectFilter;
module.exports.BlogStatusFilter = BlogStatusFilter;

