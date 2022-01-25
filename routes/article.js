"use strict";

const express     = require("express");
const async       = require("../util/async_wrap.js");
const assert      = require("assert").strict;
const markdown    = require("markdown-it")();
const debug       = require("debug")("OSMBC:routes:article");
const path        = require("path");
const HttpStatus  = require("http-status-codes");


const router      = express.Router();
const slackrouter = express.Router();
const pug         = require("pug");


const util          = require("../util/util.js");
const config        = require("../config.js");
const logger        = require("../config.js").logger;
const language      = require("../model/language.js");


const BlogRenderer  = require("../render/BlogRenderer.js");

const articleModule = require("../model/article.js");
const twitter       = require("../model/twitter.js");
const blogModule    = require("../model/blog.js");
const logModule     = require("../model/logModule.js");
const configModule  = require("../model/config.js");
const userModule    = require("../model/user.js");
const htmltitle     = require("../model/htmltitle.js");
const translator    = require("../model/translator.js");

const auth          = require("../routes/auth.js");


require("jstransformer")(require("jstransformer-markdown-it"));


const request = require("request");


const userAgent = config.getValue("User-Agent", { mustExist: true });


const LRU = require("lru-cache");

const linkCache = new LRU({ max: 300, maxage: 1000 * 60 * 60 * 5 });



const htmlroot = config.htmlRoot();

// send info, that disableOldEditor is not needed any longer
config.getValue("diableOldEditor", { deprecated: true });

// This Function converts the ID (used as :article_id in the routes) to
// an article and stores the object in the request
// if article_id is not existing it throws an error.

function getArticleFromID(req, res, next, id) {
  debug("getArticleFromID");
  req.article = null;
  assert(id);
  const idNumber = Number(id);
  if ("" + idNumber !== id) {
    return res.status(HttpStatus.NOT_FOUND).send("Article ID " + id + " does not exist (conversion error)");
  }
  articleModule.findById(idNumber, function(err, result) {
    debug("getArticleFromID->findById");
    if (err) return next(err);
    if (!result) {
      return res.status(HttpStatus.NOT_FOUND).send("Article ID " + id + " does not exist");
    }
    req.article = result;
    next();
  });
}

/* Read all users and map OSMOser on Access Right
May be optimised later for performance reasons */


function createAccessMapFn(activeLanguages) {
  return function(cb) {
    debug("accessMap");
    userModule.find({}, function(err, userArray) {
      if (err) return cb(err);
      const accessMap = {};
      userArray.forEach(function(user) {
        accessMap[user.OSMUser] = user.access;
      });
      activeLanguages.forEach(function(l) {
        accessMap[l] = "full";
      });
      for (const l in language.getLanguages()) {
        if (!accessMap[l]) accessMap[l] = "denied";
      }
      accessMap.all = "full";
      return cb(null, accessMap);
    });
  };
}

const urlWoErrorWhileEdit = config.getValue("urlWoErrorWhileEdit", { mustExist: true });

