
// Exported Functions and prototypes are defined at end of file

import { series, eachOfSeries, each, eachLimit, eachSeries } from "async";
import language from "../model/language.js";
import util from "../util/util.js";
import { FORBIDDEN, CONFLICT, BAD_REQUEST } from "http-status-codes";
import config from "../config.js";



import { strict as assert } from "assert";
import moment from "moment";

import articleModule from "../model/article.js";
import configModule from "../model/config.js";
import logModule from "../model/logModule.js";
import messageCenter from "../notification/messageCenter.js";
import userModule from "../model/user.js";
import translator from "../model/translator.js";
import { isServiceUser } from "../model/serviceUsers.js";
import osmcalLoader from "../model/osmcalLoader.js";
import { normaliseWeeklyTime, nextWeeklyTimeAtOrAfter } from "../util/weeklyTime.js";
import { checkAnchor, findAnchors } from "../util/anchorCheck.js";

import pgMap from "./pgMap.js";
import _debug from "debug";
import _markdownIt from "markdown-it";
import { ZipArchive } from "archiver";
import blogRenderer from "../render/BlogRenderer.js";
const markdown = _markdownIt();
const debug = _debug("OSMBC:model:blog");

// The only values blog.status may take. Code all over checks for these exact
// strings (e.g. "closed" in isEditable / findBlogsForOutstandingExport and the
// article SQL filters), so an unknown value silently behaves like an open blog.
// setAndSave rejects anything else; views/blog/blog_edit.pug builds its
// dropdown from this list.
export const BLOG_STATUS = ["open", "edit", "closed", "trash"];

