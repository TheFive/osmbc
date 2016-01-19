var debug = require('debug')('OSMBC:model:messageCenter');
  
function FilterNewCollection(receiver) {
  debug('FilterNewCollection::FilterNewCollection');
  this.receiver = receiver;
}

FilterNewCollection.prototype.sendInfo= function(object,cb) {
  debug('FilterNewCollection::sendInfo');
  return cb();
};


FilterNewCollection.prototype.updateArticle= function(user,article,change,cb) {
  debug('FilterNewCollection::updateArticle');
  if (article.collection) return cb();
  if (change.collection === article.collection) return cb();
  this.receiver.updateArticle(user,article,change,cb);
};

function FilterAllComment(receiver) {
  debug('FilterAllComment::FilterAllComment');
  this.receiver = receiver;
}

FilterAllComment.prototype.sendInfo = function(object,cb) {
  debug('FilterAllComment::sendInfo');
  return cb();
};

FilterAllComment.prototype.updateArticle= function(user,article,change,cb) {
  debug('FilterAllComment::updateArticle');
  if (!change.comment) return cb();
  if (change.comment === article.comment) return cb();
  this.receiver.updateArticle(user,article,change,cb);
};

function FilterComment(what,receiver) { //jshint ignore:line
  debug('FilterAllComment::FilterComment');
  this.receiver = receiver;
  this.what = what;
}

FilterComment.prototype.sendInfo = function(object,cb) {
  debug('FilterComment::sendInfo');
  return cb();
};

FilterComment.prototype.updateArticle = function(user,article,change,cb) {
  debug('FilterComment::updateArticle');
  if (!change.comment) return cb();
  if (change.comment === article.comment ) return cb();
  if (change.comment.indexOf("@"+this.what)<0) return cb();
  this.receiver.updateArticle(user,article,change,cb);
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