// renderArticleId prepares the view for displaying an article
function renderArticleId(req, res, next) {
  debug("renderArticleId");

  const languageFlags = configModule.getConfig("languageflags");
  const votes = configModule.getConfig("votes");

  /* votes.forEach(function(item){
    if (item.icon && item.icon.substring(0,3)==="fa-") item.iconClass = "fa "+item.icon;
    if (item.icon && item.icon.substring(0,10)==="glyphicon-") item.iconClass = "glyphicon "+item.icon;
  }); */

  const article = req.article;
  assert(article);


  let categories = blogModule.getCategories();

  // Params is used for indicating EditMode
  const params = {};
  params.edit = req.query.edit;
  params.left_lang = req.user.getMainLang();
  params.right_lang = req.user.getSecondLang();
  params.lang3 = req.user.getLang3();
  params.lang4 = req.user.getLang4();
  params.editComment = null;
  let mainTranslationService = "deepl";
  const translationServices = ["deepl", "copy"];
  if (translator.bingPro.active()) {
    translationServices.push("bingPro");
  }
  if (translator.deeplPro.active()) {
    mainTranslationService = "deeplPro";
    translationServices.push("deeplPro");
  }

  if (req.query.editComment) params.editComment = req.query.editComment;
  let collectedByGuest = false;



  const placeholder = configModule.getPlaceholder();
  async.auto({
    // Find usage of Links in other articles
    articleReferences: article.calculateUsedLinks.bind(article, { ignoreStandard: true }),
    // Find the associated blog for this article

    firstCollectorAccess: function (cb) {
      userModule.find({ OSMUser: article.firstCollector }, function (err, userArray) {
        if (err) return cb(err);
        let user = null;
        if (userArray.length >= 0) user = userArray[0];
        if (user && user.access === "guest") collectedByGuest = true;
        return cb();
      });
    },
    accessMap: createAccessMapFn(res.rendervar.layout.activeLanguages),
    blog:
    function findBlog(callback) {
      debug("renderArticleId->blog");

      blogModule.findOne({ name: article.blog }, function(err, blog) {
        debug("renderArticleId->findOne");
        if (blog) {
          categories = blog.getCategories();
        } else {
          debug("no blog found !!");
        }
        callback(err, blog);
      });
    },
    originArticle:
    function findOriginArticle(callback) {
      if (article.originArticleId) {
        articleModule.findById(article.originArticleId, callback);
      } else return callback(null, null);
    },
    originBlog: ["originArticle", function findOriginBlog(results, callback) {
      if (results.originArticle) {
        blogModule.findOne({ name: results.originArticle.blog }, callback);
      } else return callback(null, null);
    }],

    // Find all log messages for the article
    changes:
    function (callback) {
      debug("renderArticleId->changes");

      logModule.find(" where data->>'oid' ='" + article.id + "' and data->>'table' = 'article' and data->>'property' not like 'comment%' ", { column: "id", desc: true }, function(err, result) {
        debug("renderArticleId->findLog");

        callback(err, result);
      });
    },
    articleForSort:
    function articleForSort(callback) {
      debug("renderArticleId->articleForSort");
      articleModule.find({ blog: article.blog, categoryEN: article.categoryEN }, function(err, result) {
        if (err) return callback(err);
        callback(null, result);
      });
    }
  },
  function (err, result) {
    debug("renderArticleId->finalFunction");
    if (err) return next(err);
    if (result.notranslate) return res.redirect(result.notranslate);
    const renderer = new BlogRenderer.HtmlRenderer();



    for (const lang in language.getLanguages()) {
      if (typeof (article["markdown" + lang]) !== "undefined") {
        article["textHtml" + lang] = "<ul>" + renderer.renderArticle(lang, article) + "</ul>";
      }
    }
    if (typeof (article.comment) !== "undefined") {
      article.commentHtml = markdown.render(article.comment);
    }

    debug("rendering page");

    res.set("content-type", "text/html");
    // change title of page
    res.rendervar.layout.title = article.blog + "#" + article.id + "/" + article.title;
    const pugFile = "article/article_all_column";


    res.render(pugFile, {
      layout: res.rendervar.layout,
      article: article,
      googleTranslateText: configModule.getConfig("automatictranslatetext"),
      urlWoErrorWhileEdit: urlWoErrorWhileEdit,
      params: params,
      placeholder: placeholder,
      votes: votes,
      articleCategories: result.articleForSort,
      blog: result.blog,
      changes: result.changes,
      originArticle: result.originArticle,
      originBlog: result.originBlog,
      articleReferences: result.articleReferences,
      usedLinks: result.usedLinks,
      categories: categories,
      languageFlags: languageFlags,
      accessMap: result.accessMap,
      collectedByGuest: collectedByGuest,
      mainTranslationService: mainTranslationService,
      translationServices: translationServices
    });
  }
  );
}


function renderArticleIdVotes(req, res, next) {
  debug("renderArticleIdVotes");

  const votes = configModule.getConfig("votes");

  const article = req.article;
  assert(article);


  async.auto({},
    function (err) {
      debug("renderArticleIdVotes->finalFunction");
      if (err) return next(err);


      const rendervars = {
        layout: res.rendervar.layout,
        article: article,
        votes: votes
      };
      const voteButtons = pug.renderFile(path.resolve(__dirname, "..", "views", "voteButtons.pug"), rendervars);
      const voteButtonsList = pug.renderFile(path.resolve(__dirname, "..", "views", "voteButtonsList.pug"), rendervars);
      res.json({ "#voteButtons": voteButtons, "#voteButtonsList": voteButtonsList });
    }
  );
}

