

import express from "express";
import { BAD_REQUEST, CONFLICT, NOT_FOUND } from "http-status-codes";

import async from "async";
import { strict as assert } from "assert";
import _debug from "debug";

import config from "../config.js";
import language from "../model/language.js";

import util from "../util/util.js";
import moment from "moment";
import { dump as yamlDump, load as yamlLoad } from "js-yaml";
import configModule from "../model/config.js";


import blogModule from "../model/blog.js";
import blogTransitionScheduler from "../model/blogTransitionScheduler.js";
import blogRenderer from "../render/BlogRenderer.js";
import logModule from "../model/logModule.js";
import userModule from "../model/user.js";
import translator from "../model/translator.js";

import auth from "../routes/auth.js";
const router   = express.Router();
const debug = _debug("OSMBC:routes:blog");

const htmlroot = config.htmlRoot();


const reviewInWP = config.getValue("ReviewInWP", { default: [] });

function findBlogId(req, res, next, id) {
  debug("findBlogId");
  blogModule.findBlogByRouteIdForUser(id, req.user, function(err, result) {
    if (err) return next(err);
    req.blog = result;
    return next();
  });
}

// Route middleware after the access check (router.param runs before it,
// so the 404 must not come from findBlogId): every :blog_id route needs
// an existing blog, its handler can rely on req.blog.
function requireBlog(req, res, next) {
  if (req.blog) return next();
  const error = new Error("Blog >" + req.params.blog_id + "< does not exist");
  error.status = NOT_FOUND;
  return next(error);
}


function renderBlogStat(req, res, next) {
  debug("renderBlogStat");
  const blog = req.blog;

  const name = blog.name;
  let logs = {};
  const editors = {};
  const userMap = {};

  async.series([
    function readLogs(callback) {
      debug("readLogs");
      logModule.countLogsForBlog(name, function(err, result) {
        debug("countLogsForBlog Function");
        logs = result;
        debug(JSON.stringify(logs));
        if (err) return callback(err);

        callback();
      });
    }, function calculateEditors(callback) {
      const addEditors = function (lang, property, min) {
        for (const user in logs[property]) {
          if (logs[property][user] >= min) {
            if (editors[lang].indexOf(user) < 0) {
              editors[lang].push(user);
            }
          }
        }
      };
      for (const lang in language.getLanguages()) {
        editors[lang] = [];
        addEditors(lang, "collection", 3);
        addEditors(lang, "markdown" + lang, 2);
        addEditors(lang, "review" + lang, 1);
        editors[lang].sort();
      }
      callback();
    },
    function(callback) {
      debug("userColors");
      userModule.find({}, function (err, userlist) {
        if (err) return callback(err);
        for (let i = 0; i < userlist.length; i++) {
          userMap[userlist[i].OSMUser] = userlist[i];
        }
        return callback(null);
      });
    }
  ],
  function (err) {
    assert(res.rendervar);

    if (err) return next(err);
    res.set("content-type", "text/html");
    res.rendervar.layout.title = blog.name + "/statistic";
    res.render("blogstat", {
      layout: res.rendervar.layout,
      logs: logs,
      blog: blog,
      editors: editors,
      userMap: userMap,
      languages: language.getLid()
    });
  }
  );
}


function renderBlogList(req, res, next) {
  debug("renderBlogList");
  const status = req.query.status;
  const query = {};
  let additionalText;

  if (typeof (status) !== "undefined") {
    query.status = status;
  }


  async.auto({
    blogs: function(callback) {
      blogModule.find(query, { column: "name", desc: true }, function(err, blogs) {
        callback(err, blogs);
      });
    },
    count: ["blogs", function(result, callback) {
      async.eachLimit(result.blogs, 2, function(item, cb) {
        async.parallel([
          item.calculateDerived.bind(item, req.user),
          item.calculateTimeToClose.bind(item)
        ], function finalFunction(err) { return cb(err); });
      }, function(err) {
        callback(err);
      });
    }]
  }, function(err, result) {
    assert(res.rendervar);
    if (err) return next(err);
    res.set("content-type", "text/html");
    res.rendervar.layout.title = "blog/list";
    res.render("bloglist", {
      layout: res.rendervar.layout,
      additionalText: additionalText,
      blogs: result.blogs
    });
  });
}




