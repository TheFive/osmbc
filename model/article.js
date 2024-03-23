
// Exported Functions and prototypes are defined at end of file


import { series, each } from "async";
import { strict as assert } from "assert";
import { CONFLICT } from "http-status-codes";
import _debug from "debug";



import config from "../config.js";
import language from "../model/language.js";

import util from "../util/util.js";

import messageCenter from "../notification/messageCenter.js";
import { findOne as __findOne } from "../model/blog.js";
import logModule from "../model/logModule.js";
import configModule from "../model/config.js";
import pgMap from "../model/pgMap.js";
import translator from "../model/translator.js";

const debug = _debug("OSMBC:model:article");




const htmlRoot      = config.htmlRoot();
const url = config.url();




class Article {
  constructor(proto) {
    debug("Article");
    this.id = 0;
    for (const k in proto) {
      this[k] = proto[k];
    }
  }

  getTable() {
    return "article";
  }

  // return mention in comments of article
  // user == User is mentioned
  // language == lang1 or lang2 or all is mentioned
  // other == there is a comment, but no mentioning
  // null There is no comment.
  getCommentMention(userName, lang1, lang2) {
    debug("Article.prototype.getCommentMention");

    // No Type Check, Variables can be empty.
    if (this.commentStatus === "solved") return null;
    let comment = this.comment;
    if (this.commentList) {
      for (let i = 0; i < this.commentList.length; i++) {
        comment += " " + this.commentList[i].text;
      }
    }
    if (!comment) return null;
    if (comment.search(new RegExp("@" + userName + "\\b", "i")) >= 0) return "user";

    if (lang1 && comment.search(new RegExp("@" + lang1 + "\\b", "i")) >= 0) return "language";
    if (lang2 && comment.search(new RegExp("@" + lang2 + "\\b", "i")) >= 0) return "language";
    if (comment.search(/@all\b/i) >= 0) return "language";
    if (this.comment || (this.commentList && this.commentList.length > 0)) return "other";
    return null;
  }

  isMentioned(what, includeAll) {
    debug("Article.prototype.isMentioned");
    if (typeof (includeAll) === "undefined") includeAll = false;

    if (this.commentStatus === "solved") return null;
    let comment = this.comment;
    if (this.commentList) {
      for (let i = 0; i < this.commentList.length; i++) {
        comment += " " + this.commentList[i].text;
      }
    }
    if (!comment) return null;
    if (comment.search(new RegExp("@" + what + "\\b", "i")) >= 0) return true;
    if (includeAll && comment.search(/@all\b/i) >= 0) return true;
    return false;
  }

  getCommentRead(user) {
    debug("Article.prototype.getCommentUnread");
    if (!this.commentList) return false;
    if (!this.commentRead) return false;
    if (typeof (this.commentRead[user]) === "undefined") return false;
    if (this.commentRead[user] < this.commentList.length - 1) return false;
    return true;
  }

  isChangeAllowed(property) {
    debug("Article.prototype.isChangeAllowed");
    // someone should have set _blog, so that this function can work without callback
    // blog is set to null, so no dependency;
    if (this._blog === null) return true;
    assert.equal(typeof this._blog, "object");
    assert.equal(this.blog, this._blog.name);
    const langlist = language.getLanguages();
    let result = true;
    const self = this;

    switch (property) {
      case "title":
      case "blog":
      case "predecessorId":
      case "collection":
      case "categoryEN":
        for (const l in langlist) {
          if (self._blog["exported" + l] === true && self["markdown" + l] !== "no translation") result = false;
          if (self._blog["close" + l] === true && self["markdown" + l] !== "no translation") result = false;
        }
        if (self._blog.status === "closed") result = false;
        if (!result) return result;
        break;
      default:
        for (const l in langlist) {
          if (property === "markdown" + l) {
            if (self._blog["exported" + l] === true) result = false;
            if (self._blog["close" + l] === true) result = false;
          }
          if (!result) return result;
        }
    }
    return result;
  }

