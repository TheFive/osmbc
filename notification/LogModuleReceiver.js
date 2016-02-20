"use strict";

var debug     = require('debug')('OSMBC:notification:LogModuleReceiver');
var async     = require('async');
var should    = require('should');
var logModule = require('../model/logModule.js');






function LogModuleReceiver() {}

LogModuleReceiver.prototype.sendInfo= function(object,cb) {
  debug('LogModuleReceiver::sendInfo');
  logModule.log(object,cb);
};

LogModuleReceiver.prototype.updateArticle= function(user,article,change,cb) {
  debug('LogModuleReceiver::updateArticle');
  should.exist(article.id);
  should(article.id).not.equal(0);
  should(typeof(user)).eql("object");
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
                          user:user.OSMUser,
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
  should(typeof(user)).eql("object");
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
                        user:user.OSMUser,
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

LogModuleReceiver.prototype.sendLanguageStatus = function sendLanguageStatus(user,blog,lang,status,cb) {
  debug("LogModuleReceiver.prototype.sendLanguageStatus");
  should.exist(blog.id);
  should(blog.id).not.equal(0);
  should(typeof(user)).eql("object");
  should.exist(user.OSMUser);
  var timestamp = new Date();
  logModule.log({oid:blog.id,
    blog:blog.name,
    user:user.OSMUser,
    table:"blog",
    property:"reviewComment"+lang,
    from:"Add",
    to:status,
    timestamp:timestamp},cb);
};
LogModuleReceiver.prototype.sendCloseStatus = function sendCloseStatus(user,blog,lang,status,cb) {
  debug("LogModuleReceiver.prototype.sendCloseStatus");
  should.exist(blog.id);
  should(blog.id).not.equal(0);
  should(typeof(user)).eql("object");
  should.exist(user.OSMUser);
  var timestamp = new Date();
  logModule.log({oid:blog.id,
    blog:blog.name,
    user:user.OSMUser,
    table:"blog",
    property:"close"+lang,
    to:status,
    timestamp:timestamp},cb);
};

LogModuleReceiver.prototype.editComment = function editComment(user,article,index,text,callback){
  debug("LogModuleReceiver.prototype.editComment");
  should.exist(article.id);
  should(article.id).not.equal(0);
  should(typeof(user)).eql("object");
  should.exist(user.OSMUser);
  var timestamp = new Date();
  logModule.log({oid:article.id,
    blog:article.blog,
    user:user.OSMUser,
    table:"article",
    property:"comment"+index,
    from:article.commentList[index],
    to:text,
    timestamp:timestamp},callback);
}

LogModuleReceiver.prototype.addComment = function addComment(user,article,text,callback){
  debug("LogModuleReceiver.prototype.addComment");
  should.exist(article.id);
  should(article.id).not.equal(0);
  should(typeof(user)).eql("object");
  should.exist(user.OSMUser);
  var timestamp = new Date();
  logModule.log({oid:article.id,
    blog:article.blog,
    user:user.OSMUser,
    table:"article",
    property:"comment"+article.commentList.length,
    from:"",
    to:text,
    timestamp:timestamp},callback);
}

module.exports = LogModuleReceiver;