function renderBlogPreview(req, res, next) {
  debug("renderBlogPreview");
  if (req.session) req.session.articleReturnTo = req.originalUrl;
  const blog = req.blog;

  const returnToUrl = req.session ? req.session.articleReturnTo : req.originalUrl;
  const selectedExportProfile = (typeof req.query.exportProfile === "string") ? req.query.exportProfile : "";

  // Support both exportProfile (new) and renderer (legacy) parameters
  const exportOptions = { lang: req.query.lang };
  if (req.query.exportProfile) {
    exportOptions.exportProfile = req.query.exportProfile;
  } else if (req.query.renderer) {
    exportOptions.renderer = req.query.renderer;
  } else {
    exportOptions.renderer = "HTML";
  }

  blog.buildPreviewExport(exportOptions, function(err, result) {
    debug("renderBlogPreview->final function");
    if (err) return next(err);

    const languageFlags = configModule.getConfig("languageflags");
    const doDownload = (req.query.download === "true") || result.forceDownload;
    if (doDownload) {
      res.set("content-type", result.mimeType);
      if (result.bodyType === "string") {
        return res.attachment(result.fileName).end(result.body);
      }
      res.attachment(result.fileName);
      result.body.pipe(res);
      return;
    }

    assert(res.rendervar);
    res.rendervar.layout.title = blog.name + "/preview";
    res.render("blogpreview", {
      layout: res.rendervar.layout,
      languageFlags: languageFlags,
      blog: blog,
      asMarkdown: result.asMarkdown,
      preview: result.preview,
      lang: result.lang,
      selectedExportProfile: selectedExportProfile,
      returnToUrl: returnToUrl,
      categories: blog.getCategories()
    });
  });
}

const blogTitleForExport = config.getValue("Blog Title For Export", { mustExist: true });

function renderBlogPreviewHeader(req, res, next) {
  debug("renderBlogPreviewHeader");
  try {
    if (req.session) req.session.articleReturnTo = req.originalUrl;
    const blog = req.blog;

    function listify(result, value, index) {
      if (index === 0) return value;
      return result + "-" + value;
    }
    const lang = language.getLid();

    const translation = configModule.getConfig("categorytranslation");

    const titleTrans = translation.filter(function isTitle(trans) { if (trans.EN === blogTitleForExport) return true; else return false; });
    if (titleTrans.length === 1) {
      const map = titleTrans[0];
      const number = blog.name.substring(2, 99);
      let content = "";
      lang.forEach((value) => { if (map[value]) content = content + `[:${language.wpExportName(value).toLowerCase()}]${map[value]} ${number}`; });
      content = content + "[:]";
      return res.attachment(`Header ${blog.name} ${lang.reduce(listify)} ${moment().locale(language.momentLocale(lang)).format()}.txt`).end(content);
    }
    res.next(new Error("Categorie Translation is missing Tile"));
  } catch (err) {
    console.error("Error in renderBlogPreviewHeader");
    console.error(err);
    return next(err);
  }
}

// The review form sends one field "text": the comment, or one of two
// values its buttons set ("Start Personal Review", "Stop review").
const personalReviewTexts = {
  "reviewing...": (blog, lang, user, cb) => blog.startPersonalReview(lang, user, cb),
  delete: (blog, lang, user, cb) => blog.stopPersonalReview(lang, user, cb)
};

function setReviewComment(req, res, next) {
  debug("setReviewComment");

  const lang = req.body.lang;
  const user = req.user;
  const text = req.body.text;

  function redirectBack(err) {
    if (err) return next(err);
    const referer = util.getSafeRedirectUrl(req.header("Referer"), config.htmlRoot() + "/osmbc", req.protocol + "://" + req.get("host"));
    res.redirect(referer);
  }
  if (Object.hasOwn(personalReviewTexts, text)) return personalReviewTexts[text](req.blog, lang, user, redirectBack);
  req.blog.addReviewComment(lang, user, text, redirectBack);
}

function editReviewComment(req, res, next) {
  debug("editReviewComment");

  const lang = req.body.lang;
  const user = req.user;
  const data = req.body.text;
  const index = req.params.index;


  req.blog.editReviewComment(lang, user, index, data, function(err) {
    if (err) return next(err);
    const referer = util.getSafeRedirectUrl(req.header("Referer"), config.htmlRoot() + "/osmbc", req.protocol + "://" + req.get("host"));
    res.redirect(referer);
  });
}

// action of a status button (blogReviewButtons) -> blog method
const blogStatusActions = {
  startreview: (blog, lang, user, cb) => blog.startReview(lang, user, cb),
  markexported: (blog, lang, user, cb) => blog.markExported(lang, user, cb),
  deleteallreviews: (blog, lang, user, cb) => blog.deleteAllReviews(lang, user, cb),
  closelang: (blog, lang, user, cb) => blog.closeLanguage(lang, user, cb),
  editlang: (blog, lang, user, cb) => blog.reopenLanguage(lang, user, cb)
};

