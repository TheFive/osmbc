

import _debug from "debug";
const debug = _debug("OSMBC:notification:messageFilter");





class ArticleCollectFilter {
  constructor(receiver) {
    debug("ArticleCollectFilter");
    this.receiver = receiver;
  }

  sendInfo(object, callback) {
    debug("ArticleCollectFilter::sendInfo");
    return callback();
  }

  updateArticle(user, article, change, cb) {
    debug("ArticleCollectFilter::updateArticle");
    if (change.collection && change.collection === article.collection) return cb();
    this.receiver.updateArticle(user, article, change, cb);
  }

  updateBlog(user, blog, change, cb) {
    debug("ArticleCollectFilter::updateBlog");
    return cb();
  }

  addComment(user, article, comment, cb) {
    debug("ArticleCollectFilter::addComment");
    this.receiver.addComment(user, article, comment, cb);
  }

  editComment(user, article, index, comment, cb) {
    debug("ArticleCollectFilter::editComment");
    this.receiver.editComment(user, article, index, comment, cb);
  }

  sendReviewStatus(user, blog, lang, status, cb) {
    debug("ArticleCollectFilter::sendReviewStatus");
    return cb();
  }

  /**
   * Auto Close could not close a reviewed language (issue #1130).
   * @param {object} user actor of the rule
   * @param {object} blog the blog
   * @param {string} lang language id
   * @param {string[]} problems messages for the editors
   * @param {function(Error=)} cb called when done
   */
  sendCloseBlocked(user, blog, lang, problems, cb) {
    debug("ArticleCollectFilter::sendCloseBlocked");
    return cb();
  }

  sendCloseStatus(user, blog, lang, status, cb) {
    debug("ArticleCollectFilter::sendCloseStatus");
    return cb();
  }
}






export default ArticleCollectFilter;