function renderArticleIdCommentArea(req, res, next) {
  debug("renderArticleCommentArea");


  const article = req.article;
  assert(article);

  const params = {};
  params.editComment = null;
  if (req.query.editComment) params.editComment = req.query.editComment;


  async.auto({
    accessMap: createAccessMapFn(res.rendervar.layout.activeLanguages)
  },
  function (err, result) {
    debug("renderArticleCommentArea->finalFunction");
    if (err) return next(err);


    const rendervars = {
      layout: res.rendervar.layout,
      article: article,
      params: params,
      accessMap: result.accessMap

    };
    pug.renderFile(path.resolve(__dirname, "..", "views", "article", "commentArea.pug"), rendervars, function(err, commentArea) {
      if (err) logger.error(err);
      if (err) return next(err);
      res.json({ "#commentArea": commentArea });
    });
  }
  );
}


function renderArticleIdVotesBlog(req, res, next) {
  debug("renderArticleIdVotesBlog");


  const votes = configModule.getConfig("votes");
  const voteName = req.params.votename;

  let vote = null;


  votes.forEach(function(item) {
    if (item.name === voteName) vote = item;
  });


  const article = req.article;
  assert(article);
  assert(vote);

  async.auto({ },
    function (err) {
      debug("renderArticleIdVotes->finalFunction");

      if (err) return next(err);


      const rendervars = {
        layout: res.rendervar.layout,
        article: article,
        vote: vote
      };

      pug.renderFile(path.resolve(__dirname, "..", "views", "voteLabel.pug"), rendervars, function(err, result) {
        if (err) logger.error(err);
        if (err) return next(err);
        const v = {};
        v["#vote_" + voteName + "_" + article.id] = result;
        res.json(v);
      });
    });
}




function searchAndCreate(req, res, next) {
  debug("searchAndCreate");
  let search = req.query.search;
  let show = req.query.show;
  if (!show) show = "15";
  if (!search || typeof (search) === "undefined") search = "";
  const placeholder = configModule.getPlaceholder();

  let title;
  let collection = search;
  async.series([
    function generateTitle(cb) {
      if (util.isURL(search)) {
        htmltitle.getTitle(search, function (err, titleCalc) {
          if (err) cb(err);
          title = titleCalc;
          return cb();
        });
      } else return cb();
    },
    function generateCollection(cb) {
      twitter.expandTwitterUrl(collection, function(err, result) {
        if (err) return cb(err);
        collection = result;
        cb();
      });
    }
  ], function (err) {
    if (err) return next(err);
    articleModule.fullTextSearch(search, { column: "blog", desc: true }, function (err, result) {
      debug("searchAndCreate->fullTextSearch");
      if (err) return next(err);
      const renderer = new BlogRenderer.HtmlRenderer(null);
      assert(res.rendervar);
      res.set("content-type", "text/html");
      res.render("collect", {
        layout: res.rendervar.layout,
        search: search,
        placeholder: placeholder,
        renderer: renderer,
        showCollect: true,
        show: show,
        title: title,
        collection: collection,
        categories: blogModule.getCategories(),
        foundArticles: result
      });
    });
  });
}


function postArticle(req, res, next) {
  debug("postArticle");



  let article = req.article;
  // If article exists, everything is fine, if article NOT exist, it has to be created.

  const changes = {
    blog: req.body.blog,
    collection: req.body.collection,
    comment: req.body.comment,
    predecessorId: req.body.predecessorId,
    categoryEN: req.body.categoryEN,
    version: req.body.version,
    title: req.body.title,
    addComment: req.body.addComment,
    commentStatus: req.body.commentStatus,
    unpublishReason: req.body.unpublishReason,
    unpublishReference: req.body.unpublishReference
  };


  for (const lang in language.getLanguages()) {
    changes["markdown" + lang] = req.body["markdown" + lang];
  }
  let returnToUrl;
  if (article) returnToUrl = htmlroot + "/article/" + article.id;

  async.parallel([
    function createArticle(cb) {
      debug("postArticle->createArticle");

      if (typeof (req.article) !== "undefined") return cb();
      articleModule.createNewArticle(function(err, result) {
        debug("postArticle->createArticle->createNewArticle");
        if (err) return next(err);
        if (typeof (result.id) === "undefined") return cb(new Error("Could not create Article"));
        article = result;
        changes.version = result.version;
        changes.firstCollector = req.user.OSMUser;
        returnToUrl = htmlroot + "/article/" + article.id;
        cb();
      });
    }
  ],
  function setValues(err) {
    debug("postArticle->setValues");
    if (err) { return next(err); }
    assert(article);

    article.setAndSave(req.user, changes, function(err) {
      debug("postArticle->setValues->setAndSave");
      if (err) {
        next(err);
        return;
      }
      res.redirect(returnToUrl);
    });
  }
  );
}


