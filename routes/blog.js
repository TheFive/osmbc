"use strict";

const express  = require("express");
const router   = express.Router();
const async    = require("../util/async_wrap.js");
const assert   = require("assert");
const debug    = require("debug")("OSMBC:routes:blog");
const config   = require("../config.js");
const language = require("../model/language.js");

const util     = require("../util/util.js");
const moment   = require("moment");
const yaml     = require("js-yaml");
const configModule = require("../model/config.js");

const BlogRenderer   = require("../render/BlogRenderer.js");

const blogModule     = require("../model/blog.js");
const blogRenderer   = require("../render/BlogRenderer.js");
const logModule      = require("../model/logModule.js");
const userModule     = require("../model/user.js");
const translator     = require("../model/translator.js");

const auth        = require("../routes/auth.js");

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
  const asMarkdown = (req.query.markdown === "true");
  if (typeof (lang) === "undefined") lang = "EN";
  if (!language.getLanguages()[lang]) lang = "EN";


  const returnToUrl = req.session.articleReturnTo;






  async.auto({
    converter: function(callback) {
      debug("converter function");
      blog.getPreviewData({ lang: lang, createTeam: true, disableNotranslation: true, warningOnEmptyMarkdown: true }, function(err, data) {
        if (err) return callback(err);
        let renderer = new BlogRenderer.HtmlRenderer(blog);
        if (asMarkdown) renderer = new BlogRenderer.MarkdownRenderer(blog);
        const result = renderer.renderBlog(lang, data);
        return callback(null, result);
      });
    }
  },
  function(err, result) {
    debug("renderBlogPreview->final function");
    if (err) return next(err);
    if (req.query.download === "true") {
      if (asMarkdown) {
        res.setHeader("Content-disposition", "attachment; filename=" + blog.name + "(" + lang + ")" + moment().locale(language.momentLocale(lang)).format() + ".md");
        res.setHeader("Content-type", "text");

        res.end(result.converter, "UTF8");
      } else {
        res.setHeader("Content-disposition", "attachment; filename=" + blog.name + "(" + lang + ")" + moment().locale(language.momentLocale(lang)).format() + ".html");
        res.setHeader("Content-type", "text/html");
        res.end(result.converter, "UTF8");
      }
    } else {
      assert(res.rendervar);
      res.rendervar.layout.title = blog.name + "/preview";
      res.render("blogpreview", {
        layout: res.rendervar.layout,
        blog: blog,
        asMarkdown: asMarkdown,
        preview: result.converter,
        lang: lang,
        returnToUrl: returnToUrl,
        categories: blog.getCategories()
      });
    }
  }
  );
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
    if (err) return next(err);
    let referer =  config.htmlRoot() + "/osmbc";
    if (req.header("Referer") && req.header("Referer").indexOf("/auth/openstreetmap") < 0) {
      referer = req.header("Referer");
    }
    res.redirect(referer);
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

    const translationServices = [];
    if (translator.deeplPro.active()) {
      translationServices.push("deeplPro");
    }
    if (translator.bingPro.active()) {
      translationServices.push("bing");
    }
    const apiAuthors = [];
    apiAuthors.push(translator.deeplPro.user);
    apiAuthors.push(translator.bingPro.user);


    const renderer = new blogRenderer.HtmlRenderer(blog);
    res.rendervar.layout.title = blog.name + "/" + tab.toLowerCase();
    res.render("blog/blog_" + tab.toLowerCase(), {
      layout: res.rendervar.layout,
      blog: blog,
      articles: result.dataCollect.articles,
      futureArticles: result.dataCollect.futureArticles,
      teamString: result.teamString,
      userMap: result.userMap,
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
      translationServices: translationServices,
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
  blog._categories_yaml = yaml.safeDump(blog.categories);
  res.set("content-type", "text/html");
  let copyLanguageFromAnother = config.getValue("copyLanguageFromAnother");
  if (!copyLanguageFromAnother) copyLanguageFromAnother = {};
  res.render("editblog", {
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
router.get("/:blog_id/:tab", auth.checkRole(["full"]), renderBlogTab);



module.exports.router = router;