// Marker entries in reviewComment<lang> (not comments): review of the
// language started, personal review of a user running.
const REVIEW_STARTED = "startreview";
const REVIEW_RUNNING = "reviewing...";




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
  // articles of the blog, loaded by calculateDerived
  #articles = null;

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

  getWritten(l) {
    if (this.#statusCount !== null) {
      const s = this.#statusCount[l];
      return s.expected - s.unedited - s.noTranslate;
    }
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
  //
  // Optional optimistic-concurrency check via `data.old`, opt-in per key -
  // unlike Article.prototype.setAndSave (model/article.js), which
  // *requires* `old`/`version` for every changed key, this stays backward
  // compatible with every existing Blog caller (none of which ever set
  // `data.old` - verified 2026-09-03): a key with no
  // corresponding `data.old[key]` is written exactly as before,
  // unconditionally. Only keys the caller *does* make a claim about get
  // checked against the current in-memory value; a mismatch means someone
  // else changed it since the caller last read it, and aborts the whole
  // call with a CONFLICT error before anything is broadcast or saved.
  // `data.old` itself is always stripped before it can reach
  // messageCenter/persistence - LogModuleReceiver logs whatever keys are
  // present in `data` unconditionally (see notification/messageCenter.js),
  // so a lingering `old` key would otherwise turn into a bogus "property:
  // old" changes-log row, in addition to corrupting the blog's own data.
  setAndSave(user, data, callback) {
    debug("setAndSave");
    util.requireTypes([user, data, callback], ["object", "object", "function"]);
    const self = this;

    // Keys the caller makes an explicit `data.old` claim about - for those,
    // an empty-string write is honored even when the field is currently
    // undefined (see the copyDataToBlog skip below). Captured here because
    // `data.old` is stripped before copyDataToBlog runs.
    const explicitOldKeys = data.old ? Object.keys(data.old) : [];

    // Reject unknown status values. Re-submitting a blog's current (legacy)
    // status unchanged is allowed, so other fields stay editable.
    if (typeof data.status !== "undefined" && data.status !== self.status && !BLOG_STATUS.includes(data.status)) {
      const error = new Error("Unknown blog status >" + data.status + "<, allowed: " + BLOG_STATUS.join(", "));
      error.status = BAD_REQUEST;
      return callback(error);
    }

    if (data.old) {
      for (const key in data) {
        if (key === "old") continue;
        if (typeof data.old[key] === "undefined") continue; // no claim made for this key - skip the check
        const dbValue = self[key];
        const oldValue = data.old[key];
        const dbComparable = (typeof dbValue === "object") ? JSON.stringify(dbValue) : dbValue;
        const oldComparable = (typeof oldValue === "object") ? JSON.stringify(oldValue) : oldValue;
        // Mirrors Article.prototype.setAndSave's own special case
        // (model/article.js): a field that was never set at all
        // (`undefined`, e.g. a legacy blog that predates teamString<LANG>
        // existing) must compare equal to a caller's old-value claim of
        // "" - found by a real osmbc_prod_copie -> osmbc dry run
        // (WN028), where a naive `dbComparable !== oldComparable` treated
        // "field genuinely never existed" as a conflict against "caller
        // correctly believed there was no prior value".
        const conflict = (typeof dbValue === "undefined")
          ? oldComparable !== ""
          : dbComparable !== oldComparable;
        if (conflict) {
          const error = new Error("Field " + key + " already changed in DB");
          error.status = CONFLICT;
          error.detail = { oldValue: oldValue, databaseValue: dbValue, newValue: data[key] };
          return callback(error);
        }
      }
      delete data.old;
    }

    const previousBlogState = Object.assign(Object.create(Object.getPrototypeOf(self)), self);
    delete self.lock;
    assert.notEqual(typeof self.id, "undefined");
    series([
      messageCenter.global.updateBlog.bind(messageCenter.global, user, previousBlogState, data),
      function copyDataToBlog(cb) {
        assert.notEqual(self.id, 0);
        for (const key in data) {
          if (key === "old") continue;
          const value = data[key];
          if (typeof (value) === "undefined") continue;
          if (value === self[key]) continue;
          // Normally an empty-string write to a never-set field is a no-op
          // (don't clutter the blog JSON with empty keys). But if the
          // caller made an explicit `data.old` claim for this key, they
          // mean it - persist the "". Needed for the Blog-Sync-Merger
          // blanking teamString<LANG> on old-era blogs: "" makes
          // createTeamString return "" (no footer), whereas undefined
          // makes it auto-generate a "produced by ." credit from the
          // synthetic-only changelog (see routes/api.js applyBlogSync,
          // blogSyncMerger.planReplace; found in the WN009 canary run).
          if (value === "" && typeof (self[key]) === "undefined" && !explicitOldKeys.includes(key)) continue;
          if (typeof (value) === "object") {
            if (JSON.stringify(value) === JSON.stringify(self[key])) continue;
          }
          self[key] = value;
        }
        // If blog is reopened (status → edit or open), clear all exportedBy markers
        if (data.status && (data.status === "edit" || data.status === "open") &&
            previousBlogState.status !== data.status) {
          if (self.exportedBy && typeof self.exportedBy === "object") {
            self.exportedBy = {};
          }
        }
        cb();
      }
    ], function (err) {
      if (err) return callback(err);
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

  /**
   * Shared steps of every review change of a language: check the
   * language, broadcast `status` (the receivers know these values, see
   * sendReviewStatus), apply the change, save.
   * @param {string} lang configured language id, else error 400
   * @param {object} user acting user (OSMUser)
   * @param {string} status value for sendReviewStatus
   * @param {function(Array, function(Error=))} applyChange gets the review
   *   list of the language (created if missing)
   * @param {function(Error=)} callback
   */
  _changeReview(lang, user, status, applyChange, callback) {
    const languageError = language.checkLanguage(lang);
    if (languageError) return callback(languageError);
    assert(typeof (user) === "object");
    assert.notEqual(typeof this.id, "undefined");
    assert(this.id !== 0);
    const self = this;
    const rc = "reviewComment" + lang;
    if (!Array.isArray(self[rc])) self[rc] = [];
    series([
      (cb) => messageCenter.global.sendReviewStatus(user, self, lang, status, cb),
      (cb) => applyChange(self[rc], cb)
    ], function (err) {
      if (err) return callback(err);
      self.save(callback);
    });
  }

  /**
   * @param {Array} [reviews] review list of a language
   * @param {object} user user (OSMUser)
   * @returns {number} index of the running personal review of `user`, or -1
   */
  static _personalReviewIndex(reviews, user) {
    return (reviews || []).findIndex((r) => r.text === REVIEW_RUNNING && r.user === user.OSMUser);
  }

  /**
   * Start the review of a language (status button "Start Review", Auto
   * Review Start): adds the "startreview" marker if there is no review
   * entry yet and fills the upcoming events article.
   * @param {string} lang configured language id, else error 400
   * @param {object} user acting user (OSMUser)
   * @param {function(Error=)} callback
   */
  startReview(lang, user, callback) {
    debug("startReview");
    const self = this;
    this._changeReview(lang, user, REVIEW_STARTED, function(reviews, cb) {
      if (reviews.length === 0) reviews.push({ user: user.OSMUser, text: REVIEW_STARTED, timestamp: new Date() });
      self.fillEventArticle(lang, cb);
    }, callback);
  }

  /**
   * Mark a language as exported (status button "Did Export").
   * @param {string} lang configured language id, else error 400
   * @param {object} user acting user (OSMUser)
   * @param {function(Error=)} callback
   */
  markExported(lang, user, callback) {
    debug("markExported");
    const self = this;
    this._changeReview(lang, user, "markexported", function(reviews, cb) {
      self["exported" + lang] = true;
      cb();
    }, callback);
  }

  /**
   * Cancel the review of a language: removes every review entry,
   * comments and markers alike.
   * @param {string} lang configured language id, else error 400
   * @param {object} user acting user (OSMUser)
   * @param {function(Error=)} callback
   */
  deleteAllReviews(lang, user, callback) {
    debug("deleteAllReviews");
    const self = this;
    this._changeReview(lang, user, "deleteallreviews", function(reviews, cb) {
      delete self["reviewComment" + lang];
      cb();
    }, callback);
  }

  /**
   * Start the personal review of `user` ("... is reviewing since"). Does
   * nothing if it is already running.
   * @param {string} lang configured language id, else error 400
   * @param {object} user reviewing user (OSMUser)
   * @param {function(Error=)} callback
   */
  startPersonalReview(lang, user, callback) {
    debug("startPersonalReview");
    if (Blog._personalReviewIndex(this["reviewComment" + lang], user) >= 0) return callback();
    this._changeReview(lang, user, REVIEW_RUNNING, function(reviews, cb) {
      reviews.push({ user: user.OSMUser, text: REVIEW_RUNNING, timestamp: new Date() });
      cb();
    }, callback);
  }

  /**
   * End the personal review of `user` without a comment ("Stop review").
   * Does nothing if none is running.
   * @param {string} lang configured language id, else error 400
   * @param {object} user reviewing user (OSMUser)
   * @param {function(Error=)} callback
   */
  stopPersonalReview(lang, user, callback) {
    debug("stopPersonalReview");
    if (Blog._personalReviewIndex(this["reviewComment" + lang], user) < 0) return callback();
    this._changeReview(lang, user, "delete", function(reviews, cb) {
      reviews.splice(Blog._personalReviewIndex(reviews, user), 1);
      cb();
    }, callback);
  }

  /**
   * Add the review comment `text` of `user`. A running personal review of
   * the user ends with it (its marker becomes the comment). The text is
   * only a comment, never a command; the marker texts themselves are
   * refused (400), the views would take them for markers.
   * @param {string} lang configured language id, else error 400
   * @param {object} user reviewing user (OSMUser)
   * @param {string} text the comment; undefined does nothing
   * @param {function(Error=)} callback
   */
  addReviewComment(lang, user, text, callback) {
    debug("addReviewComment");
    if (typeof text === "undefined") return callback();
    if (text === REVIEW_STARTED || text === REVIEW_RUNNING) {
      const error = new Error("Review comment >" + text + "< is reserved");
      error.status = BAD_REQUEST;
      return callback(error);
    }
    this._changeReview(lang, user, text, function(reviews, cb) {
      const running = Blog._personalReviewIndex(reviews, user);
      if (running >= 0) {
        reviews[running].text = text;
        reviews[running].editstamp = new Date();
      } else {
        reviews.push({ user: user.OSMUser, text: text, timestamp: new Date() });
      }
      cb();
    }, callback);
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

  /**
   * Problems that keep a language from being closed, each a sentence for the
   * editor: articles not written yet (no text and not "no translation", or
   * in `-- no category yet --`; `--unpublished--` doesn't count, issue #1137)
   * and footnote anchors (`#wn<issue>_<id>`) that point to a missing,
   * unpublished or other-issue article, which break the Hugo export (#1130).
   * @param {string} lang language id, e.g. "DE"
   * @param {object} user user for calculateDerived (only OSMUser needed)
   * @param {function(Error|null, string[]=)} callback empty list if the
   *   language can be closed
   */
  getCloseProblems(lang, user, callback) {
    this._getCloseProblems(lang, user, {}, callback);
  }

  /**
   * getCloseProblems for several languages at once; anchors used in more
   * than one language are looked up only once.
   * @param {string[]} langs language ids; closed languages are left out
   * @param {object} user user for calculateDerived (only OSMUser needed)
   * @param {function(Error|null, object=)} callback `{ lang: [message, ...] }`
   */
  getCloseProblemsAll(langs, user, callback) {
    const self = this;
    const anchorCache = {};
    const result = {};
    eachSeries(langs, function(lang, cb) {
      if (self["close" + lang] === true) return cb();
      self._getCloseProblems(lang, user, anchorCache, function(err, problems) {
        if (err) return cb(err);
        result[lang] = problems;
        cb();
      });
    }, function(err) {
      callback(err, result);
    });
  }

  /**
   * getCloseProblems with a cache of anchor results shared between languages.
   * @param {string} lang language id
   * @param {object} user user for calculateDerived
   * @param {object} anchorCache anchor -> "OK" or message, filled here
   * @param {function(Error|null, string[]=)} callback problems of the language
   */
  _getCloseProblems(lang, user, anchorCache, callback) {
    debug("getCloseProblems");
    const self = this;
    self.calculateDerived(user, function(err) {
      if (err) return callback(err);
      const problems = [];
      const unwritten = self.getUnEdited(lang);
      if (unwritten > 0) {
        problems.push(unwritten + (unwritten === 1 ? " article is" : " articles are") +
          " not written yet. Write a text or \"no translation\", or give it a category.");
      }
      const anchors = new Set();
      (self.#articles || []).forEach(function(article) {
        if (article.categoryEN === "--unpublished--") return;
        findAnchors(article["markdown" + lang]).forEach((anchor) => anchors.add(anchor));
      });
      eachSeries(Array.from(anchors), function(anchor, cb) {
        function addStatus(status) {
          anchorCache[anchor] = status;
          if (status !== "OK") problems.push(status + ".");
          cb();
        }
        if (anchorCache[anchor]) return addStatus(anchorCache[anchor]);
        checkAnchor(anchor, self.name, function(err, status) {
          if (err) return cb(err);
          addStatus(status);
        });
      }, function(err) {
        callback(err, problems);
      });
    });
  }

  /**
   * Check that a language may be closed, see getCloseProblems.
   * @param {string} lang language id, e.g. "DE"
   * @param {object} user user for calculateDerived (only OSMUser needed)
   * @param {function(Error=)} callback error with status 409 (CONFLICT) and a
   *   message for the editor if the language has problems
   */
  checkClosable(lang, user, callback) {
    debug("checkClosable");
    const self = this;
    self.getCloseProblems(lang, user, function(err, problems) {
      if (err) return callback(err);
      if (problems.length > 0) {
        const error = new Error(self.name + " (" + lang + ") can not be closed: " + problems.join(" "));
        error.status = CONFLICT;
        return callback(error);
      }
      callback();
    });
  }

  /**
   * Close one language of the blog (status button "Close", Auto Close).
   * Refused with 409 (CONFLICT) while the language has close problems
   * (see getCloseProblems). The whole blog is closed by setting its
   * `status` to "closed" with setAndSave.
   * @param {string} lang configured language id, else error 400
   * @param {object} user acting user (OSMUser)
   * @param {function(Error=)} callback
   */
  closeLanguage(lang, user, callback) {
    debug("closeLanguage");
    this._changeCloseState(lang, user, true, {
      check: (cb) => this.checkClosable(lang, user, cb)
    }, callback);
  }

  /**
   * Reopen a closed language (status button "Edit"). The language has to
   * be exported again, a review that was only started is dropped; real
   * review comments stay.
   * @param {string} lang configured language id, else error 400
   * @param {object} user acting user (OSMUser)
   * @param {function(Error=)} callback
   */
  reopenLanguage(lang, user, callback) {
    debug("reopenLanguage");
    this._changeCloseState(lang, user, false, {
      apply: () => {
        this._dropReviewIfOnlyStarted(lang);
        this._resetExportState(lang);
      }
    }, callback);
  }

  /**
   * Frame of closeLanguage / reopenLanguage: does nothing if `close<lang>`
   * is already `closed`; otherwise `steps.check` (may refuse), broadcast,
   * set the field, `steps.apply`, save.
   * @param {string} lang configured language id, else error 400
   * @param {object} user acting user (OSMUser)
   * @param {boolean} closed new value of `close<lang>`
   * @param {{check: function(function(Error=))=, apply: function()=}} steps
   * @param {function(Error=)} callback
   */
  _changeCloseState(lang, user, closed, steps, callback) {
    const languageError = language.checkLanguage(lang);
    if (languageError) return callback(languageError);
    assert(typeof (user) === "object");
    if (this["close" + lang] === closed) return callback();
    assert(this.id);
    const self = this;
    series([
      (cb) => (steps.check ? steps.check(cb) : cb()),
      (cb) => messageCenter.global.sendCloseStatus(user, self, lang, closed, cb)
    ], function(err) {
      if (err) return callback(err);
      self["close" + lang] = closed;
      if (steps.apply) steps.apply();
      self.save(callback);
    });
  }

  /**
   * Remove the review list of `lang` if it holds nothing but the
   * "review started" marker (or nothing at all).
   * @param {string} lang language id
   */
  _dropReviewIfOnlyStarted(lang) {
    const reviews = this["reviewComment" + lang];
    if (!Array.isArray(reviews)) return;
    const onlyStarted = reviews.length === 1 && reviews[0].text === REVIEW_STARTED;
    if (reviews.length === 0 || onlyStarted) delete this["reviewComment" + lang];
  }

  /**
   * Mark `lang` as not exported: `exported<lang>` and the per-profile
   * markers in `exportedBy`.
   * @param {string} lang language id
   */
  _resetExportState(lang) {
    this["exported" + lang] = false;
    if (!this.exportedBy || typeof this.exportedBy !== "object") return;
    for (const markers of Object.values(this.exportedBy)) {
      if (markers && typeof markers === "object") delete markers[lang];
    }
  }

  /**
   * Switch an open blog whose endDate has passed to "edit" (Auto Edit
   * Mode); does nothing before endDate or without one.
   * @param {function(Error=)} cb
   */
  startEditModeIfEnded(cb) {
    debug("startEditModeIfEnded");
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
    // Manual override: for issues predating the automated team string
    // (computed from the change log below) - roughly WN282 and earlier,
    // the "wp-oldimport" bulk import for the pre-osmbc era (blog.openstreetmap.de,
    // 2010-2015) and the sparsely-used earliest osmbc issues (WN272-282,
    // before the wider editorial team had adopted the tool) have no
    // meaningful change-log data to compute a real team from. Editors can
    // set this by hand (Blog Edit) instead, so the honor of the people who
    // actually collected/wrote those issues isn't lost.
    if (self["teamString" + lang] !== undefined && self["teamString" + lang] !== null) {
      return callback(null, self["teamString" + lang]);
    }
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
          if (article.categoryEN === "--unpublished--") return cb2();

          // to lang already defined
          if (article["markdown" + toLang] && article["markdown" + toLang].length > 0) return cb2();

          if (!article["markdown" + fromLang]) return cb2();

          const source = article["markdown" + fromLang];

          if (source === "no translation") return cb2();


          const options = { fromLang: fromLang, toLang: toLang, text: source };

          if (translator[service] && translator[service].active()) {
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
            // calculateDerived (e.g. from the blog route) already read the
            // change log for these articles, reuse it instead of a second query
            const known = {};
            for (const a of (self.#articles || [])) if (a._lastChange) known[a.id] = a;
            for (const a of result) {
              if (!known[a.id]) continue;
              a._lastChange = known[a.id]._lastChange;
              a.author = known[a.id].author;
            }
            articleModule.calculateDerivedFromChangesForList(result, function finalFunction(err) {
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

        // Build lookup tables over the full (unfiltered) articleList so a
        // predecessorId chain can be resolved "through" no translation
        // articles that are about to be removed below. Without this, a
        // chain A -> B -> C where B is a no translation article would lose
        // the A -> C link once B disappears from the list handed to
        // sortArticles.
        const predecessorMap = {};
        const noTranslationIds = {};
        if (options.disableNotranslation) {
          for (i = 0; i < articleList.length; i++) {
            const a = articleList[i];
            predecessorMap[a.id] = a.predecessorId;
            if (a["markdown" + options.lang] === "no translation") noTranslationIds[a.id] = true;
          }
        }

        for (i = 0; i < articleList.length; i++) {
          const r = articleList[i];

          // remove no translation article, if wanted
          if (options.disableNotranslation && noTranslationIds[r.id]) continue;
          if (options.disableNotranslation) {
            // Skip over removed no translation predecessors so the chain
            // stays intact; guard against cycles in corrupted data.
            let pid = r.predecessorId;
            const visited = {};
            while (pid !== undefined && pid !== null && noTranslationIds[pid] && !visited[pid]) {
              visited[pid] = true;
              pid = predecessorMap[pid];
            }
            r.predecessorId = pid;
          }
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

  /**
   * Build a preview/export payload independent from the HTTP layer.
   *
   * @param {object} options Input options for export rendering.
   * @param {string|string[]} [options.lang="EN"]
   * Language selection:
   * - single language code (e.g. "EN")
   * - "ALL" to resolve dynamically
   * - array of language codes (invalid values are filtered)
   *
    * Resolution rules:
    * - undefined or invalid single value -> "EN"
    * - "ALL" with markdown-mode renderer -> all configured languages
    * - "ALL" with html-mode renderer -> only closed languages
   *
    * @param {string} [options.exportProfile]
    * Name of an entry in config key `ExportProfiles`.
    * Preferred mode for all new integrations.
    *
     * @param {string} [options.renderer="HTML"]
    * Explicit renderer selection (case-insensitive):
    * - "HTML"
    * - "HUGO" / "HUGOMARKDOWN"
    * - "MARKDOWN"
     * Legacy mode when no exportProfile is provided.
   *
   * @param {boolean} [options.forceDownload=false]
   * Forces download semantics in the result contract.
   * Note: multi-language export implies download automatically.
   *
   * @param {function(Error|null, object=):void} callback Node-style callback.
  *
  * Export profile fields (config `ExportProfiles.<name>`):
  * - renderer {"HTML"|"HUGO"|"MARKDOWN"}
  * - rendererOptions {object} optional renderer constructor options
  * - pathTemplate {string} required for zip markdown/hugo entry names
  *   supported placeholders:
  *   - ##lang##
  *   - ##blogNumber-4-digits##
  * - fileNameTemplate {string} optional external download file name template
  *   supported placeholders:
  *   - ##blogName##
  *   - ##renderer##
  *   - ##langList##
  *   - ##blogNumber-4-digits##
  *
  * Note:
  * - Extension is appended automatically (.html/.md/.zip) unless already present.
  * - zip output is currently produced for markdown/hugo multi-language exports.
   *
   * Callback result object:
   * - lang {string[]} resolved language list
  * - rendererType {"HTML"|"HUGO"|"MARKDOWN"} effective renderer
   * - asMarkdown {boolean} effective rendering mode
   * - multiExport {boolean} true if lang has more than one entry
   * - forceDownload {boolean} effective download flag
   * - fileName {string} suggested download filename
   * - mimeType {string} content type for HTTP response
   * - bodyType {"string"|"stream"} payload type
   * - body {string|stream.Readable} payload content
   * - preview {string} html/markdown text for view rendering (empty for stream payload)
   * - containsEmptyArticlesWarning {boolean} optional warning indicator
   */
  buildPreviewExport(options, callback) {
    debug("buildPreviewExport");
    assert(typeof (options) === "object");
    assert(typeof (callback) === "function");
    const self = this;
    const blogName = this.name;

    // Resolve export profile or fall back to renderer parameter
    let rendererType = "HTML";
    let profileConfig = null;
    let rendererOptions = undefined;

    if (options.exportProfile && typeof options.exportProfile === "string") {
      profileConfig = config.getValue("ExportProfiles", options.exportProfile);
      if (!profileConfig) {
        return callback(new Error(`Unknown export profile: ${options.exportProfile}`));
      }
      rendererType = profileConfig.renderer || "HTML";
      rendererOptions = profileConfig.rendererOptions;
    } else if (options.renderer && typeof options.renderer === "string") {
      // Legacy: direct renderer parameter
      const requestedRenderer = options.renderer.trim().toUpperCase();
      const allowedRenderers = ["HTML", "HUGO", "HUGOMARKDOWN", "MARKDOWN"];
      if (allowedRenderers.indexOf(requestedRenderer) < 0) {
        return callback(new Error(`Unknown renderer type: ${options.renderer}`));
      }
      rendererType = (requestedRenderer === "HUGOMARKDOWN") ? "HUGO" : requestedRenderer;
    }

    let lang = options.lang;
    const asMarkdown = (rendererType !== "HTML");
    const exportAllLanguagesInMarkdown = (asMarkdown && lang === "ALL");
    let containsEmptyArticlesWarning = false;

    function isClosed(l) {
      if (self["close" + l] === true) return true;
      return false;
    }

    if (Array.isArray(lang)) {
      lang = lang.filter((l) => language.getLanguages()[l]);
      if (lang.length === 0) lang = ["EN"];
    } else {
      if (typeof (lang) === "undefined") lang = "EN";
      if ((lang !== "ALL" && !language.getLanguages()[lang])) lang = "EN";

      if (lang === "ALL") {
        if (exportAllLanguagesInMarkdown) {
          lang = language.getLid();
        } else {
          lang = language.getLid().filter(isClosed);
        }
      } else {
        lang = [lang];
      }
    }

    const multiExport = (lang.length > 1);
    const forceDownload = (options.forceDownload === true) || multiExport;

    function listify(result, value, index) {
      if (index === 0) return value;
      return result + "-" + value;
    }

    function createInlineBundleWriter(withLanguageMarkers) {
      let result = "";
      return {
        append(content, meta) {
          if (withLanguageMarkers) {
            result += `[:${meta.langCode}]` + content;
          } else {
            result = content;
          }
        },
        finalize() {
          if (withLanguageMarkers) result += "[:]";
        },
        getBody() {
          return result;
        }
      };
    }

    function createZipBundleWriter() {
      const archive = new ZipArchive("zip", { zlib: { level: 9 } });
      return {
        append(content, meta) {
          archive.append(content, { name: meta.fileName });
        },
        finalize() {
          archive.finalize();
        },
        getBody() {
          return archive;
        }
      };
    }

    function markdownExportFileName(exportLang) {
      const wn_4_digit = String(self.name).replace(/\D/g, "").padStart(4, "0");
      let pathTemplate = profileConfig && profileConfig.pathTemplate;

      // Legacy renderer mode without explicit exportProfile: resolve from profile config dynamically
      if (!pathTemplate && !options.exportProfile) {
        const exportProfiles = config.getValue("ExportProfiles", { mustExist: true });
        const fallbackProfileName = (rendererType === "MARKDOWN") ? "MarkdownDownload" : "HugoDownload";
        if (exportProfiles[fallbackProfileName]) {
          pathTemplate = exportProfiles[fallbackProfileName].pathTemplate;
        }
      }

      if (!pathTemplate) {
        const requestedProfile = options.exportProfile || "<legacy-renderer>";
        throw new Error(`Missing pathTemplate for export profile: ${requestedProfile}`);
      }

      const exportPath = util.replaceTemplateVariables(pathTemplate,
        { lang: language.wpExportName(exportLang).toLowerCase(),
          "blogNumber-4-digits": wn_4_digit });
      return `${exportPath}.md`;
    }

    function resolveDownloadFileName(defaultFileName, extension) {
      if (!profileConfig || !profileConfig.fileNameTemplate) return defaultFileName;

      const wn_4_digit = String(self.name).replace(/\D/g, "").padStart(4, "0");
      const templatedName = util.replaceTemplateVariables(profileConfig.fileNameTemplate, {
        blogName: blogName,
        renderer: rendererType.toLowerCase(),
        langList: lang.reduce(listify),
        "blogNumber-4-digits": wn_4_digit
      });

      if (!templatedName || templatedName.trim() === "") return defaultFileName;
      if (templatedName.toLowerCase().endsWith(`.${extension}`)) return templatedName;
      return `${templatedName}.${extension}`;
    }

    const bundleWriter = (asMarkdown && multiExport)
      ? createZipBundleWriter()
      : createInlineBundleWriter(multiExport);

    function mergeRendererResultFunction() {
      return function _mergeRendererResultFunction(exportLang, callback) {
        self.getPreviewData({ lang: exportLang, createTeam: true, disableNotranslation: true, warningOnEmptyMarkdown: true }, function(err, data) {
          if (err) return callback(err);
          if (data.containsEmptyArticlesWarning) containsEmptyArticlesWarning = true;

          // Use profile-specified options or default to production for HTML
          const resolvedOptions = rendererOptions || ((rendererType === "HTML") ? { target: "production" } : undefined);
          const renderer = blogRenderer.createRenderer(rendererType, self, resolvedOptions);
          const createEmptyForOpenLanguage = exportAllLanguagesInMarkdown && self["close" + exportLang] !== true;
          const result = renderer.renderBlog(exportLang, data, createEmptyForOpenLanguage);

          if (asMarkdown && multiExport) {
            bundleWriter.append(result, { fileName: markdownExportFileName(exportLang) });
          } else {
            bundleWriter.append(result, { langCode: language.wpExportName(exportLang).toLowerCase() });
          }

          return callback(null);
        });
      };
    }

    eachSeries(lang, mergeRendererResultFunction(), function(err) {
      if (err) return callback(err);
      bundleWriter.finalize();

      const overallResult = bundleWriter.getBody();

      let fileName = `${blogName}_${lang.reduce(listify)} ${self.name}.html`;
      let mimeType = "text/html";
      if (asMarkdown) {
        fileName = `${blogName}_${lang.reduce(listify)} ${self.name}.md`;
        mimeType = "text/markdown";
        if (multiExport) {
          fileName = `${blogName}.zip`;
          mimeType = "application/zip";
        }
      }

      if (mimeType === "application/zip") {
        fileName = resolveDownloadFileName(fileName, "zip");
      } else if (mimeType === "text/markdown") {
        fileName = resolveDownloadFileName(fileName, "md");
      } else {
        fileName = resolveDownloadFileName(fileName, "html");
      }

      const result = {
        lang: lang,
        rendererType: rendererType,
        asMarkdown: asMarkdown,
        multiExport: multiExport,
        forceDownload: forceDownload,
        fileName: fileName,
        mimeType: mimeType,
        bodyType: (typeof overallResult === "string") ? "string" : "stream",
        body: overallResult,
        preview: (typeof overallResult === "string") ? overallResult : ""
      };

      if (containsEmptyArticlesWarning) result.containsEmptyArticlesWarning = true;
      return callback(null, result);
    });
  }

  // markAsAutoTranslated(user, lang, callback)
  // Notes that the scheduler rule Transition.AutoTranslate has translated lang,
  // so it runs only once per blog and language. Operational field like
  // exportedBy (see markAsExported below): not in the changes log, the
  // "translation with ..." blog log entry is the editor facing trace.
  markAsAutoTranslated(user, lang, callback) {
    debug("markAsAutoTranslated");
    const updated = Object.assign({}, (this.autoTranslated && typeof this.autoTranslated === "object") ? this.autoTranslated : {});
    updated[lang] = new Date().toISOString();
    this.setAndSave(user, { autoTranslated: updated }, callback);
  }

  /**
   * Tell the language team once per blog that Auto Close could not close
   * its reviewed language, and why (issue #1130): sends `sendCloseBlocked`
   * to the message center (Mattermost channels of that language) and notes
   * the language in `closeBlockedNotified`. Like `autoTranslated` an
   * operational field, not written to the change history.
   * @param {object} user actor, e.g. { OSMUser: "autoclose-review" }
   * @param {string} lang language id
   * @param {string[]} problems from getCloseProblems
   * @param {function(Error=)} callback called when done (also if already reported)
   */
  reportCloseBlocked(user, lang, problems, callback) {
    debug("reportCloseBlocked");
    const self = this;
    const notified = (self.closeBlockedNotified && typeof self.closeBlockedNotified === "object") ? self.closeBlockedNotified : {};
    if (notified[lang]) return callback();
    messageCenter.global.sendCloseBlocked(user, self, lang, problems, function(err) {
      if (err) return callback(err);
      const updated = Object.assign({}, notified);
      updated[lang] = new Date().toISOString();
      self.setAndSave(user, { closeBlockedNotified: updated }, callback);
    });
  }

  // markAsExported(user, exportProfile, lang, callback)
  // Sets the export marker for the given exportProfile and lang.
  // Goes through setAndSave, same as every other blog mutation - "every
  // change is broadcast to every notification receiver, and it's up to
  // each receiver to decide whether it's relevant" is exactly how
  // MailReceiver/SlackReceiver already behave. The receivers that would
  // otherwise turn this into editor-facing noise are taught to ignore it:
  // LogModuleReceiver is wrapped in a FilterReceiver (see
  // notification/messageCenter.js) so an exportedBy-only change never
  // becomes a Postgres changes-log row, and Mail/Slack already only react
  // to an actual `change.status`, which this never sets. The admin-facing
  // audit trail instead goes to a rotating text log file, written by
  // notification/exportReceiver.js listening on the same broadcast - same
  // reasoning as the existing mail delivery log (maillog_*): less Postgres
  // load, nothing editors need to see, admins can still read it.
  markAsExported(user, exportProfile, lang, callback) {
    debug("markAsExported");
    const currentExportedBy = (this.exportedBy && typeof this.exportedBy === "object") ? this.exportedBy : {};
    const updatedExportedBy = JSON.parse(JSON.stringify(currentExportedBy));
    if (!updatedExportedBy[exportProfile] || typeof updatedExportedBy[exportProfile] !== "object") {
      updatedExportedBy[exportProfile] = {};
    }
    updatedExportedBy[exportProfile][lang] = new Date().toISOString();
    this.setAndSave(user, { exportedBy: updatedExportedBy }, callback);
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
      self.#articles = result;
      articleModule.calculateDerivedFromChangesForList(result, function(err) {
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

              if (util.mentions(comment, user.OSMUser)) {
                self._userMention.push(result[i]);
                break;
              }
              if ((mainLang && util.mentions(comment, mainLang)) || util.mentions(comment, "all")) {
                self._mainLangMention.push(result[i]);
                break;
              }
              if ((secondLang && util.mentions(comment, secondLang)) || util.mentions(comment, "all")) {
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

function getComparableBlogStartDate(blog) {
  const parsedStartDate = Date.parse(blog.startDate);
  if (Number.isNaN(parsedStartDate)) return null;
  return parsedStartDate;
}

function getComparableBlogNumber(blog) {
  if (typeof blog.name !== "string") return null;
  const match = blog.name.match(/^WN(\d+)$/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

// findPreviousBlogs(blog,count,callback)
// returns the up to count blogs before blog (WN<n-1> ... WN<n-count>),
// blogs that do not exist are left out
export function findPreviousBlogs(blog, count, callback) {
  debug("findPreviousBlogs");
  const number = getComparableBlogNumber(blog);
  if (number === null) return callback(null, []);
  const prefix = blog.name.replace(/\d+$/, "");
  const result = [];
  let k = 1;
  function next() {
    if (k > count || number - k < 0) return callback(null, result);
    findOne({ name: prefix + (number - k) }, function (err, previous) {
      if (err) return callback(err);
      if (previous) result.push(previous);
      k += 1;
      next();
    });
  }
  next();
}

function isWeeklyNoteBlog(blog) {
  return getComparableBlogNumber(blog) !== null;
}

function compareCurrentEditBlogCandidate(leftBlog, rightBlog) {
  const leftStartDate = getComparableBlogStartDate(leftBlog);
  const rightStartDate = getComparableBlogStartDate(rightBlog);

  if (leftStartDate !== rightStartDate) {
    if (leftStartDate === null) return -1;
    if (rightStartDate === null) return 1;
    return leftStartDate - rightStartDate;
  }

  const leftNumber = getComparableBlogNumber(leftBlog);
  const rightNumber = getComparableBlogNumber(rightBlog);

  if (leftNumber !== rightNumber) {
    if (leftNumber === null) return -1;
    if (rightNumber === null) return 1;
    return leftNumber - rightNumber;
  }

  const leftName = (typeof leftBlog.name === "string") ? leftBlog.name : "";
  const rightName = (typeof rightBlog.name === "string") ? rightBlog.name : "";
  if (leftName !== rightName) return leftName.localeCompare(rightName);

  return Number(leftBlog.id || 0) - Number(rightBlog.id || 0);
}

function isCurrentBlogRouteId(id) {
  return typeof id === "string" && id.toLowerCase() === "current";
}

function resolveBlogRouteAlias(id, callback) {
  if (id === "TBC") return callback(null, getTBC());
  if (isCurrentBlogRouteId(id)) return findCurrentEditBlog(callback);
  return callback(null, null);
}

function findBlogByRouteId(id, callback) {
  function _findBlogByRouteId(id, callback) {
    debug("findBlogByRouteId(%s)", id);
    resolveBlogRouteAlias(id, function(err, aliasBlog) {
      if (err) return callback(err);
      if (aliasBlog) return callback(null, aliasBlog);

      findById(id, function(err, blog) {
        if (err) return callback(err);
        if (blog) return callback(null, blog);

        find({ name: id }, function(err, result) {
          if (err) return callback(err);
          if (result.length === 0) return callback(null, null);
          if (result.length > 1) return callback(new Error("Blog >" + id + "< exists twice, internal id of first: " + result[0].id));
          return callback(null, result[0]);
        });
      });
    });
  }

  if (callback) {
    return _findBlogByRouteId(id, callback);
  }
  return new Promise((resolve, reject) => {
    _findBlogByRouteId(id, (err, result) => err ? reject(err) : resolve(result));
  });
}

export function findBlogByRouteIdForUser(id, user, callback) {
  if (typeof user === "function") {
    callback = user;
    user = null;
  }

  function _findBlogByRouteIdForUser(id, user, callback) {
    debug("findBlogByRouteIdForUser(%s)", id);
    findBlogByRouteId(id, function(err, blog) {
      if (err) return callback(err);
      if (!blog || !user) return callback(null, blog);
      return blog.calculateDerived(user, function(derivedErr) {
        if (derivedErr) return callback(derivedErr);
        return callback(null, blog);
      });
    });
  }

  if (callback) {
    return _findBlogByRouteIdForUser(id, user, callback);
  }
  return new Promise((resolve, reject) => {
    _findBlogByRouteIdForUser(id, user, (err, result) => err ? reject(err) : resolve(result));
  });
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
      if (err) return callback(err);
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

export function findCurrentEditBlog(callback) {
  function _findCurrentEditBlog(callback) {
    debug("findCurrentEditBlog");
    find({ status: "edit" }, function(err, blogs) {
      if (err) return callback(err);
      if (!blogs || blogs.length === 0) return callback(null, null);

      const weeklyNoteBlogs = blogs.filter(isWeeklyNoteBlog);
      if (weeklyNoteBlogs.length === 0) return callback(null, null);

      const currentEditBlog = weeklyNoteBlogs.reduce(function(bestBlog, candidateBlog) {
        if (!bestBlog) return candidateBlog;
        if (compareCurrentEditBlogCandidate(candidateBlog, bestBlog) > 0) return candidateBlog;
        return bestBlog;
      }, null);

      return callback(null, currentEditBlog);
    });
  }

  if (callback) {
    return _findCurrentEditBlog(callback);
  }
  return new Promise((resolve, reject) => {
    _findCurrentEditBlog((err, result) => err ? reject(err) : resolve(result));
  });
}

// getOutstandingLangsForBlog(blog, exportProfile, langs)
// Returns the subset of langs for which blog is closed but not yet exported
// under exportProfile. Shared by findBlogsForOutstandingExport,
// buildOutstandingExportZip and the dry-run listing in routes/api.js.
function getOutstandingLangsForBlog(blog, exportProfile, langs) {
  return langs.filter(function(lang) {
    if (blog["close" + lang] !== true) return false;
    const exportedBy = blog.exportedBy;
    if (!exportedBy || !exportedBy[exportProfile]) return true;
    return !exportedBy[exportProfile][lang];
  });
}

// isWithinBlogNumberRange(blog, options)
// options.minBlogNumber / options.maxBlogNumber are inclusive bounds on the
// numeric WN number (e.g. 256 for "WN256"). Lets a caller page through a
// large backlog of outstanding blogs instead of getting all of them (there
// can be hundreds) in a single response.
function isWithinBlogNumberRange(blog, options) {
  if (!options) return true;
  const number = getComparableBlogNumber(blog);
  if (number === null) return false;
  if (typeof options.minBlogNumber === "number" && number < options.minBlogNumber) return false;
  if (typeof options.maxBlogNumber === "number" && number > options.maxBlogNumber) return false;
  return true;
}

// findBlogsForOutstandingExport(exportProfile, langs, options, callback)
// options is optional: { minBlogNumber, maxBlogNumber } (both inclusive).
// Returns all WeeklyNote blogs that:
//   - have status 'edit' or 'closed'
//   - are within [minBlogNumber, maxBlogNumber] if given
//   - have close{LANG} === true for at least one of the given langs
//   - have NOT yet been exported under exportProfile for that lang
//     (i.e. exportedBy[exportProfile][lang] is not set)
// langs: array of language codes, e.g. ["DE","EN"]
export function findBlogsForOutstandingExport(exportProfile, langs, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = null;
  }
  function _findBlogsForOutstandingExport(callback) {
    debug("findBlogsForOutstandingExport");
    find(function(err, blogs) {
      if (err) return callback(err);
      if (!blogs || blogs.length === 0) return callback(null, []);

      const eligible = blogs.filter(function(blog) {
        if (!isWeeklyNoteBlog(blog)) return false;
        if (blog.status !== "edit" && blog.status !== "closed") return false;
        if (!isWithinBlogNumberRange(blog, options)) return false;
        return getOutstandingLangsForBlog(blog, exportProfile, langs).length > 0;
      });

      return callback(null, eligible);
    });
  }

  if (callback) {
    return _findBlogsForOutstandingExport(callback);
  }
  return new Promise((resolve, reject) => {
    _findBlogsForOutstandingExport((err, result) => err ? reject(err) : resolve(result));
  });
}

// buildExportZipForBlogLangs(blogsWithLangs, profileConfig, onArchiveReady, callback)
// blogsWithLangs: [{ blog, langs: ["DE","EN"] }, ...] - the blog/lang
// selection is entirely up to the caller (outstanding and closedSince use
// different selection rules, see findBlogsForOutstandingExport resp.
// findBlogsClosedSince); this only renders and zips what it is given.
// onArchiveReady is optional (3-arg call form keeps the old behavior). When
// given, it is called ONCE, synchronously, with the ZipArchive as soon as it
// exists (or `null` when there is nothing to export) - i.e. before any
// blog/lang has been rendered. This lets a caller start `archive.pipe(res)`
// and send response headers immediately, instead of waiting for the whole
// (potentially slow) render loop below to finish, which is what previously
// made large outstanding/closedSince downloads sit silent long enough for
// nginx's upstream read-timeout to kill the connection.
// Returns (via callback, once rendering is fully done) { archive: ZipArchive|null,
// toMark: [{blog, lang}], failures: [{blog, lang, error}] }. archive is null
// when there is nothing to export.
// A rendering failure for one blog/lang does NOT abort the whole batch: it is
// recorded in `failures` and skipped, so the other blogs/langs still get
// exported. If there are any failures, they are additionally embedded as a
// human-readable "_export-warnings.txt" entry in the zip itself - once
// streaming has started early via onArchiveReady, response headers are long
// gone by the time failures are known, so a response header can no longer
// carry this information.
function buildExportZipForBlogLangs(blogsWithLangs, profileConfig, onArchiveReady, callback) {
  if (typeof callback === "undefined") {
    callback = onArchiveReady;
    onArchiveReady = null;
  }
  const rendererType = profileConfig.renderer || "HTML";
  const rendererOptions = profileConfig.rendererOptions;
  const pathTemplate = profileConfig.pathTemplate;

  const hasAnyLang = blogsWithLangs.some(function(entry) { return entry.langs && entry.langs.length > 0; });
  if (!hasAnyLang) {
    if (onArchiveReady) onArchiveReady(null);
    return callback(null, { archive: null, toMark: [], failures: [] });
  }

  const archive = new ZipArchive("zip", { zlib: { level: 9 } });
  if (onArchiveReady) onArchiveReady(archive);
  const toMark = [];
  const failures = [];

  eachSeries(blogsWithLangs, function(entry, blogCb) {
    const blog = entry.blog;
    const eligibleLangs = entry.langs;

    eachSeries(eligibleLangs, function(exportLang, langCb) {
      blog.getPreviewData({ lang: exportLang, createTeam: true, disableNotranslation: true, warningOnEmptyMarkdown: true }, function(err, data) {
        if (err) {
          failures.push({ blog, lang: exportLang, error: err });
          return langCb();
        }

        let content;
        try {
          const renderer = blogRenderer.createRenderer(rendererType, blog, rendererOptions);
          content = renderer.renderBlog(exportLang, data, false);
        } catch (renderErr) {
          failures.push({ blog, lang: exportLang, error: renderErr });
          return langCb();
        }

        const wn_4_digit = String(blog.name).replace(/\D/g, "").padStart(4, "0");
        const exportPath = util.replaceTemplateVariables(pathTemplate,
          { lang: language.wpExportName(exportLang).toLowerCase(), "blogNumber-4-digits": wn_4_digit });
        const fileName = `${exportPath}.md`;

        archive.append(content, { name: fileName });
        toMark.push({ blog, lang: exportLang });
        langCb();
      });
    }, blogCb);
  }, function(err) {
    if (err) return callback(err);
    if (failures.length > 0) {
      const warningsText = failures.map(function(f) {
        return `${f.blog.name}:${f.lang}: ${f.error.message}`;
      }).join("\n") + "\n";
      archive.append(warningsText, { name: "_export-warnings.txt" });
    }
    archive.finalize();
    return callback(null, { archive, toMark, failures });
  });
}

// buildOutstandingExportZip(exportProfile, langs, options, [onArchiveReady,] callback)
// options is optional: { minBlogNumber, maxBlogNumber }, see
// findBlogsForOutstandingExport.
// onArchiveReady is optional - see buildExportZipForBlogLangs for what it's for.
// Renders all eligible blogs (from findBlogsForOutstandingExport) into a single combined ZIP.
// Returns { archive: ZipArchive|null, toMark: [{blog, lang}], failures: [{blog, lang, error}] }
// archive is null when no eligible blogs exist.
// A rendering failure for one blog/lang does NOT abort the whole batch: it is
// recorded in `failures` and skipped, so the other blogs/langs still get exported.
export function buildOutstandingExportZip(exportProfile, langs, options, onArchiveReady, callback) {
  if (typeof options === "function") {
    callback = options;
    onArchiveReady = null;
    options = null;
  } else if (typeof onArchiveReady === "function" && typeof callback !== "function") {
    callback = onArchiveReady;
    onArchiveReady = null;
  }
  function _buildOutstandingExportZip(callback) {
    debug("buildOutstandingExportZip");

    const profileConfig = config.getValue("ExportProfiles", exportProfile);
    if (!profileConfig) {
      return callback(new Error(`Unknown export profile: ${exportProfile}`));
    }
    if (!profileConfig.pathTemplate) {
      return callback(new Error(`Export profile '${exportProfile}' has no pathTemplate and cannot be used for outstanding bundle export`));
    }

    findBlogsForOutstandingExport(exportProfile, langs, options, function(err, blogs) {
      if (err) return callback(err);
      const blogsWithLangs = blogs.map(function(blog) {
        return { blog, langs: getOutstandingLangsForBlog(blog, exportProfile, langs) };
      });
      buildExportZipForBlogLangs(blogsWithLangs, profileConfig, onArchiveReady, callback);
    });
  }

  if (callback) {
    return _buildOutstandingExportZip(callback);
  }
  return new Promise((resolve, reject) => {
    _buildOutstandingExportZip((err, result) => err ? reject(err) : resolve(result));
  });
}

// findBlogsClosedSince(since, langs, options, callback)
// options is optional: { minBlogNumber, maxBlogNumber }, see
// findBlogsForOutstandingExport.
// since: a date string usable with the changes-log "GE:" query operator
// (e.g. "2026-01-01").
// Looks at the changes log for close{LANG} -> true transitions logged on or
// after `since`, then keeps only the ones where the blog is STILL closed for
// that language now (a later reopen drops it again - this is intentionally
// "closed now, and has been closed at some point since `since`", not
// "closed at any point since `since` regardless of current state").
// Unlike findBlogsForOutstandingExport, this does NOT look at exportedBy -
// it is a read-only report/re-export helper and does not participate in the
// outstanding-export bookkeeping.
// Returns [{ blog, langs: [...] }, ...] (only blogs with >=1 matching lang).
export function findBlogsClosedSince(since, langs, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = null;
  }
  function _findBlogsClosedSince(callback) {
    debug("findBlogsClosedSince");

    const properties = langs.map(function(lang) { return "close" + lang; });
    logModule.find({
      table: "blog",
      property: "IN(" + properties.join(",") + ")",
      to: "true",
      timestamp: "GE:" + since
    }, { column: "timestamp", desc: true }, function(err, changes) {
      if (err) return callback(err);
      if (!changes || changes.length === 0) return callback(null, []);

      // Which languages were closed (to=true) at least once since `since`,
      // keyed by blog name (the log has no reliable typed id to join on).
      const candidateLangsByBlog = new Map();
      changes.forEach(function(change) {
        if (typeof change.property !== "string" || change.property.substring(0, 5) !== "close") return;
        const lang = change.property.substring(5);
        if (!langs.includes(lang) || !change.blog) return;
        if (!candidateLangsByBlog.has(change.blog)) candidateLangsByBlog.set(change.blog, new Set());
        candidateLangsByBlog.get(change.blog).add(lang);
      });
      if (candidateLangsByBlog.size === 0) return callback(null, []);

      find(function(err, blogs) {
        if (err) return callback(err);

        const result = [];
        blogs.forEach(function(blog) {
          const candidateLangs = candidateLangsByBlog.get(blog.name);
          if (!candidateLangs) return;
          if (!isWeeklyNoteBlog(blog)) return;
          if (!isWithinBlogNumberRange(blog, options)) return;

          // Only keep languages that are STILL closed now - drops a
          // language that got reopened again after the logged close event.
          const closedLangs = langs.filter(function(lang) {
            return candidateLangs.has(lang) && blog["close" + lang] === true;
          });
          if (closedLangs.length === 0) return;
          result.push({ blog, langs: closedLangs });
        });
        return callback(null, result);
      });
    });
  }

  if (callback) {
    return _findBlogsClosedSince(callback);
  }
  return new Promise((resolve, reject) => {
    _findBlogsClosedSince((err, result) => err ? reject(err) : resolve(result));
  });
}

// buildClosedSinceExportZip(exportProfile, since, langs, options, [onArchiveReady,] callback)
// options is optional: { minBlogNumber, maxBlogNumber }, see
// findBlogsClosedSince.
// onArchiveReady is optional - see buildExportZipForBlogLangs for what it's for.
// Renders every blog+lang returned by findBlogsClosedSince into a single
// combined ZIP, same shape as buildOutstandingExportZip. Read-only: it does
// NOT call markAsExported / touch exportedBy, so re-running it for the same
// (or an overlapping) date range is safe and has no effect on `outstanding`.
export function buildClosedSinceExportZip(exportProfile, since, langs, options, onArchiveReady, callback) {
  if (typeof options === "function") {
    callback = options;
    onArchiveReady = null;
    options = null;
  } else if (typeof onArchiveReady === "function" && typeof callback !== "function") {
    callback = onArchiveReady;
    onArchiveReady = null;
  }
  function _buildClosedSinceExportZip(callback) {
    debug("buildClosedSinceExportZip");

    const profileConfig = config.getValue("ExportProfiles", exportProfile);
    if (!profileConfig) {
      return callback(new Error(`Unknown export profile: ${exportProfile}`));
    }
    if (!profileConfig.pathTemplate) {
      return callback(new Error(`Export profile '${exportProfile}' has no pathTemplate and cannot be used for closedSince bundle export`));
    }

    findBlogsClosedSince(since, langs, options, function(err, blogsWithLangs) {
      if (err) return callback(err);
      buildExportZipForBlogLangs(blogsWithLangs, profileConfig, onArchiveReady, callback);
    });
  }

  if (callback) {
    return _buildClosedSinceExportZip(callback);
  }
  return new Promise((resolve, reject) => {
    _buildClosedSinceExportZip((err, result) => err ? reject(err) : resolve(result));
  });
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Collecting period of the blog that follows a blog ending at previousEndTs.
 *
 * With `Transition.AutoEditMode.editAt` (weekday/time when a blog goes to
 * edit and the next one is created): the new blog starts one minute after
 * the previous end and ends one minute before the first editAt that is at
 * least one day after its start (e.g. editAt THU 0:00 → Thursday 00:00 to
 * Wednesday 23:59). A previous end off the weekly rhythm is caught up by a
 * shorter or longer blog. Without (or with an invalid) editAt: start one
 * day after the previous end, end `BlogDurationDays` (default 7) days
 * after it.
 * @param {number} previousEndTs end of the previous blog in ms
 * @returns {{startDate: string, endDate: string}} ISO strings
 */
export function calculateNewBlogDates(previousEndTs) {
  const transition = config.getValue("Transition", { default: {} }) || {};
  const rawEditAt = (transition.AutoEditMode || {}).editAt;
  const editAt = normaliseWeeklyTime(rawEditAt);
  if (editAt) {
    const startTs = previousEndTs + MINUTE_MS;
    const endTs = nextWeeklyTimeAtOrAfter(startTs + DAY_MS, editAt) - MINUTE_MS;
    return { startDate: new Date(startTs).toISOString(), endDate: new Date(endTs).toISOString() };
  }
  if (rawEditAt !== undefined && rawEditAt !== null) {
    config.logger.warn("Transition.AutoEditMode.editAt invalid, BlogDurationDays used");
  }
  let blogDurationDays = Number(config.getValue("BlogDurationDays", { default: 7 }));
  if (!Number.isFinite(blogDurationDays) || blogDurationDays <= 0) blogDurationDays = 7;
  blogDurationDays = Math.round(blogDurationDays);
  const startDate = new Date(previousEndTs);
  startDate.setDate(startDate.getDate() + 1);
  const endDate = new Date(previousEndTs);
  endDate.setDate(endDate.getDate() + blogDurationDays);
  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
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
      const dates = calculateNewBlogDates(endDate.getTime());
      blog.name = newName;
      blog.status = "open";
      blog.startDate = dates.startDate;
      blog.endDate = dates.endDate;
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
      // use series to have a definite order of articles, which helps in testscripts
      eachOfSeries(newArticles,
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


let _autoEditModeRunning = 0;

// Switch open blogs past their endDate to edit and create a new blog if
// none is open. Whether this runs at all (Transition.AutoEditMode.enabled)
// is decided by the caller, model/blogTransitionScheduler.js.
function runAutoEditMode(callback) {
  debug("runAutoEditMode");
  // Do not run this function twice !
  if (_autoEditModeRunning > 0) return callback();
  _autoEditModeRunning = _autoEditModeRunning + 1;




  find({ status: "open" }, { column: "endDate", desc: false }, function(err, result) {
    if (err) {
      _autoEditModeRunning = _autoEditModeRunning - 1;
      return callback(err);
    }
    assert(Array.isArray(result));
    series([
      function series1CloseAllBlogs(cb) {
        each(result, function(data, cb) {
          data.startEditModeIfEnded(cb);
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
      _autoEditModeRunning = _autoEditModeRunning - 1;
      callback(err);
    });
  });
}

function convertLogsToTeamString(logs, lang, users) {
  debug("convertLogsToTeamString");
  const editors = [];
  function addEditors(property, min) {
    for (const user in logs[property]) {
      if (logs[property][user] >= min) {
        // service users (DeepL, Claude, migration, import) are no contributors
        if (editors.indexOf(user) < 0 && !isServiceUser(user)) {
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
        if (users[j].mdWeeklyAuthor) {
          // Simle Markdown It without and plugin is enough for this case
          editors[i] = markdown.renderInline(users[j].mdWeeklyAuthor);
          continue;
        }
        // default the link with the OSM Profile
        editors[i] =
          '<a href="https://www.openstreetmap.org/user/' + encodeURIComponent(editors[i]) + '">' + editors[i] + "</a>";
      }
    }
  }

  let editorsString = "";
  if (editors.length >= 1) editorsString = editors[0];
  for (let i2 = 1; i2 < editors.length; i2++) {
    editorsString += ", " + editors[i2];
  }

  const editorStrings = configModule.getConfig("editorstrings");
  if (editorStrings[lang]) return util.replaceTemplateVariables(editorStrings[lang], { team: editorsString });
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
  findBlogByRouteId: findBlogByRouteId,
  findBlogByRouteIdForUser: findBlogByRouteIdForUser,
  findCurrentEditBlog: findCurrentEditBlog,
  findPreviousBlogs: findPreviousBlogs,
  findBlogsForOutstandingExport: findBlogsForOutstandingExport,
  buildOutstandingExportZip: buildOutstandingExportZip,
  getOutstandingLangsForBlog: getOutstandingLangsForBlog,
  findBlogsClosedSince: findBlogsClosedSince,
  buildClosedSinceExportZip: buildClosedSinceExportZip,
  getTBC: getTBC,
  create: create,
  sortArticles: sortArticles,
  sanitizeBlogKey: sanitizeBlogKey,
  runAutoEditMode: runAutoEditMode,
  calculateNewBlogDates: calculateNewBlogDates,
  createNewBlog: createNewBlog,
  getCategories: getGlobalCategories,
  statusList: BLOG_STATUS,
  pg: pg,
  Class: Blog

};

export default blogModule;
