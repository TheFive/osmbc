"use strict";
var debug = require('debug')('OSMBC:notification:messageFilter');
var util = require('../util.js');


/* ConfigFilter Class
*
* ConfigFilter class is filtering the OSMBC Notification Stream
* it requires a config object with the following properties
*
* notifyNewCollection
*   if true every new Collection is forewarded
* notifyAllComment
*   if true every comment is forewarded
* notifyComment
*   if given, this is interpreted as a list of user, for that comments has to be forewarded
* notifyBlogStatusChange
*   if "true" all notifications regarding blog status changes are forewarded
* notifyBlogLanguageStatusChange
*   if given, this is interpreted as a list of languages, for that status changes are forewarded
* */


function ConfigFilter(config,receiver){
  debug('ConfigFilter');
  this.config = config;
  this.receiver = receiver;
}

ConfigFilter.prototype.updateArticle = function ucfUpdateArticle(user,article,change,cb) {
  debug('ConfigFilter.prototype.updateArticle');
  var notify = false;


  // check Collection
  if (util.isTrue(this.config.notifyNewCollection)) {
    if (change.collection && change.collection != article.collection) {
      notify = true;
      debug("Notification because new collection");
    }
  }
  if (util.isTrue(this.config.notifyAllComment)) {
    if (change.comment && change.comment != article.comment) {
      notify = true;
      debug("Notification because changed comment");
    }
  }
  var userList = [];
  if (this.config.notifyComment) userList = this.config.notifyComment;
  for (var i=0;i<userList.length;i++) {
    if (change.comment && change.comment.search(new RegExp("@"+userList[i],"i"))>=0) {
      notify = true;
      debug("Notification because comment for @"+userList[i]);
    }
  }
  if (!notify) return cb();
  this.receiver.updateArticle(user,article,change,cb);
};

ConfigFilter.prototype.addComment = function ucfAddComment(user,article,comment,cb) {
  debug('ConfigFilter.prototype.addComment');
  var notify = false;

  // check Collection
  if (util.isTrue(this.config.notifyAllComment)) {
    notify = true;
  }
  var userList = [];
  if (this.config.notifyComment) userList = this.config.notifyComment;
  for (var i=0;i<userList.length;i++) {

    if (comment.search(new RegExp("@"+userList[i]+"\\b","i"))>=0) {
      notify = true;
      debug("Notification because comment for @"+userList[i]);
    }
  }
  if (!notify) return cb();
  this.receiver.addComment(user,article,comment,cb);
};

ConfigFilter.prototype.editComment = function ucfEditComment(user,article,index,comment,cb) {
  debug('ConfigFilter.prototype.addComment');
  var notify = false;

  // check Collection
  if (util.isTrue(this.config.notifyAllComment)) {
    notify = true;
  }
  var userList = [];
  if (this.config.notifyComment) userList = this.config.notifyComment;
  for (var i=0;i<userList.length;i++) {
    if (comment.search(new RegExp("@"+userList[i]+"\\b","i"))>=0) {
      notify = true;
      debug("Notification because comment for @"+userList[i]);
    }
  }
  if (!notify) return cb();
  this.receiver.editComment(user,article,index,comment,cb);
};

ConfigFilter.prototype.updateBlog = function ucfUpdateArticle(user,blog,change,cb) {
  debug('ConfigFilter.prototype.updateBlog');
  var notify = false;


  // check Collection
  if (util.isTrue(this.config.notifyBlogStatusChange )) {
    if (change.status && change.status != blog.status && change.status != "closed") {
      notify = true;
    }
  }
 
  if (!notify) return cb();
  this.receiver.updateBlog(user,blog,change,cb);
};


ConfigFilter.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,cb) {
  debug('ConfigFilter.prototype.sendLanguageStatus');
  var wnList = [];
  var notify = false;
  if (this.config.notifyBlogLanguageStatusChange) wnList = this.config.notifyBlogLanguageStatusChange;
  for (var i=0;i<wnList.length;i++) {
    var l = wnList[i];
    if (l === lang) notify = true;
  }
  if (!notify) return cb();
  debug("Send out notification");
  this.receiver.sendLanguageStatus(user,blog,lang,status,cb);
};

ConfigFilter.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,cb) {
  debug('ConfigFilter.prototype.sendCloseStatus');
  var wnList = [];
  var notify = false;
  if (this.config.notifyBlogLanguageStatusChange) wnList = this.config.notifyBlogLanguageStatusChange;
  if (this.config.notifyBlogLanguageStatusChange) wnList = this.config.notifyBlogLanguageStatusChange;
  for (var i=0;i<wnList.length;i++) {
    var l = wnList[i];
    if (l === lang) notify = true;
  }
  if (!notify) return cb();
  debug("Send out notification");
  this.receiver.sendCloseStatus(user,blog,lang,status,cb);
};


module.exports = ConfigFilter;