  // Set a Value (List of Values) and store it in the database
  // Store the changes in the change (history table) too.
  // There are 3 parameter
  // user: the user stored in the change object
  // data: the JSON with the changed values
  // callback
  // Logging is written based on an in memory compare
  // the object is written in total
  // There is no version checking on the database, so it is
  // Article.prototype.setAndSave = setAndSave;
  setAndSave(user, data, callback) {
    debug("setAndSave");
    util.requireTypes([user, data, callback], ["object", "object", "function"]);

    const self = this;

    if (data.addComment) return callback(new Error("addCommment in article setAndSave is unsupported"));
    if (data.comment) return callback(new Error("comment in article setAndSave is unsupported"));

    debug("Version of Article %s", self.version);
    debug("Version of dataset %s", data.version);
    if (data.version) {
      if (self.version !== parseInt(data.version)) {
        const error = new Error("Version Number Differs");
        return callback(error);
      }
    } else { // no version is given, check all fields for old field
      for (const k in data) {
        if (k === "old") continue;
        if (data.old && data.old[k] === data[k]) {
          delete data.old[k];
          delete data[k];
          continue;
        }
        if (!data.old || typeof (data.old[k]) === "undefined") return callback(new Error("No Version and no History Value for <" + k + "> given"));
        let dbValue = self[k];
        if (dbValue) dbValue = dbValue.replace(/(\r\n)/gm, "\n");
        let oldValue = data.old[k];
        if (oldValue) oldValue = oldValue.replace(/(\r\n)/gm, "\n");
        if ((dbValue && dbValue !== oldValue) || (typeof (self[k]) === "undefined" && data.old[k] !== "")) {
          const error = new Error("Field " + k + " already changed in DB");
          error.status = CONFLICT;
          error.detail = { oldValue: data.old[k], databaseValue: self[k], newValue: data[k] };
          return callback(error);
        }
      }
      delete data.old;
    }

    // check to set the commentStatus to open
    if (data.comment && !self.commentStatus) {
      data.commentStatus = "open";
    }

    if (data.categoryEN === "--unpublished--" || data.blog === "Trash") {
      if ((!data.unpublishReason || data.unpublishReason.trim() === "") &&
        (!self.unpublishReason || self.unpublishReason.trim() === "")) {
        return callback(new Error("Missing reason for unpublishing article."));
      }
    }
    if (self.categoryEN !== "--unpublished--" && data.blog === "Trash") {
      return callback(new Error("Only unpublished articles can be moved to trash."));
    }



    series([
      function checkID(cb) {
        if (self.id === 0) {
          self.save(cb);
        } else cb();
      },
      function loadBlog(cb) {
        if (self._blog) return cb();
        __findOne({ name: self.blog }, function (err, result) {
          if (err) return cb(err);
          self._blog = result;
          return cb();
        });
      },
      function addCommentWhenUnpublished(cb) {
        debug("addCommentWhenUnpublished");
        if (data.categoryEN === "--unpublished--" || data.blog === "Trash") {
          let text = "#solved because set to --unpublished--.\n\nReason: " + data.unpublishReason;
          if (data.unpublishReference) text += "\n" + data.unpublishReference;
          self.addCommentFunction(user, text, cb);
        } else cb();
      }
    ], function (err) {
      if (err) return callback(err);
      assert(typeof self.id !== "undefined");
      assert(self.id !== 0);
      delete data.version;

      for (const k in data) {
        if (data[k] === self[k]) { delete data[k]; continue; }
        if (data[k] === undefined) { delete data[k]; continue; }
        if (data[k]) data[k] = data[k].trim();
        if (data[k] === "" && typeof (self[k]) === "undefined") { delete data[k]; continue; }

        // all values that not have to be changed are now deleted.
        // Now check, wether deletion is allowed or not.
        if (!self.isChangeAllowed(k)) {
          return callback(new Error(k + " can not be edited. Blog is already exported."));
        }
      }

      series(
        [function logIt(cb) {
          const oa = create(self);
          // do not wait on email, so put empty callback handler
          messageCenter.global.updateArticle(user, oa, data, cb);
        },
        function putValues(cb) {
          for (const k in data) {
            if (typeof (data[k]) !== "undefined") self[k] = data[k];
          }
          cb();
        }],
        function setAndSaveFinalCB(err) {
          if (err) return callback(err);
          self.save(function (err) {
            callback(err);
          });
        });
    });
  }

