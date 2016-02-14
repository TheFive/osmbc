"use strict";

var debug     = require('debug')('OSMBC:notification:messageCenter');
var async     = require('async');
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



var messageCenter = new MessageCenter();

var slack = config.getValue("slack");
var languagesWithoutDE = config.getLanguages().filter(function(lang){return lang!=="DE";});


messageCenter.registerReceiver(new LogModuleReceiver());
messageCenter.registerReceiver(new messageFilter.BlogStatusFilter(new SlackReceiver(slack.wn.blog,"#osmbcblog"),["DE"]));
messageCenter.registerReceiver(new messageFilter.BlogStatusFilter(new SlackReceiver(slack.weekly.blog,"#osmbcblog"),languagesWithoutDE));
messageCenter.registerReceiver(new messageFilter.ArticleCollectFilter(new SlackReceiver(slack.wn.article,"#osmbcarticle")));
messageCenter.registerReceiver(new messageFilter.ArticleCollectFilter(new SlackReceiver(slack.weekly.article,"#osmbcarticle")));


module.exports.global = messageCenter;
module.exports.Class = MessageCenter;