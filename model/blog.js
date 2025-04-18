
// Exported Functions and prototypes are defined at end of file

import { series, eachOf, each, eachLimit } from "async";
import language from "../model/language.js";
import util from "../util/util.js";
import { FORBIDDEN } from "http-status-codes";
import config from "../config.js";



import { strict as assert } from "assert";
import moment from "moment";

import articleModule from "../model/article.js";
import configModule from "../model/config.js";
import logModule from "../model/logModule.js";
import messageCenter from "../notification/messageCenter.js";
import userModule from "../model/user.js";
import translator from "../model/translator.js";
import { scheduleJob } from "node-schedule";
import osmcalLoader from "../model/osmcalLoader.js";

import pgMap from "./pgMap.js";
import _debug from "debug";
import _markdownIt from "markdown-it";
const markdown = _markdownIt();
const debug = _debug("OSMBC:model:blog");




const wpExpressTitle = config.getValue("Blog Title For Export", { mustExist: true });
function getGlobalCategories() {
  const categoryTranslation = configModule.getConfig("categorytranslation");
  return categoryTranslation.filter((category) => { return (category.EN !== wpExpressTitle); });
}


function sanitizeBlogKey(blog) {
  if (blog === undefined || blog === null) return blog;
  if (blog === "TBC" || blog === "Trash" || blog === "Future") return blog;
  const str = blog.replace(/[^WN0-9]/gim, "");
  return str.trim();
}


class Blog {
  #statusCount = null;

  constructor(proto) {
    debug("Blog");
    this.id = 0;
    if (!proto || (proto && !proto.categories)) {
      this.categories = getGlobalCategories();
    }
    if (proto) {
      for (const k in proto) {
        this[k] = proto[k];
      }
    }
  }

