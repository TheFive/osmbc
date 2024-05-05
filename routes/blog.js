

import express from "express";

import async from "async";
import { strict as assert } from "assert";
import _debug from "debug";

import config from "../config.js";
import language from "../model/language.js";

import util from "../util/util.js";
import moment from "moment";
import yaml from "js-yaml";
import configModule from "../model/config.js";


import blogModule from "../model/blog.js";
import blogRenderer from "../render/BlogRenderer.js";
import logModule from "../model/logModule.js";
import userModule from "../model/user.js";
import translator from "../model/translator.js";

import auth from "../routes/auth.js";
const router   = express.Router();
const debug = _debug("OSMBC:routes:blog");

const htmlroot = config.htmlRoot();

const reviewInWP = config.getValue("ReviewInWP", { default: [] });

// Internal Function to find a blog by an ID
// it accepts an internal Blog ID of OSMBC and a blog name
// Additional the fix blog name TBC is recognised.
function findBlogByRouteId(id, user, callback) {
  debug("findBlogByRouteId(%s)", id);
  let blog;
  assert(typeof (user) === "object");
  assert(typeof (callback) === "function");

  async.series([
    function CheckTBC(cb) {
      // check and return TBC Blog.
      debug("findBlogByRouteId->CheckTBC");
      if (id === "TBC") {
        blog = blogModule.getTBC();
      }
      return cb();
    },
    function findID(cb) {
      debug("findBlogByRouteId->findID");
      // Check and return blog by ID
      blogModule.findById(id, function(err, r) {
        if (err) return cb(err);
        if (r) blog = r;
        return cb();
      });
    },
    function findByName(cb) {
      debug("findBlogByRouteId->findByName");
      // Check and return blog by name
      if (blog) return cb();
      blogModule.find({ name: id }, function(err, r) {
        if (err) return cb(err);
        if (r.length === 0) return cb();
        if (r.length > 1) return cb(new Error("Blog >" + id + "< exists twice, internal id of first: " + r[0].id));
        if (r) blog = r[0];
        return cb();
      });
    },
    function countItems(cb) {
      debug("findBlogByRouteId->countItems");
      // start calculation of derived fields for the current user.
      // these fields are stored in an temporary _xxx field in the blog object
      if (blog) return blog.calculateDerived(user, cb);
      return cb();
    }], function(err) {
    debug("findBlogByRouteId->final function");
    if (err) return callback(err);
    callback(null, blog);
  });
}

function findBlogId(req, res, next, id) {
  debug("findBlogId");
  findBlogByRouteId(id, req.user, function(err, result) {
    if (err) return next(err);
    req.blog = result;
    return next();
  });
}


function renderBlogStat(req, res, next) {
  debug("renderBlogStat");
  const blog = req.blog;
  if (!blog) return next();

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
  req.session.articleReturnTo = req.originalUrl;
  const blog = req.blog;
  if (!blog) return next();


  let lang = req.query.lang;

  function isClosed(lang) {
    if (blog["close" + lang] === true) return true;
  }
  function listify(result, value, index) {
    if (index === 0) return value;
    return result + "-" + value;
  }
  const asMarkdown = (req.query.markdown === "true");
  if (typeof (lang) === "undefined") lang = "EN";
  if ((lang !== "ALL" && !language.getLanguages()[lang])) lang = "EN";

  if (lang === "ALL") {
    lang = language.getLid().filter(isClosed);
  } else {
    lang = [lang];
  }


  const returnToUrl = req.session.articleReturnTo;

  const multiExport = (lang.length > 1);
  let overallResult = "";
  if (multiExport) req.query.download = "true";







  async.eachSeries(lang,
    function(exportLang, callback) {
      debug("converter function");
      blog.getPreviewData({ lang: exportLang, createTeam: true, disableNotranslation: true, warningOnEmptyMarkdown: true }, function(err, data) {
        if (err) return callback(err);
        let renderer = new blogRenderer.HtmlRenderer(blog, { target: "production" });
        if (asMarkdown) renderer = new blogRenderer.MarkdownRenderer(blog);
        const result = renderer.renderBlog(exportLang, data);
        if (multiExport) {
          overallResult = overallResult + `[:${language.wpExportName(exportLang).toLowerCase()}]` + result;
        } else {
          overallResult = result;
        }
        return callback(null);
      });
    },
    function(err) {
      debug("renderBlogPreview->final function");
      if (multiExport) overallResult = overallResult + "[:]";
      const languageFlags = configModule.getConfig("languageflags");
      if (err) return next(err);
      if (req.query.download === "true") {
        if (asMarkdown) {
          res.attachment(`${blog.name} ${lang.reduce(listify)} ${moment().locale(language.momentLocale(lang)).format()}.md`).end(overallResult);
        } else {
          res.attachment(`${blog.name} ${lang.reduce(listify)} ${moment().locale(language.momentLocale(lang)).format()}.html`).end(overallResult);
        }
      } else {
        assert(res.rendervar);
        res.rendervar.layout.title = blog.name + "/preview";
        res.render("blogpreview", {
          layout: res.rendervar.layout,
          languageFlags: languageFlags,
          blog: blog,
          asMarkdown: asMarkdown,
          preview: overallResult,
          lang: lang,
          returnToUrl: returnToUrl,
          categories: blog.getCategories()
        });
      }
    }
  );
}

