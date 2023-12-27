

import _debug from "debug";
const debug = _debug("OSMBC:notification:messageFilter");





class ArticleCollectFilter {
  constructor(receiver) {
    debug("ArticleCollectFilter");
    this.receiver = receiver;
  }

  sendInfo(object, callback) {
    debug("ArticleCollectFilter.prototype.sendInfo");
    return callback();
  }

  updateArticle(user, article, change, cb) {
    debug("ArticleCollectFilter.prototype.updateArticle");
    if (change.collection && change.collection === article.collection) return cb();
    this.receiver.updateArticle(user, article, change, cb);
  }

  updateBlog(user, blog, change, cb) {
    debug("ArticleCollectFilter.prototype.updateBlog");
    return cb();
  }

  addComment(user, article, comment, cb) {
    debug("ArticleCollectFilter.prototype.addComment");
    this.receiver.addComment(user, article, comment, cb);
  }

  editComment(user, article, index, comment, cb) {
    debug("ArticleCollectFilter.prototype.editComment");
    this.receiver.editComment(user, article, index, comment, cb);
  }

  sendReviewStatus(user, blog, lang, status, cb) {
    debug("ArticleCollectFilter.prototype.sendReviewStatus");
    return cb();
  }

  sendCloseStatus(user, blog, lang, status, cb) {
    debug("ArticleCollectFilter.prototype.sendCloseStatus");
    return cb();
  }
}






export default ArticleCollectFilter;