  getExpected(l) {
    if (this.#statusCount !== null) return this.#statusCount[l].expected;
    return "?";
  }

  getUnEdited(l) {
    if (this.#statusCount !== null) return this.#statusCount[l].unedited;
    return "?";
  }

  getAutoTranslate(l) {
    if (this.#statusCount !== null) return this.#statusCount[l].autoTranslate;
    return "?";
  }

  getNoTranslate(l) {
    if (this.#statusCount !== null) return this.#statusCount[l].noTranslate;
    return "?";
  }

  getTable() {
    return "blog";
  }

  isReviewStarted(lang) {
    return Boolean(this["reviewComment" + lang]);
  }

  // setAndSave(user,data,callback)
  // user: actual username for logging purposes
  // data: json with values that has to be changed
  // Function will change the given values and create for every field,
  // where the value differes from representation in memory a log entry.
  // at the end, the blog value is written in total
  // This is may be relevant for concurrent save
  // as there is no locking with version numbers yet.
  setAndSave(user, data, callback) {
    debug("setAndSave");
    util.requireTypes([user, data, callback], ["object", "object", "function"]);
    const self = this;
    delete self.lock;
    assert.notEqual(typeof self.id, "undefined");
    series([
      messageCenter.global.updateBlog.bind(messageCenter.global, user, self, data),
      function copyDataToBlog(cb) {
        assert.notEqual(self.id, 0);
        for (const key in data) {
          const value = data[key];
          if (typeof (value) === "undefined") continue;
          if (value === self[key]) continue;
          if (value === "" && typeof (self[key]) === "undefined") continue;
          if (typeof (value) === "object") {
            if (JSON.stringify(value) === JSON.stringify(self[key])) continue;
          }
          self[key] = value;
        }
        cb();
      }
    ], function (err) {
      if (err) return callback(err);
      self.startCloseTimer();
      self.save(callback);
    });
  }

  getClosedReviewCount(lang) {
    debug("getClosedreviewCount");
    const self = this;
    const rc = "reviewComment" + lang;
    if (typeof (self[rc]) === "undefined" || self[rc] === null) {
      return 0;
    }
    const users = new Set();
    for (const review of self[rc]) {
      if ((review.text !== "startreview") && (review.text !== "reviewing...")) users.add(review.user);
    }
    return users.size;
  }

  setReviewComment(lang, user, data, callback) {
    debug("reviewComment");
    const self = this;
    const rc = "reviewComment" + lang;
    const exported = "exported" + lang;
    assert(typeof (user) === "object");
    assert.notEqual(typeof self.id, "undefined");
    assert(self.id !== 0);
    if (typeof (data) === "undefined") return callback();
    if (typeof (self[rc]) === "undefined" || self[rc] === null) {
      self[rc] = [];
    }
    for (let i = 0; i < self[rc].length; i++) {
      if (self[rc][i].user === user && self[rc][i].text === data) return callback();
    }
    series([
      function logInformation(cb) {
        debug("setReviewComment->logInformation");
        messageCenter.global.sendReviewStatus(user, self, lang, data, cb);
        // This is the old log and has to be moved to the messageCenter (logReceiver)
        // messageCenter.global.sendInfo({oid:self.id,blog:self.name,user:user,table:"blog",property:rc,from:"Add",to:data},callback);
      },
      function checkSpecialCommands(cb) {
        debug("setReviewComment->checkSpecialCommands");
        const date = new Date();
        if (data === "startreview") {
          // Start Review, check wether review is done in WP or not
          if (self[rc].length === 0) {
            self[rc].push({ user: user.OSMUser, text: data, timestamp: date });
          }
          // check Event articles (async with no real callback)
          return self.fillEventArticle(lang, cb);
        }
        if (data === "markexported") {
          self[exported] = true;
          // nothing has to be written to review Comment
          return cb();
        }
        if (data === "deleteallreviews") {
          // review moduls has to be canceled.
          // delete all reviews done
          delete self[rc];
          return cb();
        }
        for (let i = 0; i < self[rc].length; i++) {
          if (self[rc][i].text === "reviewing..." && self[rc][i].user === user.OSMUser) {
            if (data === "delete") {
              self[rc].splice(i, 1);
            } else {
              self[rc][i].text = data;
              self[rc][i].editstamp = date;
            }
            return cb();
          }
        }
        self[rc].push({ user: user.OSMUser, text: data, timestamp: date });
        return cb();
      }
    ], function (err) {
      debug("setReviewComment->FinalFunction");
      if (err) return callback(err);
      self.save(callback);
    });
  }

  fillEventArticle(lang, callback) {
    debug("fillEventArticle");
    const eventArticle = this._upcomingEvents;
    if (!eventArticle) return callback();
    let oldMd = eventArticle["markdown" + lang];
    if (typeof oldMd === "undefined") oldMd = "";
    if (oldMd && eventArticle["markdown" + lang].length > 10) return callback();

    osmcalLoader.getEventMdCb(lang, this.startDate, function (err, result) {
      if (err) return callback(err);
      const data = { old: {} };
      data["markdown" + lang] = result;
      data.old["markdown" + lang] = oldMd;
      eventArticle.setAndSave({ OSMUser: "OSMCAL" }, data, callback);
    });
  }

  editReviewComment(lang, user, index, data, callback) {
    debug("reviewComment");
    const self = this;
    const rc = "reviewComment" + lang;
    assert(typeof (user) === "object");
    assert(self.id);
    assert(self.id !== 0);
    if (typeof (data) === "undefined") return callback();
    if (typeof (self[rc]) === "undefined" || self[rc] === null) {
      self[rc] = [];
    }
    // Index out of range, just
    if (index < 0 || index >= self[rc].length) return callback(new Error("Edit Review Comment, Index out of Range"));


    if (self[rc][index].user !== user.OSMUser) {
      const error = new Error(">" + user.OSMUser + "< is not allowed to change review");
      error.status = FORBIDDEN;
      return callback(error);
    }

    // nothing to change.
    if (self[rc][index].text === data) return callback();

    series([
      function logInformation(cb) {
        debug("editReviewComment->logInformation");
        messageCenter.global.sendReviewStatus(user, self, lang, data, cb);
        // This is the old log and has to be moved to the messageCenter (logReceiver)
        // messageCenter.global.sendInfo({oid:self.id,blog:self.name,user:user,table:"blog",property:rc,from:"Add",to:data},callback);
      },
      function setValues(cb) {
        debug("editReviewComment->setValues");
        const date = new Date();

        self[rc][index].text = data;
        self[rc][index].editstamp = date;
        return cb();
      }
    ], function (err) {
      debug("setReviewComment->FinalFunction");
      if (err) return callback(err);
      self.save(callback);
    });
  }

  closeBlog(options, callback) {
    debug("closeBlog");
    assert(typeof (options.user) === "object");
    assert(typeof (options.lang) === "string");
    assert(typeof (options.status) === "boolean");

    const self = this;
    const closeField = "close" + options.lang;
    const reviewField = "reviewComment" + options.lang;

    if (self[closeField] === options.status) return callback();
    assert(self.id);
    assert(self.id !== 0);
    series([
      function logEntry(callback) {
        messageCenter.global.sendCloseStatus(options.user, self, options.lang, options.status, callback);
      },
      function setCloseField(callback) {
        self[closeField] = options.status;
        callback();
      },
      function removeReview(callback) {
        // Blog is reopened, so delete any review information
        // e.g. that review is started.
        // if there is some "substantial" review information (a review comment),
        // keep it and do not delete anythingx
        if (options.status === false) {
          if (self[reviewField] && self[reviewField].length === 0) {
            delete self[reviewField];
          }
          if (self[reviewField] && self[reviewField].length === 1) {
            if (self[reviewField][0].text === "startreview") {
              delete self[reviewField];
            }
          }
          self["exported" + options.lang] = false;
        }
        callback();
      }
    ], function finalFunction(err) {
      if (err) return callback(err);
      self.save(callback);
    });
  }

  autoClose(cb) {
    debug("autoClose");
    if (!this.endDate) return cb();

    const time = new Date().getTime();
    const endDateBlog = (new Date(this.endDate)).getTime();
    if (endDateBlog <= time) {
      const changes = { status: "edit" };
      this.setAndSave({ OSMUser: "autoclose" }, changes, function (err) {
        cb(err);
      });
    } else cb();
  }

  createTeamString(lang, callback) {
    debug("createTeamString");
    assert(typeof (lang) === "string");
    assert(typeof (callback) === "function");
    const self = this;
    let logs;
    let users = null;
    series([
      function readLogs(cb) {
        logModule.countLogsForBlog(self.name, function (err, result) {
          if (err) return cb(err);
          logs = result;
          return (cb(null));
        });
      }, function readusers(cb) {
        userModule.find({}, function (err, result) {
          if (err) return cb(err);
          users = result;
          cb();
        });
      }
    ], function finalFunction(err) {
      if (err) return callback(err);
      const result = convertLogsToTeamString(logs, lang, users);
      return callback(null, result);
    });
  }

  copyAllArticles(user, fromLang, toLang, callback) {
    debug("copyAllArticles");
    assert(typeof (user) === "object");
    assert(typeof (fromLang) === "string");
    assert(typeof (toLang) === "string");

    if (!this.isEditable(toLang)) return callback(new Error(toLang + " can not be edited"));

    const blogName = this.name;
    let articleList = [];

    series([
      function readArticlesWithCollector(cb) {
        debug("readArticlesWithCollector");
        articleModule.find({ blog: blogName }, { column: "title" }, function (err, result) {
          if (err) return cb(err);
          articleList = result;
          return cb();
        });
      },
      function copyArticles(cb) {
        each(articleList, function (article, cb2) {
          // to lang already defined
          if (article["markdown" + toLang] && article["markdown" + toLang].length > 0) return cb2();
          if ((fromLang !== "no_translation") && (!article["markdown" + fromLang])) return cb2();

          let source = "";
          if (fromLang === "no_translation") {
            source = "no translation";
          } else {
            source = article["markdown" + fromLang];
          }
          const data = {};
          data["markdown" + toLang] = source;
          data.old = {};
          data.old["markdown" + toLang] = "";

          article.setAndSave(user, data, cb2);
        }, cb);
      }
    ], callback);
  }

  translateAllArticles(user, fromLang, toLang, service, callback) {
    debug("translateAllArticles");
    const self = this;
    assert(typeof user === "object");
    assert(typeof fromLang === "string");
    assert(typeof toLang === "string");
    assert(typeof service === "string");
    assert(typeof callback === "function");

    fromLang = fromLang.toUpperCase();
    toLang = toLang.toUpperCase();

    if (!this.isEditable(toLang)) return callback(new Error(toLang + " can not be edited"));

    const blogName = this.name;
    let articleList = [];

    series([
      function readArticlesWithCollector(cb) {
        debug("readArticlesWithCollector");
        articleModule.find({ blog: blogName }, { column: "title" }, function (err, result) {
          if (err) return cb(err);
          articleList = result;
          return cb();
        });
      },
      function logTranslation(cb) {
        const data = {};
        data["translation with " + service] = fromLang + " -> " + toLang;
        messageCenter.global.updateBlog(user, self, data, cb);
      },
      function translateArticles(cb) {
        debug("translateArticles");
        eachLimit(articleList, 1, function (article, cb2) {
          debug("translateArticles.forEach");
          if (article.categoryEN === "Upcoming Events") return cb2();

          // to lang already defined
          if (article["markdown" + toLang] && article["markdown" + toLang].length > 0) return cb2();

          if (!article["markdown" + fromLang]) return cb2();

          const source = article["markdown" + fromLang];

          if (source === "no translation") return cb2();


          const options = { fromLang: fromLang, toLang: toLang, text: source };

          if (translator[service] && translator[service].active) {
            const fakeUser = { OSMUser: translator[service].user };
            translator[service].translate(options, function (err, text) {
              if (err) {
                return article.addCommentFunction(fakeUser, "Problem with translation", cb2);
              }
              const data = {};
              data["markdown" + toLang] = text;
              data.old = {};
              data.old["markdown" + toLang] = "";
              debug("copyArticles.forEach.setAndSave");
              article.setAndSave(fakeUser, data, cb2);
            });
          } else return cb2();
        }, cb);
      }
    ], callback);
  }

  // Generate Articles and Category for rendering a preview by a JADE Template
  getPreviewData(options, callback) {
    debug("getPreviewData");
    assert(typeof (options) === "object");
    assert(typeof (callback) === "function");
    const lang = options.lang;
    const self = this;


    const articles = {};
    let teamString = "";

    let futureArticles;

    let articleList = null;
    let containsEmptyArticlesWarning = false;

    series([
      function readFuture(cb) {
        debug("readFuture");
        articleModule.find({ blog: "Future" }, { column: "title" }, function (err, result) {
          if (err) return cb(err);
          if (result) futureArticles = result;
          return cb();
        });
      },
      function readArticlesWithCollector(cb) {
        debug("readArticlesWithCollector");
        articleModule.find({ blog: self }, { column: "title" }, function (err, result) {
          if (err) return cb(err);
          if (options.collectors) {
            each(result, calculateDependend, function finalFunction(err) {
              if (err) return cb(err);
              articleList = result;
              return cb();
            });
          } else {
            articleList = result;
            return cb();
          }
        });
      },
      function organiseArticles(cb) {
        debug("organiseArticles");



        let i; // often used iterator, declared here because there is no block scope in JS.
        for (i = 0; i < articleList.length; i++) {
          const r = articleList[i];

          // remove no translation article, if wanted
          if (options.disableNotranslation && r["markdown" + options.lang] === "no translation") continue;
          if (options.warningOnEmptyMarkdown && r.categoryEN !== "--unpublished--" &&
            (!r["markdown" + options.lang] || r["markdown" + options.lang].trim() === "")) {
            containsEmptyArticlesWarning = true;
          }
          if (typeof (articles[r.categoryEN]) === "undefined") {
            articles[r.categoryEN] = [];
          }
          articles[r.categoryEN].push(r);
        }
        for (const c in articles) {
          const r = sortArticles(articles[c]);
          articles[c] = r;
        }
        cb(null);
      },
      function createTeam(cb) {
        debug("createTeam");
        if (options.createTeam && lang) {
          self.createTeamString(lang, function (err, result) {
            if (err) return cb(err);
            teamString = result;
            return cb();
          });
        } else return cb();
      }
    ], function finalFunction(err) {
      debug("finalFunction");

      if (err) return callback(err);
      const result = {};
      result.teamString = teamString;
      result.articles = articles;
      result.futureArticles = {};
      futureArticles.forEach(function (a) {
        if (!result.futureArticles[a.categoryEN]) result.futureArticles[a.categoryEN] = [];
        result.futureArticles[a.categoryEN].push(a);
      });

      if (containsEmptyArticlesWarning) result.containsEmptyArticlesWarning = true;
      callback(null, result);
    });
  }

  calculateTimeToClose(callback) {
    debug("Blog.prototype.calculateTimeToClose");
    if (this._timeToClose) return callback();
    const self = this;
    self._timeToClose = {};
    logModule.find(" where data->>'blog' ='" + self.name + "' and data->>'property' like 'close%'", function (err, result) {
      if (err) return callback(err);
      if (!result) return callback();
      const endDate = moment(self.endDate);
      for (let i = 0; i < result.length; i++) {
        const lang = (result[i].property).substring(5, 7);
        const time = moment(result[i].timestamp);
        const timeToClose = time.diff(endDate, "days");
        if (!self._timeToClose[lang] || timeToClose > self._timeToClose[lang]) self._timeToClose[lang] = timeToClose;
      }
      return callback();
    });
  }

  calculateDerived(user, callback) {
    debug("calculateDerived");
    assert(user);
    // already done, nothing to do.
    if (this.#statusCount !== null) return callback();
    const self = this;
    self.#statusCount = {};

    self._userMention = [];
    self._mainLangMention = [];
    self._secondLangMention = [];

    self._tbcOwnArticleNumber = 0;

    self._unsolvedComments = {};

    self._usedLanguages = {};
    self._upcomingEvents = null;
    const mainLang = user.mainLang;
    const secondLang = user.secondLang;
    let i, j;

    articleModule.find({ blog: self }, function (err, result) {
      if (err) return callback(err);
      assert(Array.isArray(result));
      each(result, calculateDependend, function(err) {
        if (err) return callback(err);
        for (const l in language.getLanguages()) {
          const statusLang = {};

          statusLang.unedited = 0;
          statusLang.expected = 0;
          statusLang.autoTranslate = 0;
          statusLang.noTranslate = 0;
          self._unsolvedComments[l] = 0;
          for (j = 0; j < result.length; j++) {
            const article = result[j];
            const c = article.categoryEN;
            if (c === "Upcoming Events") self._upcomingEvents = article;
            if (c === "--unpublished--") continue;
            statusLang.expected += 1;
            const m = article["markdown" + l];
            if (m === "no translation") {
              statusLang.noTranslate += 1;
            } else {
              if (!m || m === "" || c === "-- no category yet --") {
                statusLang.unedited += 1;
              } else {
                if (article.isTranslatedAutomated(l)) {
                  statusLang.autoTranslate += 1;
                }
              }
            }
            // check, wether language is used in blog
            if (m && m !== "no translation") self._usedLanguages[l] = true;
            if (article.commentList && article.commentStatus === "open") {
              if (!m || m !== "no translation") self._unsolvedComments[l] += 1;
            }
          }
          self.#statusCount[l] = statusLang;
        }
        if (!result) return callback();
        for (i = 0; i < result.length; i++) {
          if (self.name === "TBC") {
            if (result[i].firstCollector === user.OSMUser) {
              self._tbcOwnArticleNumber += 1;
            }
          }
          if (result[i].commentList) {
            if (result[i].commentStatus === "solved") continue;
            for (j = 0; j < result[i].commentList.length; j++) {
              const comment = result[i].commentList[j].text;

              if (comment.search(new RegExp("@" + user.OSMUser, "i")) >= 0) {
                self._userMention.push(result[i]);
                break;
              }
              if ((comment.search(new RegExp("@" + mainLang, "i")) >= 0) ||
                (comment.search(/@all/i) >= 0) ||
                (comment.search(/@all/i) >= 0)) {
                self._mainLangMention.push(result[i]);
                break;
              }
              if ((comment.search(new RegExp("@" + secondLang, "i")) >= 0) ||
                (comment.search(/@all/i) >= 0) ||
                (comment.search(/@all/i) >= 0)) {
                self._secondLangMention.push(result[i]);
                break;
              }
            }
          }
        }
        return callback();
      });
    });
  }

  getCategories() {
    debug("getCategories");
    let result = getGlobalCategories();
    if (this.categories) {
      translateCategories(this.categories);
      result = this.categories;
    }


    return result;
  }

  isEditable(lang) {
    debug("isEditabe");
    let result = true;
    if (this["exported" + lang]) {
      result = false;
    }
    const closeLANG = this["close" + lang];
    if (typeof (closeLANG) !== "undefined") {
      if (closeLANG) result = false;
    }
    if (this.status === "closed") result = false;
    return result;
  }

  startCloseTimer() {
    debug("startCloseTimer");

    // if there is a timer, stop it frist, than decide a new start
    if (_allTimer[this.id]) {
      _allTimer[this.id].cancel();
      _allTimer[this.id] = null;
    }
    if (this.status !== "open") return;
    if (this.endDate) {
      const date = new Date(this.endDate);
      _allTimer[this.id] = scheduleJob(date, function () {
        autoCloseBlog(function () { });
      });
    }
  }

  getBlogName(lang) {
    if (lang === "DE") return "Wochennotiz";
    return "Weekly";
  }

  getStatus(lang) {
    let status = this.status;
    if (this.isReviewStarted(lang)) status = "Review " + lang;
    if (this["exported" + lang]) status = "Export " + lang;
    if (this["close" + lang]) status = "Close " + lang;
    return status;
  }
}


function create (proto) {
  debug("create");
  return new Blog(proto);
}











// find(object,order,callback)
// object (optional) find Objects, that conform with all values in the object
// order (optional)  field to sort by
export function find(obj1, obj2, callback) {
  debug("find");
  pgMap.find({ table: "blog", create: create }, obj1, obj2, callback);
}

// find(id,callback)
// id find Objects with ID

export function findById(id, callback) {
  function _findById(id, callback) {
    debug("findById %s", id);
    pgMap.findById(id, { table: "blog", create: create }, function(err, result) {
      if (err) callback(err);
      return callback(null, result);
    });
  }
  if (callback) {
    return _findById(id, callback);
  }
  return new Promise((resolve, reject) => {
    _findById(id, (err, result) => err ? reject(err) : resolve(result));
  });
}

// findOne(object,order,callback)
export function findOne(obj1, obj2, callback) {
  if (typeof obj2 === "function") {
    callback = obj2;
    obj2 = null;
  }
  function _findOne(obj1, obj2, callback) {
    debug("findOne");
    pgMap.findOne({ table: "blog", create: create }, obj1, obj2, callback);
  }
  if (callback) {
    return _findOne(obj1, obj2, callback);
  }
  return new Promise((resolve, reject) => {
    _findOne(obj1, obj2, (err, result) => err ? reject(err) : resolve(result));
  });
}

// Create a blog in the database,
// createNewBlog(proto,callback)
// for parameter see create
// proto is not allowed to have an id, this is generated by the database
// and stored into the object
function createNewBlog(user, proto, noArticle, callback) {
  assert(typeof (user) === "object");
  if (typeof (proto) === "function") {
    callback = proto;
    proto = null;
    noArticle = null;
  }
  if (typeof (noArticle) === "function") {
    assert(typeof callback === "undefined");
    callback = noArticle;
    noArticle = null;
  }

  function _createNewBlog(user, proto, noArticle, callback) {
    debug("createNewBlog");
    if (proto && proto.id) return callback(new Error("Should not exist proto id"));

    findOne(" where data->>'name' like 'WN%'", { column: "name", desc: true }, function(err, result) {
      if (err) return callback(err);
      const blog = create();
      let name = "WN250";
      let endDate = new Date();
      if (result) {
        if (result.name.substring(0, 2) === "WN") {
          name = result.name;
          if (result.endDate && typeof (result.endDate) !== "undefined") {
            endDate = new Date(result.endDate);
          }
        }
      }
      debug("Maximum Blog Name in DB: %s", name);
      const wnId = name.substring(2, 99);
      const newWnId = parseInt(wnId) + 1;
      const newName = "WN" + newWnId;
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() + 1);
      endDate.setDate(endDate.getDate() + 7);
      blog.name = newName;
      blog.status = "open";
      blog.startDate = startDate.toISOString();
      blog.endDate = endDate.toISOString();
      for (const k in proto) {
        blog[k] = proto[k];
      }
      const change = {};
      change.name = blog.name;
      change.status = blog.status;
      change.startDate = blog.startDate;
      change.endDate = blog.endDate;
      // create an Empty blog and simualte an id != 0
      const emptyBlog = create();
      emptyBlog.id = -1;
      const newArticles = configModule.getConfig("newArticles");

      eachOf(newArticles,
        function createArticle(value, key, cb) {
          if (noArticle) return cb();
          const newArticle = { blog: blog.name };
          for (const k in value) {
            newArticle[k] = value[k].replaceAll("#BlogName#", blog.name);
          }
          articleModule.createNewArticle(newArticle, cb);
        },
        function finalFunction(err) {
          if (err) return callback(err);
          blog.save(function feedback(err, savedblog) {
            if (err) return callback(err);
            emptyBlog.id = savedblog.id;
            messageCenter.global.updateBlog(user, emptyBlog, change, function(err) {
              if (err) {
                return callback(err);
              }
              return callback(null, savedblog);
            });
          });
        });
    });
  }
  if (callback) {
    return _createNewBlog(user, proto, noArticle, callback);
  }
  return new Promise((resolve, reject) => {
    _createNewBlog(user, proto, noArticle, (err, result) => err ? reject(err) : resolve(result));
  });
}


let _autoCloseRunning = 0;



function autoCloseBlog(callback) {
  debug("autoCloseBlog");
  // Do not run this function twice !
  if (_autoCloseRunning > 0) return callback();
  if (config.getValue("AutoCreate") === "false") return callback();
  _autoCloseRunning = _autoCloseRunning + 1;




  find({ status: "open" }, { column: "endDate", desc: false }, function(err, result) {
    if (err) {
      _autoCloseRunning = _autoCloseRunning - 1;
      return callback(err);
    }
    assert(Array.isArray(result));
    series([
      function series1CloseAllBlogs(cb) {
        each(result, function(data, cb) {
          data.autoClose(cb);
        }, function finish() { cb(); });
      },
      function series2CreateNewBlog(cb) {
        findOne({ status: "open" }, function(err, result) {
          if (err) return cb(err);
          if (!result) {
            createNewBlog({ OSMUser: "autocreate" }, cb);
            return;
          }
          cb();
        });
      }
    ], function seriesFinal(err) {
      _autoCloseRunning = _autoCloseRunning - 1;
      callback(err);
    });
  });
}

function convertLogsToTeamString(logs, lang, users) {
  debug("convertLogsToTeamString");
  const editors = [];
  const apiEditors = [];
  for (const f in translator) {
    apiEditors.push(translator[f].user);
  }
  function addEditors(property, min) {
    for (const user in logs[property]) {
      if (logs[property][user] >= min) {
        if (editors.indexOf(user) < 0 && apiEditors.indexOf(user) < 0) {
          editors.push(user);
        }
      }
    }
  }
  addEditors("collection", 3);
  addEditors("markdown" + lang, 2);
  addEditors("reviewComment" + lang, 1);
  editors.sort();

  for (let i = 0; i < editors.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (editors[i] === users[j].OSMUser) {
        // Ignore the editor, if he wants to be anonymous
        if (users[j].mdWeeklyAuthor && users[j].mdWeeklyAuthor === "anonymous") {
          editors.splice(i, 1);
          i = i - 1;
          j = 9999;
          continue;
        }
        // check on Markdown started with [
        if (users[j].mdWeeklyAuthor) {
          // Simle Markdown It without and plugin is enough for this case
          editors[i] = markdown.renderInline(users[j].mdWeeklyAuthor);
          continue;
        }
        // default the link with the OSM Profile
        editors[i] = '<a href="https://www.openstreetmap.org/user/' + editors[i] + '">' + editors[i] + "</a>";
      }
    }
  }

  let editorsString = "";
  if (editors.length >= 1) editorsString = editors[0];
  for (let i2 = 1; i2 < editors.length; i2++) {
    editorsString += ", " + editors[i2];
  }

  const editorStrings = configModule.getConfig("editorstrings");
  if (editorStrings[lang]) return editorStrings[lang].replace("##team##", editorsString);
  return "";
}





/* Sort a list of articles with predecessorId Help
Input: array or articles
Output: Array of articles, that has the same order than input
but respecting the predecessorId requirenment.
If several articles have the same predecessorId the result is undefined
Output: an array of articles.
 */
function sortArticles(listOfArticles) {
  debug("sortArticles");
  const result = [];
  const laterUse = [];
  listOfArticles.sort(function(a, b) {
    return ((a.title) ? a.title : "").localeCompare((b.title) ? b.title : "");
  });
  for (let p = 0; p < listOfArticles.length; p++) {
    if (listOfArticles[p].predecessorId) {
      laterUse.push(listOfArticles[p].id);
    }
  }
  while (listOfArticles.length > 0) {
    let searchfor = "0";
    if (result.length > 0) searchfor = result[result.length - 1].id;
    let found = false;
    for (let p = 0; p < listOfArticles.length; p++) {
      if (listOfArticles[p].predecessorId === searchfor) {
        const a = listOfArticles[p];
        listOfArticles.splice(p, 1);
        result.push(a);
        found = true;
        break;
      }
    }
    if (!found) {
      for (let p = 0; p < listOfArticles.length; p++) {
        if (laterUse.indexOf(listOfArticles[p].id) < 0) {
          const a = listOfArticles[p];
          listOfArticles.splice(p, 1);
          result.push(a);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      const a = listOfArticles[0];
      listOfArticles.splice(0, 1);
      result.push(a);
    }
  }
  return result;
}

function calculateDependend(article, cb) {
  debug("calculateDependend");

  series([
    article.calculateDerivedFromChanges.bind(article),
    article.calculateDerivedFromSourceId.bind(article)
  ], cb);
}










function translateCategories(cat) {
  debug("translateCategories");
  const languages = language.getLanguages();
  const categoryTranslation = configModule.getConfig("categorytranslation");
  for (let i = 0; i < cat.length; i++) {
    for (const lang in languages) {
      if (cat[i][lang]) continue;
      if (categoryTranslation[cat[i].EN]) {
        cat[i][lang] = categoryTranslation[cat[i].EN][lang];
      }


      if (!cat[i][lang]) cat[i][lang] = cat[i].EN;
    }
  }
}







const pgObject = {};

pgObject.createString = "CREATE TABLE blog (  id bigserial NOT NULL,  data json,  \
                  CONSTRAINT blog_pkey PRIMARY KEY (id) ) WITH (  OIDS=FALSE);";

pgObject.indexDefinition = {
  blog_status_idx: "CREATE INDEX blog_status_idx ON blog USING btree (((data ->> 'status'::text)))",
  blog_name_idx: "CREATE INDEX blog_name_idx ON blog USING btree (((data ->> 'name'::text)))"
};

pgObject.viewDefinition = {};
pgObject.table = "blog";

const pg = pgObject;





const _allTimer = {};


export function startAllTimers(callback) {
  debug("startAllTimers");
  find({ status: "open" }, function(err, result) {
    if (err && err.message === "relation \"blog\" does not exist") return callback();
    if (err) return callback(err);
    if (!result) return callback();
    for (let i = 0; i < result.length; i++) {
      result[i].startCloseTimer();
    }
    autoCloseBlog(callback);
  });
}


export function getTBC() {
  debug("getTBC");
  const blog = create({ name: "TBC", version: -1, status: "Action List" });
  return blog;
}





Blog.prototype.save = pgMap.save;





const blogModule = {
  findOne: findOne,
  findById: findById,
  find: find,
  create: create,
  sortArticles: sortArticles,
  sanitizeBlogKey: sanitizeBlogKey,
  autoCloseBlog: autoCloseBlog,
  createNewBlog: createNewBlog,
  getCategories: getGlobalCategories,
  pg: pg,
  Class: Blog

};

export default blogModule;
