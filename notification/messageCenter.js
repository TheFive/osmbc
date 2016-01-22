var debug = require('debug')('OSMBC:model:messageCenter');
var async = require('async');
var should = require('should');
var logModule = require('../model/logModule.js');
var messageFilter = require('../notification/messageFilter.js');
var mailReceiver = require('../notification/mailReceiver.js');





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


function ConsoleReceiver() {
  debug("ConsoleReceiver::ConsoleReceiver");

}
ConsoleReceiver.prototype.sendInfo = function(object,cb) {
  console.log("ConsoleReceiver::Info Received");
  console.dir(object);
  cb();
};

ConsoleReceiver.prototype.updateArticle = function(user,article,change,cb) { //jshint ignore:line
  console.log("Update Artcile was called");
  return cb();
};

function LogModuleReceiver() {}

LogModuleReceiver.prototype.sendInfo= function(object,cb) {
  debug('LogModuleReceiver::sendInfo');
  logModule.log(object,cb);
};

LogModuleReceiver.prototype.updateArticle= function(user,article,change,cb) {
  debug('LogModuleReceiver::sendInfo');
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


MessageCenter.prototype.registerReceiver = function(receiver) {
  debug('MessageCenter::registerReceiver');
  this.receiverList.push(receiver);
};

var messageCenter = new MessageCenter();

messageCenter.registerReceiver(new messageFilter.withParam.comment("TheFive",new ConsoleReceiver()));
messageCenter.registerReceiver(new messageFilter.global.newCollection(new ConsoleReceiver()));
messageCenter.registerReceiver(new messageFilter.global.newCollection(new mailReceiver.MailReceiver(null)));
messageCenter.registerReceiver(new messageFilter.global.allComment(new mailReceiver.MailReceiver(null)));
messageCenter.registerReceiver(new LogModuleReceiver());


module.exports.global = messageCenter;
module.exports.Class = MessageCenter;