function setBlogStatus(req, res, next) {
  debug("setBlogStatus");

  const action = req.body.action;
  if (!Object.hasOwn(blogStatusActions, action)) {
    const error = new Error("Unknown action >" + action + "<");
    error.status = BAD_REQUEST;
    return next(error);
  }
  blogStatusActions[action](req.blog, req.body.lang, req.user, function(err) {
    // e.g. close refused because articles are not written yet:
    // the page shows the message to the editor
    if (err && err.status === CONFLICT) {
      return res.status(CONFLICT).type("text/plain").send(err.message);
    }
    if (err) return next(err);
    res.send("OK");
  });
}

// close problems of every language that is still open, and whether Auto
// Close is already due, for the Close button and the banner (#1137, #1130)
function collectCloseInfo(blog, user, callback) {
  blog.getCloseProblemsAll(language.getLid(), user, function(err, problems) {
    if (err) return callback(err);
    callback(null, { problems: problems, autoClose: blogTransitionScheduler.getLanguageCloseState(blog) });
  });
}

function renderBlogTab(req, res, next) {
  debug("renderBlogTab");

  const blog = req.blog;

  let tab = req.query.tab;
  if (!tab) tab = req.params.tab;


  const votes = configModule.getConfig("votes");

  if (!tab) tab = req.session.lasttab;
  if (!tab) tab = "Overview";

  if (["full", "overview", "review"].indexOf(tab.toLowerCase()) < 0) return next();

  req.session.lasttab = tab;

  if (req.params.blog_id === "TBC") tab = "TBC";

  let lang = req.user.getMainLang();
  if (typeof (lang) === "undefined") lang = "DE";
  // small screens: one language only (see routes/layout.js)
  let leftLang = req.user.getMainLang();
  let rightLang = req.user.getSecondLang();
  if (req.mobileView) {
    lang = req.user.getMobileLang();
    leftLang = lang;
    rightLang = null;
  }


  let clearParams = false;


  async.auto({
    dataCollect: function(callback) {
      debug("converter function");
      blog.getPreviewData({ lang: lang, collectors: true }, function(err, result) {
        return callback(err, result);
      });
    },
    userMap: function(callback) {
      debug("userColors");
      const userMap = {};
      userModule.find({}, function(err, userlist) {
        if (err) return callback(err);
        for (let i = 0; i < userlist.length; i++) {
          userMap[userlist[i].OSMUser] = userlist[i];
        }
        return callback(null, userMap);
      });
    },
    review: function (callback) {
      if (typeof (req.query.reviewComment) !== "undefined") {
        return callback(new Error("?reviewComment= parameter is not supported any longer"));
      } else return callback();
    },
    setStatus: function (callback) {
      if (typeof (req.query.setStatus) !== "undefined") {
        clearParams = true;
        const changes = { status: req.query.setStatus };
        blog.setAndSave(req.user, changes, function(err) {
          if (err) return callback(err);
          let referer =  config.htmlRoot() + "/osmbc";
          if (req.header("Referer") && req.header("Referer").indexOf("/auth/openstreetmap") < 0) {
            referer = util.getSafeRedirectUrl(req.header("Referer"), referer, req.protocol + "://" + req.get("host"));
          }
          res.redirect(referer);
        });
      } else return callback();
    },
    closeInfo: function (callback) {
      collectCloseInfo(blog, req.user, callback);
    },
    closeLang: function (callback) {
      if (typeof (req.query.closeLang) !== "undefined") {
        return callback(new Error("?closelang= parameter is not supported any longer"));
      } else return callback();
    }


  },
  function(err, result) {
    debug("renderBlogTab->final function");
    if (err) return next(err);
    assert(res.rendervar);
    if (clearParams) {
      const url = htmlroot + "/blog/" + blog.name;
      let styleParam = "";
      if (req.query.style) styleParam = "?style=" + req.query.style;
      res.redirect(url + styleParam);
      return;
    }

    const apiAuthors = [];
    apiAuthors.push(translator.deeplPro.user);
    const languageFlags = configModule.getConfig("languageflags");


    const renderer = blogRenderer.createRenderer("HTML", blog, { target: "editor" });
    res.rendervar.layout.title = blog.name + "/" + tab.toLowerCase();
    res.render("blog/blog_" + tab.toLowerCase(), {
      layout: res.rendervar.layout,
      blog: blog,
      articles: result.dataCollect.articles,
      futureArticles: result.dataCollect.futureArticles,
      teamString: result.teamString,
      userMap: result.userMap,
      languageFlags: languageFlags,
      lang: lang,
      tab: tab,
      votes: votes,
      left_lang: leftLang,
      right_lang: rightLang,
      renderer: renderer,
      reviewInWP: reviewInWP,
      util: util,
      categories: blog.getCategories(),
      apiAuthors: apiAuthors,
      closeInfo: result.closeInfo
    });
  }
  );
}

