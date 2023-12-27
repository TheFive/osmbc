import util from "../util/util.js";

import _debug from "debug";
const debug = _debug("OSMBC:notification:messageFilter");


/* ConfigFilter Class
*
* ConfigFilter class is filtering the OSMBC Notification Stream
* it requires a config object with the following properties
*
* notifyNewCollection
*   if true every new Collection is forewarded
* notifyAllComment
*   if true every comment is forewarded
* notifyComment
*   if given, this is interpreted as a list of user, for that comments has to be forewarded
* notifyBlogStatusChange
*   if "true" all notifications regarding blog status changes are forewarded
* notifyBlogLanguageStatusChange
*   if given, this is interpreted as a list of languages, for that status changes are forewarded
* */


class ConfigFilter {
  constructor(config, receiver) {
    debug("ConfigFilter");
    this.config = config;
    this.receiver = receiver;
  }

  updateArticle(user, article, change, cb) {
    debug("ConfigFilter.prototype.updateArticle");
    let notify = false;

    // check Collection
    if (util.isTrue(this.config.notifyNewCollection)) {
      if (change.collection && change.collection !== article.collection) {
        notify = true;
        debug("Notification because new collection");
      }
    }
    if (!notify) return cb();
    this.receiver.updateArticle(user, article, change, cb);
  }

  addComment(user, article, comment, cb) {
    debug("ConfigFilter.prototype.addComment");
    let notify = false;

    // check Collection
    if (util.isTrue(this.config.notifyAllComment)) {
      notify = true;
    }
    let userList = [];
    if (this.config.notifyComment) userList = this.config.notifyComment;
    for (let i = 0; i < userList.length; i++) {
      if (comment.search(new RegExp("@" + userList[i] + "\\b", "i")) >= 0) {
        notify = true;
        debug("Notification because comment for @" + userList[i]);
      }
    }
    if (!notify) return cb();
    this.receiver.addComment(user, article, comment, cb);
  }

  editComment(user, article, index, comment, cb) {
    debug("ConfigFilter.prototype.addComment");
    let notify = false;

    // check Collection
    if (util.isTrue(this.config.notifyAllComment)) {
      notify = true;
    }
    let userList = [];
    if (this.config.notifyComment) userList = this.config.notifyComment;
    for (let i = 0; i < userList.length; i++) {
      if (comment.search(new RegExp("@" + userList[i] + "\\b", "i")) >= 0) {
        notify = true;
        debug("Notification because comment for @" + userList[i]);
      }
    }
    if (!notify) return cb();
    this.receiver.editComment(user, article, index, comment, cb);
  }

  updateBlog(user, blog, change, cb) {
    debug("ConfigFilter.prototype.updateBlog");
    let notify = false;


    // check Collection
    if (util.isTrue(this.config.notifyBlogStatusChange)) {
      if (change.status && change.status !== blog.status && change.status !== "closed") {
        notify = true;
      }
    }

    if (!notify) return cb();
    this.receiver.updateBlog(user, blog, change, cb);
  }

  sendReviewStatus(user, blog, lang, status, cb) {
    debug("ConfigFilter.prototype.sendReviewStatus");
    let wnList = [];
    let notify = false;
    if (this.config.notifyBlogLanguageStatusChange) wnList = this.config.notifyBlogLanguageStatusChange;
    for (let i = 0; i < wnList.length; i++) {
      const l = wnList[i];
      if (l === lang) notify = true;
    }
    if (!notify) return cb();
    debug("Send out notification");
    this.receiver.sendReviewStatus(user, blog, lang, status, cb);
  }

  sendCloseStatus(user, blog, lang, status, cb) {
    debug("ConfigFilter.prototype.sendCloseStatus");
    let wnList = [];
    let notify = false;
    if (this.config.notifyBlogLanguageStatusChange) wnList = this.config.notifyBlogLanguageStatusChange;
    if (this.config.notifyBlogLanguageStatusChange) wnList = this.config.notifyBlogLanguageStatusChange;
    for (let i = 0; i < wnList.length; i++) {
      const l = wnList[i];
      if (l === lang) notify = true;
    }
    if (!notify) return cb();
    debug("Send out notification");
    this.receiver.sendCloseStatus(user, blog, lang, status, cb);
  }
}









export default ConfigFilter;

