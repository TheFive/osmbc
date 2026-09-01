
// Exported Functions and prototypes are defined at end of file

import { series, eachOfSeries, each, eachLimit, eachSeries } from "async";
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
import osmcalLoader from "../model/osmcalLoader.js";

import pgMap from "./pgMap.js";
import _debug from "debug";
import _markdownIt from "markdown-it";
import { ZipArchive } from "archiver";
import blogRenderer from "../render/BlogRenderer.js";
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
    const previousBlogState = Object.assign(Object.create(Object.getPrototypeOf(self)), self);
    delete self.lock;
    assert.notEqual(typeof self.id, "undefined");
    series([
      messageCenter.global.updateBlog.bind(messageCenter.global, user, previousBlogState, data),
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
          // Clear exportedBy marker for this language across all export profiles
          if (self.exportedBy && typeof self.exportedBy === "object") {
            for (const profile of Object.keys(self.exportedBy)) {
              if (self.exportedBy[profile] && typeof self.exportedBy[profile] === "object") {
                delete self.exportedBy[profile][options.lang];
              }
            }
          }
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
    // Legacy no-op: timer orchestration is handled centrally in blogTransitionScheduler.
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

// buildExportZipForBlogLangs(blogsWithLangs, profileConfig, callback)
// blogsWithLangs: [{ blog, langs: ["DE","EN"] }, ...] - the blog/lang
// selection is entirely up to the caller (outstanding and closedSince use
// different selection rules, see findBlogsForOutstandingExport resp.
// findBlogsClosedSince); this only renders and zips what it is given.
// Returns { archive: ZipArchive|null, toMark: [{blog, lang}], failures: [{blog, lang, error}] }
// archive is null when there is nothing to export.
// A rendering failure for one blog/lang does NOT abort the whole batch: it is
// recorded in `failures` and skipped, so the other blogs/langs still get exported.
function buildExportZipForBlogLangs(blogsWithLangs, profileConfig, callback) {
  const rendererType = profileConfig.renderer || "HTML";
  const rendererOptions = profileConfig.rendererOptions;
  const pathTemplate = profileConfig.pathTemplate;

  const hasAnyLang = blogsWithLangs.some(function(entry) { return entry.langs && entry.langs.length > 0; });
  if (!hasAnyLang) return callback(null, { archive: null, toMark: [], failures: [] });

  const archive = new ZipArchive("zip", { zlib: { level: 9 } });
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
    archive.finalize();
    return callback(null, { archive, toMark, failures });
  });
}

// buildOutstandingExportZip(exportProfile, langs, options, callback)
// options is optional: { minBlogNumber, maxBlogNumber }, see
// findBlogsForOutstandingExport.
// Renders all eligible blogs (from findBlogsForOutstandingExport) into a single combined ZIP.
// Returns { archive: ZipArchive|null, toMark: [{blog, lang}], failures: [{blog, lang, error}] }
// archive is null when no eligible blogs exist.
// A rendering failure for one blog/lang does NOT abort the whole batch: it is
// recorded in `failures` and skipped, so the other blogs/langs still get exported.
export function buildOutstandingExportZip(exportProfile, langs, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = null;
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
      buildExportZipForBlogLangs(blogsWithLangs, profileConfig, callback);
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

// buildClosedSinceExportZip(exportProfile, since, langs, options, callback)
// options is optional: { minBlogNumber, maxBlogNumber }, see
// findBlogsClosedSince.
// Renders every blog+lang returned by findBlogsClosedSince into a single
// combined ZIP, same shape as buildOutstandingExportZip. Read-only: it does
// NOT call markAsExported / touch exportedBy, so re-running it for the same
// (or an overlapping) date range is safe and has no effect on `outstanding`.
export function buildClosedSinceExportZip(exportProfile, since, langs, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = null;
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
      buildExportZipForBlogLangs(blogsWithLangs, profileConfig, callback);
    });
  }

  if (callback) {
    return _buildClosedSinceExportZip(callback);
  }
  return new Promise((resolve, reject) => {
    _buildClosedSinceExportZip((err, result) => err ? reject(err) : resolve(result));
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
      let blogDurationDays = Number(config.getValue("BlogDurationDays", { default: 7 }));
      if (!Number.isFinite(blogDurationDays) || blogDurationDays <= 0) blogDurationDays = 7;
      blogDurationDays = Math.round(blogDurationDays);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() + 1);
      endDate.setDate(endDate.getDate() + blogDurationDays);
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


let _autoCloseRunning = 0;

function isAutoEditModeEnabled() {
  const transitionConfig = config.getValue("Transition", { default: {} }) || {};

  if (transitionConfig && typeof transitionConfig === "object") {
    const autoEditMode = transitionConfig.AutoEditMode || {};
    if (autoEditMode.enabled === true || autoEditMode.enabled === "true") return true;
    if (autoEditMode.enabled === false || autoEditMode.enabled === "false") return false;
  }
  return true;
}



function autoCloseBlog(callback) {
  debug("autoCloseBlog");
  // Do not run this function twice !
  if (_autoCloseRunning > 0) return callback();
  if (!isAutoEditModeEnabled()) return callback();
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
  // Synthetic users the wp-reconcile migration tooling uses for audit-log
  // attribution (see wp-reconcile/ scripts) - never real contributors, so
  // they must not show up in the public credit sentence, same as the
  // API/translator users above.
  apiEditors.push("wp-backport", "wp-oldimport");
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





/* commented as it should be replaced by a central scheduler, that calls the autoCloseBlog function of the blog model and the autoCreateBlog function of the blog model
export function startAllTimers(callback) {
  debug("startAllTimers");
  autoCloseBlog(callback);
}*/


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
  findBlogsForOutstandingExport: findBlogsForOutstandingExport,
  buildOutstandingExportZip: buildOutstandingExportZip,
  getOutstandingLangsForBlog: getOutstandingLangsForBlog,
  findBlogsClosedSince: findBlogsClosedSince,
  buildClosedSinceExportZip: buildClosedSinceExportZip,
  getTBC: getTBC,
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