  reviewChanges(user, data, callback) {
    debug("reviewChanges");
    util.requireTypes([user, data, callback], ["object", "object", "function"]);

    const self = this;


    for (const k in data) {
      if ((self[k] && self[k] !== data[k]) || (typeof (self[k]) === "undefined" && data[k] !== "")) {
        const error = new Error("Field " + k + " already changed in DB");
        error.status = CONFLICT;
        error.detail = { oldValue: data[k], databaseValue: self[k], Action: "Review Translation Command", field: k };
        return callback(error);
      }
    }
    data.action = "Review Change of " + Object.keys(data);

    series([
      function checkID(cb) {
        debug("reviewChanges->checkId");
        if (self.id === 0) {
          self.save(cb);
        } else cb();
      },
      function loadBlog(cb) {
        debug("reviewChanges->loadBlog");
        if (self._blog) return cb();
        __findOne({ name: self.blog }, function (err, result) {
          if (err) return cb(err);
          self._blog = result;
          return cb();
        });
      }
    ], function (err) {
      debug("reviewChanges->finalCallback");
      if (err) return callback(err);
      assert(typeof self.id !== "undefined");
      assert.notEqual(self.id, 0);
      for (const k in data) {
        // Now check, wether deletion is allowed or not.
        if (k !== "action" && !self.isChangeAllowed(k)) {
          return callback(new Error(k + " can not be edited. Blog is already exported."));
        }
      }

      const oa = create(self);
      // do not wait on email, so put empty callback handler
      messageCenter.global.updateArticle(user, oa, data, callback);
    });
  }

  // Calculate all links in markdown (final Text) and collection
  // there is no double check for the result
  calculateLinks() {
    debug("calculateLinks");
    let links = [];
    const languageFlags = configModule.getConfig("languageflags");

    const listOfField = ["collection"];
    for (const l in language.getLanguages()) {
      listOfField.push("markdown" + l);
    }
    for (let i = 0; i < listOfField.length; i++) {
      if (typeof (this[listOfField[i]]) !== "undefined") {
        const res = util.getAllURL(this[listOfField[i]]);
        // var res = this[listOfField[i]].match(/(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g);
        for (let respoint = 0; respoint < res.length; respoint++) {
          let add = true;
          for (const k in languageFlags) {
            if (res[respoint] === languageFlags[k]) {
              add = false;
              break;
            }
          }
          if (links.indexOf(res[respoint]) >= 0) add = false;
          if (add && res[respoint]) links = links.concat(res[respoint]);
        }
      }
    }
    return links;
  }

  // Calculate a Title with a maximal length for Article
  // The properties are tried in this order
  // a) Title
  // b) Markdown (final Text)
  // c) Collection
  // the maximal length is optional (default is 30)
  // Article.prototype.displayTitle = displayTitle;
  displayTitle(maxlength) {
    if (typeof (maxlength) === "undefined") maxlength = 30;
    let result = "";
    if (typeof (this.title) !== "undefined" && this.title !== "") {
      result = util.shorten(this.title, maxlength);
    } else if (typeof (this.collection) !== "undefined" && this.collection !== "") {
      result = util.shorten(this.collection, maxlength);
    }
    if (result.trim() === "") result = "No Title";
    return result;
  }

  // calculateUsedLinks(callback)
  // Async function to search for each Link in the article in the database
  // callback forwards every error, and as result offers an
  // object map, with and array of Articles for each shortened link
  calculateUsedLinks(options, callback) {
    debug("calculateUsedLinks");
    // Get all Links in this article
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    const usedLinks = this.calculateLinks();
    const self = this;

    const articleReferences = {};
    articleReferences.count = 0;

    if ((this.categoryEN === "Upcoming Events") || (this.categoryEN === "Releases")) {
      return callback(null, articleReferences);
    }
    let ignoreStandard = [];
    if (options.ignoreStandard) ignoreStandard = configModule.getConfig("ignoreforsearch");


    // For each link, search in DB on usage
    each(usedLinks,
      function forEachUsedLink(item, cb) {
        debug("forEachUsedLink");
        if (options.ignoreStandard && ignoreStandard.indexOf(item) >= 0) return cb();
        const reference = item;

        // shorten HTTP / HTTPS links by the leading HTTP(s)
        // if (reference.substring(0,5) == "https") reference = reference.substring(5,999);
        // if (reference.substring(0,4) == "http") reference = reference.substring(4,999);
        // search in the full Module for the link
        fullTextSearch(reference, { column: "blog", desc: true }, function (err, result) {
          debug("fullTextSearch Result");
          if (err) return cb(err);
          if (result) {
            for (let i = result.length - 1; i >= 0; i--) {
              let dropIt = false;
              if (result[i].id === self.id) dropIt = true;
              if (result[i].blog === "Trash") dropIt = true;
              if (result[i].categoryEN === "--unpublished--") dropIt = true;
              if (dropIt) {
                result.splice(i, 1);
              }
            }
            articleReferences[reference] = result;
            articleReferences.count += result.length;
          } else articleReferences[reference] = [];
          cb();
        });
      }, function finalFunction(err) {
        debug("finalFunction");
        callback(err, articleReferences);
      }
    );
  }

