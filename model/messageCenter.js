var debug = require('debug')('OSMBC:model:messageCenter');
var async = require('async');
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


function ConsoleReceiver() {
  debug("ConsoleReceiver::ConsoleReceiver");

}
ConsoleReceiver.prototype.sendInfo = function(object,cb) {
  console.log("ConsoleReceiver::Info Received");
  console.dir(object);
  cb();
};

function LogModuleReceiver() {}

LogModuleReceiver.prototype.sendInfo= function(object,cb) {
  debug('LogModuleReceiver::sendInfo');
  logModule.log(object,cb);
};
function FilterNewCollection(receiver) {
  debug('FilterNewCollection::FilterNewCollection');
  this.receiver = receiver;
}

FilterNewCollection.prototype.sendInfo= function(object,cb) {
  debug('FilterNewCollection::sendInfo');
  if (object.property != "collection") return cb();
  if (object.from !== "") return cb();
  if (object.to !== "") return cb();
  this.receiver.sendInfo(object,cb);
};

function FilterAllComment(receiver) {
  debug('FilterAllComment::FilterAllComment');
  this.receiver = receiver;
}

FilterAllComment.prototype.sendInfo = function(object,cb) {
  debug('FilterAllComment::sendInfo');
  if (object.property != "comment") return cb();
  this.receiver.sendInfo(object,cb);
};

function FilterComment(what,receiver) { //jshint ignore:line
  debug('FilterAllComment::FilterComment');
  this.receiver = receiver;
  this.what = what;
}

FilterComment.prototype.sendInfo = function(object,cb) {
  debug('FilterComment::sendInfo');
  if (object.property != "comment") return cb();
  if (object.to.indexOf("@"+this.what)<0) return cb();
  this.receiver.sendInfo(object,cb);
};


MessageCenter.prototype.registerReceiver = function(receiver) {
  debug('MessageCenter::registerReceiver');
  this.receiverList.push(receiver);
};

var messageCenter = new MessageCenter();

messageCenter.registerReceiver(new FilterComment("TheFive",new ConsoleReceiver()));
messageCenter.registerReceiver(new FilterNewCollection(new ConsoleReceiver()));
messageCenter.registerReceiver(new LogModuleReceiver());


module.exports = messageCenter;