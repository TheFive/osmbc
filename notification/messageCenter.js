var debug     = require('debug')('OSMBC:notification:messageCenter');
var async     = require('async');
var should    = require('should');
var logModule = require('../model/logModule.js');





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



function LogModuleReceiver() {}

LogModuleReceiver.prototype.sendInfo= function(object,cb) {
  debug('LogModuleReceiver::sendInfo');
  logModule.log(object,cb);
};

LogModuleReceiver.prototype.updateArticle= function(user,article,change,cb) {
  debug('LogModuleReceiver::updateArticle');
  should.exist(article.id);
  should(article.id).not.equal(0);
  var logblog = article.blog;
  if (change.blog) logblog = change.blog;
  var timestamp = new Date();
  async.forEachOf(change,function setAndSaveEachOf(value,key,cb_eachOf){
    // There is no Value for the key, so do nothing
    if (typeof(value)=='undefined') return cb_eachOf();

    // The Value to be set, is the same then in the object itself
    // so do nothing
    if (value == article[key]) return cb_eachOf();
    if (typeof(article[key])==='undefined' && value === '') return cb_eachOf();
    async.series ( [
        function(cb) {
           logModule.log({oid:article.id,
                          blog:logblog,
                          user:user.displayName,
                          table:"article",
                          property:key,
                          from:article[key],
                          to:value,
                          timestamp:timestamp},cb);
        }
      ],function(err){
        cb_eachOf(err);
      });
  },function finalFunction(err) {cb(err);});
};


LogModuleReceiver.prototype.updateBlog= function(user,blog,change,cb) {
  debug('LogModuleReceiver::updateBlog');
  should.exist(blog.id);
  should(blog.id).not.equal(0);
  var timestamp = new Date();
  async.forEachOf(change,function setAndSaveEachOf(value,key,cb_eachOf){
    debug('setAndSaveEachOf');
    // There is no Value for the key, so do nothing

    if (typeof(value)=='undefined') return cb_eachOf();
    // The Value to be set, is the same then in the object itself

    // so do nothing
    if (value === blog[key]) return cb_eachOf();

    if (typeof(blog[key])==='undefined' && value === '') return cb_eachOf();

    if (typeof(value)=='object') {
        if (JSON.stringify(value)==JSON.stringify(blog[key])) return cb_eachOf();
    }

    async.series ( [
      function writeLog(cb) {
        debug('writeLog');
        logModule.log({oid:blog.id,
                        blog:blog.name,
                        user:user,
                        table:"blog",
                        property:key,
                        from:blog[key],
                        to:value,
                        timestamp:timestamp},cb);
      }
    ],function(err){
      cb_eachOf(err);
    });
  },function finalFunction(err) {cb(err);});
};


MessageCenter.prototype.registerReceiver = function(receiver) {
  debug('MessageCenter::registerReceiver');
  this.receiverList.push(receiver);
};

var messageCenter = new MessageCenter();

messageCenter.registerReceiver(new LogModuleReceiver());


module.exports.global = messageCenter;
module.exports.Class = MessageCenter;