const blogTitleForExport = config.getValue("Blog Title For Export", { mustExist: true });

function renderBlogPreviewHeader(req, res, next) {
  debug("renderBlogPreviewHeader");
  try {
    req.session.articleReturnTo = req.originalUrl;
    const blog = req.blog;
    if (!blog) return next();

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

function setReviewComment(req, res, next) {
  debug("setReviewComment");

  const lang = req.body.lang;
  const user = req.user;
  const data = req.body.text;


  if (!req.blog) return next();
  req.blog.setReviewComment(lang, user, data, function(err) {
    if (err) return next(err);
    const referer = req.header("Referer") || config.htmlRoot() + "/osmbc";
    res.redirect(referer);
  });
}

function editReviewComment(req, res, next) {
  debug("editReviewComment");

  const lang = req.body.lang;
  const user = req.user;
  const data = req.body.text;
  const index = req.params.index;


  if (!req.blog) return next();
  req.blog.editReviewComment(lang, user, index, data, function(err) {
    if (err) return next(err);
    const referer = req.header("Referer") || config.htmlRoot() + "/osmbc";
    res.redirect(referer);
  });
}

function setBlogStatus(req, res, next) {
  debug("setBlogStatus");

  const lang = req.body.lang;
  const user = req.user;

  if (!req.blog) return next();

  function finalFunction(err) {
    if (err) {
      return next(err);
    }
    res.send("OK");
  }

  // Start Review
  if (req.body.action === "startreview") {
    return req.blog.setReviewComment(lang, user, "startreview", finalFunction);
  }
  // Mark Exported
  if (req.body.action === "markexported") {
    return req.blog.setReviewComment(lang, user, "markexported", finalFunction);
  }

  // Close Language
  if (req.body.action === "closelang") {
    return req.blog.closeBlog({ lang: lang, user: user, status: true }, finalFunction);
  }
  // reopen Language
  if (req.body.action === "editlang") {
    return req.blog.closeBlog({ lang: lang, user: user, status: false }, finalFunction);
  }
  if (req.body.action === "deleteallreviews") {
    return req.blog.setReviewComment(lang, user, "deleteallreviews", finalFunction);
  }
  return next(new Error("Unknown Status Combination, Please Contact the Author"));
}

function renderBlogTab(req, res, next) {
  debug("renderBlogTab");

  const blog = req.blog;
  if (!blog) return next();

  let tab = req.query.tab;
  if (!tab) tab = req.params.tab;


  const votes = configModule.getConfig("votes");
  let reviewScripts = {};
  const scripts = config.getValue("scripts");
  if (scripts && scripts.review) reviewScripts = scripts.review;

  if (!tab) tab = req.session.lasttab;
  if (!tab) tab = "Overview";

  if (["full", "overview", "review"].indexOf(tab.toLowerCase()) < 0) return next();

  req.session.lasttab = tab;

  if (req.params.blog_id === "TBC") tab = "TBC";

  let lang = req.user.getMainLang();
  if (typeof (lang) === "undefined") lang = "DE";


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
            referer = req.header("Referer");
          }
          res.redirect(referer);
        });
      } else return callback();
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
      if (req.param.style) styleParam = "?style=" + styleParam;
      res.redirect(url + styleParam);
      return;
    }

    const apiAuthors = [];
    apiAuthors.push(translator.deeplPro.user);
    const languageFlags = configModule.getConfig("languageflags");


    const renderer = new blogRenderer.HtmlRenderer(blog, { target: "editor" });
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
      left_lang: req.user.getMainLang(),
      right_lang: req.user.getSecondLang(),
      renderer: renderer,
      reviewInWP: reviewInWP,
      reviewScripts: reviewScripts,
      util: util,
      categories: blog.getCategories(),
      apiAuthors: apiAuthors
    });
  }
  );
}

