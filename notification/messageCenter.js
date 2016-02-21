"use strict";

var debug     = require('debug')('OSMBC:notification:messageCenter');
var async     = require('async');
var should    = require('should');
var config   = require("../config.js");
var SlackReceiver = require('../notification/slackReceiver.js');
var messageFilter = require('../notification/messageFilter.js');
var LogModuleReceiver = require('../notification/LogModuleReceiver');




function MessageCenter() {
  debug('MessageCenter::MessageCenter');
  this.receiverList = [];
}

MessageCenter.prototype.sendInfo = function(object,callback) {
  debug('MessageCenter::sendInfo');
  async.each(this.receiverList,function sendIt(element,cb){
    element.sendInfo(object,cb);
  },function final(err) {callback(err);});
};

MessageCenter.prototype.updateArticle = function (user,article,change,callback) {
  debug('MessageCenter::updateArticle');
  async.each(this.receiverList,function sendIt(element,cb){
    element.updateArticle(user,article,change,cb);
  },function final(err) {callback(err);});
};
MessageCenter.prototype.updateBlog = function (user,blog,change,callback) {
  debug('MessageCenter::updateBlog');
  async.each(this.receiverList,function sendIt(element,cb){
    element.updateBlog(user,blog,change,cb);
  },function final(err) {callback(err);});
};
MessageCenter.prototype.sendLanguageStatus = function(user,blog,lang,status,callback) {
  debug("MessageCenter.prototype.sendLanguageStatus");
  async.each(this.receiverList,function sendIt(element,cb){
    element.sendLanguageStatus(user,blog,lang,status,cb);
  },function final(err) {callback(err);});
};
MessageCenter.prototype.sendCloseStatus = function(user,blog,lang,status,callback) {
  debug("MessageCenter.prototype.sendCloseStatus");
  async.each(this.receiverList,function sendIt(element,cb){
    element.sendCloseStatus(user,blog,lang,status,cb);
  },function final(err) {callback(err);});
};

MessageCenter.prototype.registerReceiver = function(receiver) {
  debug('MessageCenter::registerReceiver');
  this.receiverList.push(receiver);
};

MessageCenter.prototype.addComment = function addComment(user,article,text,callback){
  debug('MessageCenter.prototype.addComment');
  async.each(this.receiverList,function sendIt(element,cb){
    element.addComment(user,article,text,cb);
  },function final(err) {callback(err);});
};
MessageCenter.prototype.editComment = function editComment(user,article,index,text,callback){
  debug('MessageCenter.prototype.addComment');
  async.each(this.receiverList,function sendIt(element,cb){
    element.editComment(user,article,index,text,cb);
  },function final(err) {callback(err);});
};



var messageCenter = new MessageCenter();

var slack = config.getValue("slack");

// first configure the blogs
var blogSlack = slack.blog;
var languages = config.getLanguages();

function notLanguage(lang) {
  return lang!==k;
}

if (blogSlack) {
  for (var k in blogSlack) {
    if (k === "default") continue;
    var languages = languages.filter(notLanguage);
    var blogConfig = blogSlack[k];
    should.exist(blogConfig.hook);
    should.exist(blogConfig.channel);
    messageCenter.registerReceiver(
      new messageFilter.BlogStatusFilter(
        new SlackReceiver("Blog "+k, blogConfig.hook, blogConfig.channel),
        [k])
    );
  }
  if (blogSlack.default) {
    k = blogSlack.default;
    should.exist(k.hook);
    should.exist(k.channel);
    messageCenter.registerReceiver(
      new messageFilter.BlogStatusFilter(
        new SlackReceiver("Blog default", k.hook, k.channel),
        languages)
    );
  }
}

// and then the article
var articleSlack = slack.article;

if (articleSlack) {
  for (var k in articleSlack) {
    var articleConfig = articleSlack[k];
    should.exist(articleConfig.hook);
    should.exist(articleConfig.channel);
    messageCenter.registerReceiver(
      new messageFilter.ArticleCollectFilter(
        new SlackReceiver("Article "+k,articleConfig.hook,articleConfig.channel)
      )
    );
  }
}





// register the Logging Receiver
messageCenter.registerReceiver(new LogModuleReceiver());

module.exports.global = messageCenter;
module.exports.Class = MessageCenter;