  getCategory(lang) {
    debug("getCategory");
    let result = this.categoryEN;
    const categoryTranslation = configModule.getConfig("categorytranslation");
    if (categoryTranslation[result] && categoryTranslation[result][lang]) {
      result = categoryTranslation[result][lang];
    }
    return result;
  }

  addCommentFunction(user, text, callback) {
    debug("Article.prototype.addCommentFunction");
    assert.equal(typeof (user), "object");
    assert.equal(typeof (text), "string");
    assert.equal(typeof (callback), "function");

    // check on empty comment
    if (text.trim() === "") return callback(new Error("Empty Comment Added"));
    const self = this;

    text = normaliseArticleNumber(text);

    // Add the new comment with User to the comment list object
    if (!self.commentList) self.commentList = [];
    self.commentStatus = "open";
    const commentObject = { user: user.OSMUser, timestamp: new Date(), text: text };
    self.commentList.push(commentObject);

    // Set the self written comment (and all before) to be read by OSMUser
    if (!self.commentRead) self.commentRead = {};
    self.commentRead[user.OSMUser] = self.commentList.length - 1;


    series([
      function sendit(cb) {
        debug("sendit");

        // send message because changed comment as described in message center
        messageCenter.global.addComment(user, self, text, cb);
      }, function searchStatus(cb) {
        if (text.indexOf("#solved") >= 0) {
          self.commentStatus = "solved";
        }
        if (text.indexOf("#open") >= 0) {
          self.commentStatus = "open";
        }
        cb();
      }
    ], function finalFunction(err) {
      debug("finalFunction");
      if (err) return callback(err);
      self.save(callback);
    }
    );
  }

  editComment(user, index, text, callback) {
    debug("Article.prototype.editComment");
    assert.equal(typeof (user), "object");
    assert.equal(typeof (text), "string");
    assert.equal(typeof (callback), "function");
    if (text.trim() === "") return callback(new Error("Empty Comment Added"));
    text = normaliseArticleNumber(text);
    const self = this;

    if (!self.commentList) self.commentList = [];
    assert(index >= 0);
    assert(index <= self.commentList.length - 1);
    if (user.OSMUser !== self.commentList[index].user) {
      const error = new Error("Only Writer is allowed to change a commment");
      error.status = CONFLICT;
      return callback(error);
    }
    series([
      function sendit(cb) {
        debug("sendit");
        messageCenter.global.editComment(user, self, index, text, cb);
      },
      function setValues(cb) {
        const commentObject = self.commentList[index];
        commentObject.editstamp = new Date();
        commentObject.text = text;
        cb();
      }, function searchStatus(cb) {
        if (text.indexOf("#solved") >= 0) {
          self.commentStatus = "solved";
        }
        if (text.indexOf("#open") >= 0) {
          self.commentStatus = "open";
        }
        cb();
      }
    ], function finalFunction(err) {
      debug("finalFunction");
      if (err) return callback(err);
      self.save(callback);
    }
    );
  }

  copyToBlog(blogName, languages, callback) {
    debug("Article.prototype.copyToBlog");
    const newArticle = {};
    const self = this;
    newArticle.collection = self.collection;
    newArticle.categoryEN = self.categoryEN;
    newArticle.title = self.title;
    newArticle.originArticleId = self.id;
    newArticle.blog = blogName;
    languages.forEach(function (l) {
      if (self["markdown" + l]) newArticle["markdown" + l] = "Former Text:\n\n" + self["markdown" + l];
    });
    if (!self.copyTo) self.copyTo = {};

    // check wether it is allready copied to that blog
    if (self.copyTo[blogName]) return callback(new Error("Article <" + self.title + "> already copied to <" + blogName + ">, ID<" + self.copyTo[blogName] + ">"));

    self.copyTo[blogName] = 0;
    let storeArticle = null;
    series([
      function (cb) {
        createNewArticle(newArticle, function (err, a) {
          storeArticle = a;
          return cb(err);
        });
      },
      function (cb) {
        self.copyTo[blogName] = storeArticle.id;
        return cb();
      },
      function (cb) {
        self.save(cb);
      }
    ], function (err) { return callback(err); });
  }