function postArticleNoTranslation(req, res, next) {
  debug("postArticle");


  const article = req.article;




  let returnToUrl;
  if (article) returnToUrl = htmlroot + "/article/" + article.id;
  const changes = {};
  changes.old = {};

  async.parallel([
  ],
  function setValues(err) {
    debug("postArticle->setValues");
    if (err) { return next(err); }
    assert(article);


    const showLangs = JSON.parse(req.body.language);
    showLangs.forEach(lang => {
      if (changes["markdown" + lang]) return;
      if (article["markdown" + lang] && article["markdown" + lang].trim() !== "") return;
      if (lang === req.user.mainLang) return;
      changes.old["markdown" + lang] = "";
      changes["markdown" + lang] = "no translation";
    });



    article.setAndSave(req.user, changes, function(err) {
      debug("postArticle->setValues->setAndSave");
      if (err) {
        next(err);
        return;
      }
      res.redirect(returnToUrl);
    });
  }
  );
}

function postArticleWithOldValues(req, res, next) {
  debug("postArticleWithOldValues");

  const noTranslation = req.query.notranslation;



  let article = req.article;
  // If article exists, everything is fine, if article NOT exist, it has to be created.

  const changes = {
    blog: req.body.blog,
    collection: req.body.collection,
    predecessorId: req.body.predecessorId,
    categoryEN: req.body.categoryEN,
    title: req.body.title,
    unpublishReason: req.body.unpublishReason,
    unpublishReference: req.body.unpublishReference
  };

  changes.old = {
    blog: req.body.old_blog,
    collection: req.body.old_collection,
    predecessorId: req.body.old_predecessorId,
    categoryEN: req.body.old_categoryEN,
    title: req.body.old_title,
    unpublishReason: req.body.old_unpublishReason,
    unpublishReference: req.body.old_unpublishReference
  };


  for (const lang in language.getLanguages()) {
    if (req.body["markdown" + lang] !== null && typeof req.body["markdown" + lang] !== "undefined") {
      changes["markdown" + lang] = req.body["markdown" + lang];
      changes.old["markdown" + lang] = req.body["old_markdown" + lang];
    }
  }
  let returnToUrl;
  if (article) returnToUrl = htmlroot + "/article/" + article.id;

  async.parallel([
    function createArticle(cb) {
      debug("postArticle->createArticle");

      if (typeof (req.article) !== "undefined") return cb();
      articleModule.createNewArticle(function(err, result) {
        debug("postArticle->createArticle->createNewArticle");
        if (err) return next(err);
        if (typeof (result.id) === "undefined") return cb(new Error("Could not create Article"));
        article = result;
        changes.version = result.version;
        changes.firstCollector = req.user.OSMUser;
        returnToUrl = htmlroot + "/article/" + article.id;
        cb();
      });
    }
  ],
  function setValues(err) {
    debug("postArticle->setValues");
    if (err) { return next(err); }
    assert(article);
    if (noTranslation === "true") {
      const showLangs = JSON.parse(req.body.languages);
      for (const lang in language.getLanguages()) {
        if (showLangs[lang]) {
          if (changes["markdown" + lang]) continue;
          if (article["markdown" + lang] && article["markdown" + lang].trim() === "") continue;
          if (lang === req.user.mainLang) continue;
          changes["markdown" + lang] = "no translation";
        }
      }
    }

    article.setAndSave(req.user, changes, function(err) {
      debug("postArticle->setValues->setAndSave");
      if (err) {
        next(err);
        return;
      }
      res.redirect(returnToUrl);
    });
  }
  );
}