function copyAllArticles(req, res, next) {
  debug("copyCompleteLang");

  const blog = req.blog;

  const user = req.user;

  const fromLang = req.params.fromLang;
  const toLang = req.params.toLang;

  blog.copyAllArticles(user, fromLang, toLang, function (err) {
    if (err) return next(err);
    const referer = util.getSafeRedirectUrl(req.header("Referer"), config.htmlRoot() + "/osmbc", req.protocol + "://" + req.get("host"));
    res.redirect(referer);
  });
}

function translateAllArticles(req, res, next) {
  debug("translateAllArticles");

  const blog = req.blog;

  const user = req.user;

  const fromLang = req.params.fromLang;
  const toLang = req.params.toLang;
  const service = req.params.service;

  blog.translateAllArticles(user, fromLang, toLang, service, function (err) {
    if (err) return next(err);
    const referer = util.getSafeRedirectUrl(req.header("Referer"), config.htmlRoot() + "/osmbc", req.protocol + "://" + req.get("host"));
    res.redirect(referer);
  });
}

function createBlog(req, res, next) {
  debug("createBlog");

  blogModule.createNewBlog(req.user, function(err) {
    if (err) return next(err);
    res.redirect(htmlroot + "/blog/list?status=open");
    // res.render('bloglist',{blogs:blogs,user:req.user});
  });
}

function editBlogId(req, res, next) {
  debug("editBlogId");
  const blog = req.blog;
  assert(res.rendervar);
  const params = {};
  if (req.query.edit) params.edit = req.query.edit;
  if (params.edit && params.edit === "false") {
    return res.redirect(htmlroot + "/blog/edit/" + req.params.blog_id);
  }
  blog._categories_yaml = yamlDump(blog.categories);
  res.set("content-type", "text/html");
  let copyLanguageFromAnother = config.getValue("copyLanguageFromAnother");
  if (!copyLanguageFromAnother) copyLanguageFromAnother = {};
  collectCloseInfo(blog, req.user, function(err, closeInfo) {
    if (err) return next(err);
    res.render("blog/blog_edit.pug", {
      layout: res.rendervar.layout,
      blog: blog,
      params: params,
      reviewInWP: reviewInWP,
      copyLanguageFromAnother: copyLanguageFromAnother,
      statusList: blogModule.statusList,
      categories: blog.getCategories(),
      closeInfo: closeInfo
    });
  });
}

function postBlogId(req, res, next) {
  debug("postBlogId");
  const blog = req.blog;

  let categories = null;
  try {
    if (req.body.categories_yaml) categories = yamlLoad(req.body.categories_yaml);
  } catch (err) {
    return next(err);
  }
  const changes = {
    name: req.body.name,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    status: req.body.status,
    markdownImage: req.body.markdownImage,
    categories: categories
  };
  // A stored manual override is data, not an issue-era special case.
  // Respect it whenever the payload contains it; do not hide it behind a WN
  // number gate that only exists because the feature was once ui-only.
  for (const lang of language.getLid()) {
    const field = "teamString" + lang;
    if (typeof req.body[field] !== "undefined") changes[field] = req.body[field];
  }
  blog.setAndSave(req.user, changes, function(err) {
    if (err) {
      return next(err);
    }
    res.redirect(htmlroot + "/blog/edit/" + blog.name);
  });
}




router.param("blog_id", findBlogId);
router.get("/edit/:blog_id", auth.checkRole(["full"]), requireBlog, editBlogId);
router.post("/edit/:blog_id", auth.checkRole(["full"]), requireBlog, postBlogId);
router.post("/:blog_id/setReviewComment", auth.checkRole(["full"]), requireBlog, setReviewComment);
router.post("/:blog_id/editReviewComment/:index", auth.checkRole(["full"]), requireBlog, editReviewComment);
router.post("/:blog_id/setLangStatus", auth.checkRole(["full"]), requireBlog, setBlogStatus);
router.post("/:blog_id/copy/:fromLang/:toLang", auth.checkRole(["full"]), requireBlog, copyAllArticles);
router.post("/:blog_id/translate/:service/:fromLang/:toLang/", auth.checkRole(["full"]), requireBlog, translateAllArticles);


router.get("/create", auth.checkRole(["full"]), createBlog);
router.get("/list", auth.checkRole(["full"]), renderBlogList);
router.get("/:blog_id", auth.checkRole(["full"]), requireBlog, renderBlogTab);
router.get("/:blog_id/stat", auth.checkRole(["full"]), requireBlog, renderBlogStat);
router.get("/:blog_id/preview", auth.checkRole(["full"]), requireBlog, renderBlogPreview);
router.get("/:blog_id/previewHeader", auth.checkRole(["full"]), requireBlog, renderBlogPreviewHeader);
router.get("/:blog_id/:tab", auth.checkRole(["full"]), requireBlog, renderBlogTab);





export default router;
