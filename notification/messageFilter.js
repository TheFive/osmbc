var debug = require('debug')('OSMBC:notification:messageFilter');
  



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
  if (this.user.mailComment) userList = this.user.mailComment.split(" ");
  for (var i=0;i<userList.length;i++) {
    if (change.comment && change.comment.indexOf("@"+userList[i])>=0) {
      sendMail = true; 
      debug("Mail send because comment for @"+userList[i]);
    }
  }
  if (!sendMail) return cb();
  this.receiver.updateArticle(user,article,change,cb);
};

UserConfigFilter.prototype.updateBlog = function ucfUpdateArticle(user,blog,change,cb) {
  debug('UserConfigFilter.prototype.updateBlog');
  var sendMail = false;

  // check Collection
  if (this.user.mailBlogStatusChange == "true") {
    if (change.status && change.status != blog.status) {
      sendMail = true;
    }
  }
 
  if (!sendMail) return cb();
  this.receiver.updateBlog(user,blog,change,cb);
};


UserConfigFilter.prototype.sendInfo = function ucfSendInfo(object,cb) {
  debug('UserConfigFilter.prototype.sendInfo');
  debug(object);
  if (object.table!=="blog") return callback();
  if (object.from !== "Add") return callback();
  var wnList = [];
  var sendMail = false;
  if (this.user.mailBlogLanguageStatusChange) wnList = this.user.mailBlogLanguageStatusChange.split(" ");
  for (var i=0;i<wnList.length;i++) {
    var lang = wnList[i];
    debug("Check language "+lang);
    if (object.property === "reviewCommment"+lang || object.property === "exported"+lang || object.property === "close"+lang ) {
      sendMail = true; 
    }
  }
  if (!sendMail) return cb();
  debug("Send out mail");
  this.receiver.sendInfo(object,cb);
};

module.exports.UserConfigFilter = UserConfigFilter;