function copyAllArticles(req, res, next) {
  debug("copyCompleteLang");

  const blog = req.blog;
  if (!blog) return next();

  const user = req.user;

  const fromLang = req.params.fromLang;
  const toLang = req.params.toLang;

  blog.copyAllArticles(user, fromLang, toLang, function (err) {
    if (err) return next(err);
    const referer = req.header("Referer") || config.htmlRoot() + "/osmbc";
    res.redirect(referer);
  });
}

function translateAllArticles(req, res, next) {
  debug("translateAllArticles");

  const blog = req.blog;
  if (!blog) return next();

  const user = req.user;

  const fromLang = req.params.fromLang;
  const toLang = req.params.toLang;
  const service = req.params.service;

  blog.translateAllArticles(user, fromLang, toLang, service, function (err) {
    if (err) return next(err);
    const referer = req.header("Referer") || config.htmlRoot() + "/osmbc";
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

function editBlogId(req, res) {
  debug("editBlogId");
  const blog = req.blog;
  assert(res.rendervar);
  assert(blog);
  const params = {};
  if (req.query.edit) params.edit = req.query.edit;
  if (params.edit && params.edit === "false") {
    res.redirect(htmlroot + "/blog/edit/" + req.params.blog_id);
  }
  blog._categories_yaml = yaml.dump(blog.categories);
  res.set("content-type", "text/html");
  let copyLanguageFromAnother = config.getValue("copyLanguageFromAnother");
  if (!copyLanguageFromAnother) copyLanguageFromAnother = {};
  res.render("blog/blog_edit.pug", {
    layout: res.rendervar.layout,
    blog: blog,
    params: params,
    reviewInWP: reviewInWP,
    copyLanguageFromAnother: copyLanguageFromAnother,
    categories: blog.getCategories()
  });
}

function postBlogId(req, res, next) {
  debug("postBlogId");
  const blog = req.blog;
  if (!blog) return next();

  let categories = null;
  try {
    if (req.body.categories_yaml) categories = yaml.load(req.body.categories_yaml);
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
  blog.setAndSave(req.user, changes, function(err) {
    if (err) {
      return next(err);
    }
    res.redirect(htmlroot + "/blog/edit/" + blog.name);
  });
}




router.param("blog_id", findBlogId);
router.get("/edit/:blog_id", auth.checkRole(["full"]), editBlogId);
router.post("/edit/:blog_id", auth.checkRole(["full"]), postBlogId);
router.post("/:blog_id/setReviewComment", auth.checkRole(["full"]), setReviewComment);
router.post("/:blog_id/editReviewComment/:index", auth.checkRole(["full"]), editReviewComment);
router.post("/:blog_id/setLangStatus", auth.checkRole(["full"]), setBlogStatus);
router.post("/:blog_id/copy/:fromLang/:toLang", auth.checkRole(["full"]), copyAllArticles);
router.post("/:blog_id/translate/:service/:fromLang/:toLang/", auth.checkRole(["full"]), translateAllArticles);


router.get("/create", auth.checkRole(["full"]), createBlog);
router.get("/list", auth.checkRole(["full"]), renderBlogList);
router.get("/:blog_id", auth.checkRole(["full"]), renderBlogTab);
router.get("/:blog_id/stat", auth.checkRole(["full"]), renderBlogStat);
router.get("/:blog_id/preview", auth.checkRole(["full"]), renderBlogPreview);
router.get("/:blog_id/previewHeader", auth.checkRole(["full"]), renderBlogPreviewHeader);
router.get("/:blog_id/:tab", auth.checkRole(["full"]), renderBlogTab);





export default router;