function postNewComment(req, res, next) {
  debug("postNewComment");
  const article = req.article;
  assert(article);
  const comment = req.body.comment;
  let returnToUrl;

  if (article) returnToUrl = htmlroot + "/article/" + article.id;

  if (req.user.access === "guest") {
    if (article.firstCollector !== req.user.OSMUser) return next();
  }


  article.addCommentFunction(req.user, comment, function(err) {
    debug("postNewComment->setValues->addComment");
    if (err) {
      next(err);
      return;
    }
    if (req.query.reload === "false") {
      res.end("OK");
    } else {
      res.redirect(returnToUrl);
    }
  });
}


function postSetMarkdown(req, res, next) {
  debug("postSetMarkdown");

  const lang = req.params.lang;
  const article = req.article;
  assert(article);

  const markdown = req.body.markdown;
  const oldMarkdown = req.body.oldMarkdown;


  const change = {};
  change["markdown" + lang] = markdown;
  change.old = {};
  change.old["markdown" + lang] = oldMarkdown;
  article.setAndSave(req.user, change, function(err) {
    if (err) return next(err);
    // var returnToUrl = htmlroot+"/blog/"+article.blog+"/previewNEdit";
    const referer = req.header("Referer") || config.htmlRoot() + "/osmbc";
    res.redirect(referer);
  });
}

function postReviewChange(req, res, next) {
  debug("postReviewChange");


  const lang = req.params.lang;
  const article = req.article;
  assert(article);
  const object = {};

  object["markdown" + lang] = req.body.markdown;


  article.reviewChanges(req.user, object, function(err) {
    if (err) return next(err);
    // var returnToUrl = htmlroot+"/blog/"+article.blog+"/previewNEdit";
    const referer = req.header("Referer") || config.htmlRoot() + "/osmbc";
    res.redirect(referer);
  });
}

function postEditComment(req, res, next) {
  debug("postEditComment");

  const number = req.params.number;
  const article = req.article;
  assert(article);

  const comment = req.body.comment;
  const returnToUrl = htmlroot + "/article/" + article.id;


  article.editComment(req.user, number, comment, function(err) {
    debug("postNewComment->setValues->addComment");
    if (err) {
      next(err);
      return;
    }
    if (req.query.reload === "false") {
      res.end("OK");
    } else {
      res.redirect(returnToUrl);
    }
  });
}

function markCommentRead(req, res, next) {
  debug("markCommentRead");

  const number = req.query.index;



  const article = req.article;
  assert(article);
  article.markCommentRead(req.user, number, function(err) {
    debug("markCommentRead->markCommentRead");
    if (err) {
      next(err);
      return;
    }
    let returnToUrl  = htmlroot + "/article/" + article.id;

    // Do not loop with auth (can happen in tests)
    if (req.header("Referer") && req.header("Referer").indexOf("/auth/openstreetmap") < 0) {
      returnToUrl = req.header("Referer") || returnToUrl;
    }
    if (req.query.reload === "false") {
      res.end("OK");
    } else {
      res.redirect(returnToUrl);
    }
  });
}



function doAction(req, res, next) {
  debug("doAction");

  const action = req.params.action;
  const tag = req.params.tag;

  if (["setTag", "unsetTag", "setVote", "unsetVote"].indexOf(action) < 0) return next(new Error(action + " is unknown"));


  const article = req.article;
  assert(article);

  article[action](req.user, tag, function(err) {
    debug("doAction->%s callback", action);
    if (err) {
      next(err);
      return;
    }
    res.end("OK");
  });
}

