"use strict";

var debug     = require('debug')('OSMBC:notification:messageCenter');
var async     = require('async');
var LogModuleReceiver = require('../notification/LogModuleReceiver');
var logger    = require('../config.js').logger;



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


module.exports.global = null;

function initialise(callback)
{
  debug("initialise");
  if (module.exports.global) {
    if (callback) return callback();
    return;
  }
  var messageCenter = new MessageCenter();
  module.exports.global = messageCenter;



  messageCenter.registerReceiver(new LogModuleReceiver());

  logger.info("Message Center initialised.");
  if (callback) return callback();
}



// register the Logging Receiver
module.exports.initialise = initialise;
module.exports.Class = MessageCenter;