  /*
  Store the number of comments, a user has read.
  -1 is indicating, nothing is read. (same as a non existing value).
  The Value has to be between -1 and the length of the comment list -1.
  */
  markCommentRead(user, index, callback) {
    debug("Article.prototype.markCommentRead");
    assert.equal(typeof (user), "object");
    assert.equal(typeof (callback), "function");
    const self = this;

    // nothing to read, ignore request.
    if (!self.commentList) return callback();

    // Do not mark more comments then necessary as read
    if (index >= self.commentList.length) index = self.commentList.length - 1;

    assert(index >= -1);
    assert(index <= self.commentList.length - 1);

    if (!self.commentRead) self.commentRead = {};
    self.commentRead[user.OSMUser] = index;
    self.save(callback);
  }

  setVote(user, tag, callback) {
    debug("Article.prototype.setVote");
    assert.equal(typeof (user), "object");
    assert.equal(typeof tag, "string");
    assert.equal(typeof (callback), "function");
    const self = this;

    if (!self.votes) self.votes = {};
    if (!self.votes[tag]) self.votes[tag] = [];

    if (self.votes[tag].indexOf(user.OSMUser) < 0) {
      self.votes[tag].push(user.OSMUser);
      self.save(callback);
      return;
    }
    return callback();
  }

  unsetVote(user, tag, callback) {
    debug("Article.prototype.unsetVote");
    assert.equal(typeof (user), "object");
    assert.equal(typeof tag, "string");
    assert.equal(typeof (callback), "function");
    const self = this;

    if (!self.votes) self.votes = {};
    if (!self.votes[tag]) self.votes[tag] = [];
    const index = self.votes[tag].indexOf(user.OSMUser);
    if (index >= 0) {
      self.votes[tag].splice(index, 1);

      self.save(callback);
      return;
    }
    return callback();
  }

  setTag(user, tag, callback) {
    debug("Article.prototype.setTag");
    assert.equal(typeof (user), "object");
    assert.equal(typeof tag, "string");
    assert.equal(typeof (callback), "function");
    const self = this;

    if (!self.tags) self.tags = [];
    if (self.tags.indexOf(tag) < 0) {
      self.tags.push(tag);
      self.save(callback);
      return;
    }
    return callback();
  }

  unsetTag(user, tag, callback) {
    debug("Article.prototype.unsetTag");
    assert.equal(typeof user, "object");
    assert.equal(typeof tag, "string");
    assert.equal(typeof callback, "function");
    const self = this;

    if (!self.tags) self.tags = [];
    const index = self.tags.indexOf(tag);
    if (index >= 0) {
      self.tags.splice(index, 1);
      self.save(callback);
      return;
    }
    return callback();
  }

  addNotranslate(user, shownLang, callback) {
    debug("Article.prototype.addNotranslate");
    util.requireTypes([user, shownLang, callback], ["object", "object", "function"]);

    const self = this;
    const change = { version: self.version };
    for (const lang in language.getLanguages()) {
      if (shownLang[lang] && ((typeof (self["markdown" + lang]) === "undefined") || (self["markdown" + lang] === ""))) {
        change["markdown" + lang] = "no translation";
      }
    }
    return self.setAndSave(user, change, callback);
  }