function createArticle(req, res, next) {
  debug("createArticle");


  const placeholder = configModule.getPlaceholder();
  const proto = {};
  if (typeof (req.query.blog) !== "undefined") {
    proto.blog = req.query.blog;
  }
  if (typeof (req.query.categoryEN) !== "undefined") {
    proto.categoryEN = req.query.categoryEN;
  }

  async.series([
    function calculateWN(callback) {
      debug("createArticle->calculatenWN");
      // Blog Name is defined, so nothing to calculate
      if (proto.blog) return callback();
      blogModule.findOne({ status: "open" }, { column: "name", desc: false },
        function calculateWNResult(err, blog) {
          if (err) return callback(err);
          debug("createArticle->calculateWNResult");
          if (blog) {
            if (typeof (proto.blog) === "undefined") {
              proto.blog = blog.name;
            }
          }
          callback();
        });
    }
  ],
  function finalFunction(err) {
    debug("createArticle->finalFunction");
    if (err) return next(err);
    assert(res.rendervar);
    res.set("content-type", "text/html");
    res.render("collect", {
      layout: res.rendervar.layout,
      search: "",
      placeholder: placeholder,
      showCollect: true,
      categories: blogModule.getCategories()
    });
  }
  );
}


function searchArticles(req, res, next) {
  debug("search");

  let search = req.query.search;
  let show = req.query.show;
  if (!show) show = "15";

  if (!search || typeof (search) === "undefined") search = "";
  let result = null;

  async.series([
    function doSearch(cb) {
      debug("search->doSearch");
      if (search !== "") {
        articleModule.fullTextSearch(search, { column: "blog", desc: true }, function(err, r) {
          debug("search->doSearch->fullTextSearch");
          if (err) return cb(err);
          result = r;
          cb();
        });
      } else return cb();
    }
  ],
  function finalFunction(err) {
    debug("search->finalFunction");
    if (err) return next(err);
    assert(res.rendervar);
    const renderer = new BlogRenderer.HtmlRenderer(null);
    res.render("collect", {
      layout: res.rendervar.layout,
      search: search,
      show: show,
      foundArticles: result,
      renderer: renderer,
      placeholder: { categories: {} },
      showCollect: false,
      categories: blogModule.getCategories()
    });
  }
  );
}


function urlExist(req, res) {
  debug("urlExists");
  let urls = req.body.urls;
  if (!urls) return req.next(new Error("Expected Paramter urls"));
  if (typeof urls === "string") urls = [urls];
  if (!Array.isArray(urls)) return req.next(new Error("Expected Paramter urls as Array"));
  const result = {};

  async.each(urls,
    (url, callback) => {
      if (linkCache.get(url) === "OK") {
        result[url] = "OK";
        return callback();
      }
      // Do not test google translate links
      // this test is generating to much false positive
      if (url.startsWith("https://translate.google.com")) {
        result[url] = "OK";
        return callback();
      }
      request.get(url, { headers: { "User-Agent": userAgent } }, function(err, response) {
        if (!err && response.statusCode < 300) {
          linkCache.set(url, "OK");
          result[url] = "OK";
          return callback();
        } else if (!err && response.statusCode >= 300) {
          result[url] = response.statusCode;
          return callback();
        } else {
          let m = "NOK";
          if (typeof err.message === "string") m = err.message;
          result[url] = m;
          return callback();
        }
      });
    },
    function final(err) {
      if (err) res.end(err);
      else res.json(result);
    }
  );
}


function renderList(req, res, next) {
  debug("renderList");
  req.session.articleReturnTo = req.originalUrl;
  const blog = req.query.blog;
  const user = req.query.user;
  const property = req.query.property;
  const myArticles = (req.query.myArticles === "true");
  const listOfChanges = (typeof (user) === "string" && typeof (property) === "string");
  const simpleFind = !(listOfChanges || myArticles);


  let articles;

  async.parallel([
    function findArticleFunction(callback) {
      debug("renderList->findArticleFunction");
      if (!simpleFind) return callback();
      const query = {};
      if (typeof (blog) !== "undefined") {
        query.blog = blog;
      }
      let order = { column: "title" };
      if (blog === "Trash") order = { column: "id", desc: true };
      articleModule.find(query, order, function(err, result) {
        debug("renderList->findArticleFunction->find");
        if (err) return callback(err);
        articles = result;
        callback();
      });
    },
    function findMyArticles(callback) {
      debug("renderList->findMyArticles");
      if (!myArticles) return callback();


      articleModule.findEmptyUserCollectedArticles(req.user.getMainLang(), req.user.displayName, function(err, result) {
        debug("renderList->findMyArticles->find");
        if (err) return callback(err);
        articles = result;
        callback();
      });
    },
    function findUserEditedArticles(callback) {
      debug("renderList->findMyArticles");
      if (!listOfChanges) return callback();


      articleModule.findUserEditFieldsArticles(blog, user, property, function(err, result) {
        debug("renderList->findMyArticles->find");
        if (err) return callback(err);
        articles = result;
        callback();
      });
    }


  ], function finalFunction(error) {
    debug("renderList->finalFunction");
    if (error) return next(error);
    assert(res.rendervar);
    res.set("content-type", "text/html");
    res.render("articlelist", {
      layout: res.rendervar.layout,
      articles: articles
    });
  }
  );
}


