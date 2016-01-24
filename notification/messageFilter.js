var debug = require('debug')('OSMBC:notification:messageFilter');
  
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
  var userList = [];
  if (this.what) userList = this.what.split(" ");
  var mail = false;
  for (var i=0;i<userList.length;i++) {
    if (change.comment.indexOf("@"+userList[i])>=0) mail = true; 
  }
  if (!mail) return cb();
  this.receiver.updateArticle(user,article,change,cb);
};

function UserConfigFilter(user,receiver){
  debug('UserConfigFilter');
  this.user = user;
  this.receiver = receiver;
}

UserConfigFilter.prototype.updateArticle = function ucfUpdateArticle(user,article,change,cb) {
  debug('UserConfigFilter.prototype.updateArticle');
  var sendMail = false;

  // check Collection
  if (this.user.mailNewCollection == "true") {
    if (change.collection && change.collection != article.collection) {
      sendMail = true;
      debug("Mail sent because new Collection");
    }
  }
  if (this.user.mailAllComment == "true") {
    if (change.comment && change.comment != article.comment) {
      sendMail = true;
      debug("Mail send because changed comment");
    }
  }
  var userList = [];
  if (this.what) userList = this.what.split(" ");
  for (var i=0;i<userList.length;i++) {
    if (change.comment.indexOf("@"+userList[i])>=0) {
      sendMail = true; 
      debug("Mail send because comment for @"+userList[i]);
    }
  }
  if (!sendMail) return cb();
  this.receiver.updateArticle(user,article,change,cb);
};

UserConfigFilter.prototype.sendInfo = function ucfSendInfo(object,cb) {
  debug('UserConfigFilter.prototype.sendInfo');
  return cb();
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
module.exports.UserConfigFilter = UserConfigFilter;