  /* This Function reads changes and adds some attributes (derived attributes) to the article
  Object. For now this is mainly the last changed attribute and the author list.
  article._lastChange.markdownDE e.g. contains the last timestamp, whenn markdownDE was changed
  article.author._markdownDE contains all authors, worked on markdownDE
  article.author.collection all collectors.
   */
  calculateDerivedFromChanges(cb) {
    debug("Article.prototype.calculateDerivedFromChanges");

    const self = this;

    // does info already exist, then return
    if (self._lastChange) return cb();

    // search all logentries for this article
    logModule.find(
      { table: "article", oid: self.id },
      { column: "timestamp", desc: true },
      function (err, result) {
        if (err) return cb(err);
        if (result && result.length > 0) {
          const list = {};
          self._lastChange = {};
          for (let i = 0; i < result.length; i++) {
            const r = result[i];
            const prop = r.property;
            if (!list[prop]) list[prop] = {};

            // Mark the User for the current property
            list[prop][r.user] = "-";

            // set the _lastChange timestamp fo the current Property
            if (typeof (self._lastChange[prop]) === "undefined") {
              self._lastChange[prop] = r.timestamp;
            } else if (r.timestamp > self._lastChange[prop]) {
              self._lastChange[prop] = r.timestamp;
            }
          }
          self.author = {};


          for (const p in list) {
            self.author[p] = "";
            let sep = "";

            // Iterate over all user and copy them to a list.
            for (const k in list[p]) {
              self.author[p] += sep + k;
              sep = ",";
            }
          }
        }
        return cb();
      });
  }

  isTranslatedAutomated(lang) {
    if (!this) return false;
    if (!this.author) return false;
    const property = "markdown" + lang;
    if (!this.author[property]) return false;
    const lastAuthor = this.author[property].split(",")[0];
    for (const service in translator) {
      if (translator[service].user && translator[service].user === lastAuthor) return true;
    }
    return false;
  }

  isFormulated(lang) {
    return (this["markdown" + lang] && this["markdown" + lang].length > 0 && this["markdown" + lang] !== "no translation");
  }

  isNoTranslation(lang) {
    return (this["markdown" + lang] && this["markdown" + lang] === "no translation");
  }

  calculateDerivedFromSourceId(cb) {
    debug("Article.prototype.calculateDerivedFromSourceId");

    const self = this;
    if (!self.originArticleId) return cb();
    series([
      function loadArticle(callback) {
        findById(self.originArticleId, function (err, article) {
          if (err) return callback(err);
          self._originArticle = article;
          return callback();
        });
      },
      function loadBlog(callback) {
        if (!self._originArticle) return callback();
        __findOne({ name: self._originArticle.blog }, function (err, blog) {
          if (err) return callback(err);
          self._originBlog = blog;
          return callback();
        });
      }
    ], cb);
  }
}


function create (proto) {
  debug("create");
  return new Article(proto);
}


function createNewArticle (proto, callback) {
  if (typeof (proto) === "function") {
    callback = proto;
    proto = null;
  }
  function _createNewArticle(proto, callback) {
    debug("createNewArticle");
    if (proto && proto.id) return callback(new Error("ProtoID Exists"));
    const article = create(proto);
    article.save(function (err) {
      return callback(err, article);
    });
  }
  if (callback) {
    return _createNewArticle(proto, callback);
  }
  return new Promise((resolve, reject) => {
    _createNewArticle(proto, (err, result) => err ? reject(err) : resolve(result));
  });
}











function find(obj, order, callback) {
  if (typeof order === "function") {
    callback = order;
    order = undefined;
  }

  function _find(obj, order, callback) {
    debug("find");
    let createFunction = create;

    if (typeof obj.blog === "object") {
      const blog = obj.blog;
      obj.blog = blog.name;
      createFunction = function() {
        return create({ _blog: blog });
      };
    }
    if (typeof obj.blog === "string") {
      if ((obj.blog === "Future") || (obj.blog === "TBC") || (obj.blog === "Trash")) {
        createFunction = function() {
          return create({ _blog: null });
        };
      }
    }
    assert.notEqual(typeof createFunction, undefined);
    pgMap.find({ table: "article", create: createFunction }, obj, order, callback);
  }
  if (callback) {
    return _find(obj, order, callback);
  }
  return new Promise((resolve, reject) => {
    _find(obj, order, (err, result) => err ? reject(err) : resolve(result));
  });
}

function findById(id, callback) {
  function _findById(id, callback) {
    debug("findById %s", id);
    pgMap.findById(id, { table: "article", create: create }, function(err, result) {
      if (err) callback(err);
      if (!result) return callback(null, result);

      __findOne({ name: result.blog }, function(err, blog) {
        result._blog = blog;

        return callback(err, result);
      });
    });
  }
  if (callback) {
    return _findById(id, callback);
  }
  return new Promise((resolve, reject) => {
    _findById(id, (err, result) => err ? reject(err) : resolve(result));
  });
}