function fixMarkdownLinks(string) {
  let r = string;
  r = r.replace(/(\b)\[/g, "$1 \[");
  r = r.replace(/\)(\b)/g, "\) $1");
  r = r.replace(/\] \(/g, "\]\(");
  return r;
}


function translateWithPlugin(translatePlugin) {
  return function(req, res) {
    debug("translateWithPlugin %s", translatePlugin);

    if (!translator[translatePlugin].active()) {
      res.end("No license for " + translator[translatePlugin].name + " configured");
      return;
    }

    const options = {
      fromLang: req.params.fromLang,
      toLang: req.params.toLang,
      text: req.body.text
    };
    translator[translatePlugin].translate(options, function(err, result) {
      if (err) {
        return res.end(err.message);
      }
      return res.end(result);
    });
  };
}


function isFirstCollector(req, res, next) {
  if (req.article && req.article.firstCollector === req.user.OSMUser) return next();
  if (!req.article) return next();
  const user = req.user.OSMUser;
  const comments = req.article.commentList;
  if (comments) {
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      if (comment.text.search(new RegExp("@" + user + "\\b", "i")) >= 0) return next();
    }
  }
  res.status(HttpStatus.FORBIDDEN).send("This article is not allowed for guests");
}

const allowFullAccess = auth.checkRole("full");
const allowGuestAccess = auth.checkRole(["full", "guest"], [null, isFirstCollector]);


// And configure router to use render Functions
router.get("/list", allowFullAccess, renderList);
router.get("/create", allowGuestAccess, createArticle);
router.get("/searchandcreate", allowGuestAccess, searchAndCreate);
router.get("/search", allowFullAccess, searchArticles);
router.post("/create", allowGuestAccess, postArticle);
router.post("/translate/deeplPro/:fromLang/:toLang", allowFullAccess, translateWithPlugin("deeplPro"));
router.post("/translate/bing/:fromLang/:toLang", allowFullAccess, translateWithPlugin("bingPro"));
router.post("/translate/copy/:fromLang/:toLang", allowFullAccess, translateWithPlugin("copy"));
router.post("/urlexist", allowGuestAccess, urlExist);

router.param("article_id", getArticleFromID);

router.get("/:article_id", allowGuestAccess, renderArticleId);
router.get("/:article_id/votes", allowFullAccess, renderArticleIdVotes);
router.get("/:article_id/commentArea", allowGuestAccess, renderArticleIdCommentArea);

router.get("/:article_id/markCommentRead", allowGuestAccess, markCommentRead);
router.get("/:article_id/:action.:tag", allowFullAccess, doAction);
router.get("/:article_id/:votename", allowFullAccess, renderArticleIdVotesBlog);


router.post("/:article_id/addComment", allowGuestAccess, postNewComment);
router.post("/:article_id/setMarkdown/:lang", allowFullAccess, postSetMarkdown);
router.post("/:article_id/reviewChange/:lang", allowFullAccess, postReviewChange);
router.post("/:article_id/editComment/:number", allowGuestAccess, postEditComment);
router.post("/:article_id", allowFullAccess, postArticle);
router.post("/:article_id/notranslation", allowFullAccess, postArticleNoTranslation);
router.post("/:article_id/witholdvalues", allowGuestAccess, postArticleWithOldValues);




module.exports.router = router;
module.exports.slackrouter = slackrouter;


module.exports.fortestonly = {};
module.exports.fortestonly.getArticleFromID = getArticleFromID;
module.exports.fortestonly.fixMarkdownLinks = fixMarkdownLinks;
