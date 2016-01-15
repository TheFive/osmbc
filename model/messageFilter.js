var debug = require('debug')('OSMBC:model:messageCenter');
var async = require('async');
var logModule = require('../model/logModule.js');

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

var filterList = {
  newCollection: FilterNewCollection,
  allComment: FilterAllComment
};
var paramFilterList = {
  comment: FilterComment
};

module.exports.global =  filterList;
module.exports.withParam = paramFilterList;