function findOne(obj1, obj2, callback) {
  debug("findOne");
  pgMap.findOne({ table: "article", create: create }, obj1, obj2, callback);
}

function fullTextSearch(search, order, callback) {
  debug("fullTextSearch");
  assert(typeof search === "string");
  if (typeof order === "function") {
    callback = order;
    order = null;
  }
  if (callback) return pgMap.fullTextSearch({ table: "article", create: create }, search, order, callback);

  return new Promise((resolve, reject) => {
    pgMap.fullTextSearch({ table: "article", create: create }, search, order, (err, result) => err ? reject(err) : resolve(result));
  });
}

function findEmptyUserCollectedArticles(lang, user, callback) {
  debug("findEmptyUserCollectedArticles");
  const query = "select distinct on (article.id) article.id as id, article.data as data from article, changes,blog \
           where (article.id)::text = changes.data->>'oid' and changes.data->>'table'='article' \
           and changes.data->>'blog' = blog.data->>'name' \
           and article.data->>'blog' != 'Trash' \
           and changes.data->>'property' = 'collection' \
           and article.data->>'categoryEN' != '--unpublished--' \
           and changes.data->>'user' = $1 \
           and blog.data->>'status' != 'closed' \
           and ((blog.data->concat( 'exported' , $2::character)) is null or blog.data->>concat('exported', $2) != 'true') \
           and ((article.data->>concat('markdown',$2) ) is null or article.data->>concat('markdown', $2) = '')";
  const queryObject = {
    sql: query,
    params: [user, lang]
  };
  console.dir(queryObject);
  pgMap.find({ table: "article", create: create }, queryObject, callback);
}

function findUserEditFieldsArticles(blog, user, field, callback) {
  debug("findUserEditFieldsArticles");
  const query = "select distinct on (article.id) article.id as id, article.data as data from article, changes \
           where (article.id)::text = changes.data->>'oid' and changes.data->>'table'='article' \
           and changes.data->>'blog' = '$1' \
           and changes.data->>'user' = '$2' \
           and changes.data->>'property' like '$3'";
  const queryObject = {
    sql: query,
    params: [blog, user, field]
  };
  pgMap.find({ table: "article", create: create }, queryObject, callback);
}






const pgObject = {};

pgObject.table = "article";
pgObject.createString = "CREATE TABLE article (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT article_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";
pgObject.indexDefinition = {
  article_blog_idx: "CREATE INDEX article_blog_idx ON article USING btree (((data ->> 'blog'::text)))",
  article_text_idx: "CREATE INDEX article_text_idx ON article USING gin  \
                      (to_tsvector('german'::regconfig,   \
                          ((((COALESCE((data ->> 'title'::text), ''::text) || ' '::text) ||  \
                            COALESCE((data ->> 'collection'::text), ''::text)) || ' '::text) || \
                            COALESCE((data ->> 'markdownDE'::text), ''::text))))",
  article_texten_idx: "CREATE INDEX article_texten_idx ON article USING gin \
                (to_tsvector('english'::regconfig, \
                  ((COALESCE((data ->> 'collection'::text), ''::text) || ' '::text) || \
                  COALESCE((data ->> 'markdownEN'::text), ''::text))))"

};
pgObject.viewDefinition = {

};
const pg = pgObject;




function normaliseArticleNumber(comment) {
  let result = comment;
  while (result.indexOf(url + htmlRoot + "/article/") >= 0) {
    result = result.replace(url + htmlRoot + "/article/", "#");
  }
  return result;
}


















function isMarkdown(text) {
  debug("isMarkdown");
  if (typeof (text) !== "string") return false;
  if (text.trim() === "") return false;
  if (text === "no translation") return false;
  return true;
}








// save stores the current object to database
Article.prototype.save = pgMap.save;

// remove deletes the current object from the database
Article.prototype.remove = pgMap.remove;












const articleModule = {
  isMarkdown: isMarkdown,
  findOne: findOne,
  fullTextSearch: fullTextSearch,
  findById: findById,
  findUserEditFieldsArticles: findUserEditFieldsArticles,
  findEmptyUserCollectedArticles: findEmptyUserCollectedArticles,
  find: find,
  createNewArticle: createNewArticle,
  create: create,
  pg: pg,
  Class: Article
};

export default articleModule;
