"use strict";

var express  = require("express");
var async    = require("async");
var router   = express.Router();
var slackrouter = express.Router();
var should   = require("should");
var markdown = require("markdown-it")();
var debug    = require("debug")("OSMBC:routes:article");
var jade     = require("jade");
var util     = require("../util.js");
var path     = require("path");


var config    = require("../config.js");
var logger    = require("../config.js").logger;

var BlogRenderer = require("../render/BlogRenderer.js");

var articleModule = require("../model/article.js");
var twitter       = require("../model/twitter.js");
var blogModule    = require("../model/blog.js");
var logModule     = require("../model/logModule.js");
var configModule  = require("../model/config.js");
var htmltitle     = require("../model/htmltitle.js");

require("jstransformer")(require("jstransformer-markdown-it"));

var gglTranslateAPI = require("google-translate-api");


let htmlroot = config.getValue("htmlroot", {mustExist: true});
// This Function converts the ID (used as :article_id in the routes) to
// an article and stores the object in the request
// if article_id is not existing it throws an error.

function getArticleFromID(req, res, next, id) {
  debug("getArticleFromID");
  req.article = null;
  should.exist(id);
  let idNumber = Number(id);
  if ("" + idNumber !== id) return next(new Error("Article ID " + id + " does not exist (conversion error)"));
  articleModule.findById(idNumber, function(err, result) {
    debug("getArticleFromID->findById");
    if (err) return next(err);
    if (!result) return next(new Error("Article ID " + id + " does not exist"));
    req.article = result;
    next();
  });
}


// renderArticleId prepares the view for displaying an article
function renderArticleId(req, res, next) {
  debug("renderArticleId");

  var languageFlags = configModule.getConfig("languageflags");
  var votes = configModule.getConfig("votes");

 /* votes.forEach(function(item){
    if (item.icon && item.icon.substring(0,3)==="fa-") item.iconClass = "fa "+item.icon;
    if (item.icon && item.icon.substring(0,10)==="glyphicon-") item.iconClass = "glyphicon "+item.icon;
  }); */

  var article = req.article;
  should.exist(article);


  var categories = blogModule.getCategories();

  // Params is used for indicating EditMode
  var params = {};
  params.edit = req.query.edit;
  params.left_lang = req.user.getMainLang();
  params.right_lang = req.user.getSecondLang();
  params.lang3 = req.user.getLang3();
  params.lang4 = req.user.getLang4();
  params.editComment = null;
  if (req.query.editComment) params.editComment = req.query.editComment;
  if (req.query.notranslation) params.notranslation = req.query.notranslation;



  var placeholder = configModule.getPlaceholder();
  async.auto({
    // Find usage of Links in other articles
    articleReferences: article.calculateUsedLinks.bind(article),
    // Find the associated blog for this article
    blog:
    function findBlog(callback) {
      debug("renderArticleId->blog");

      blogModule.findOne({name: article.blog}, function(err, blog) {
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
        blogModule.findOne({name: results.originArticle.blog}, callback);
      } else return callback(null, null);
    }],

    // Find all log messages for the article
    changes:
    function (callback) {
      debug("renderArticleId->changes");

      logModule.find(" where data->>'oid' ='" + article.id + "' and data->>'table' = 'article' and data->>'property' not like 'comment%' ", {column: "timestamp", desc: true}, function(err, result) {
        debug("renderArticleId->findLog");

        callback(err, result);
      });
    },
    // (informal) locking information for the article
    edit:
    function (callback) {
      debug("renderArticleId->edit");

      if (typeof (params.edit) !== "undefined") {
        if (params.edit === "false") {
          delete params.edit;
          article.doUnlock(callback);
          return;
        }
        article.doLock(req.user.displayName, callback);
      } else {
        return callback();
      }
    },
    articleForSort:
    function articleForSort(callback) {
      debug("renderArticleId->articleForSort");
      articleModule.find({blog: article.blog, categoryEN: article.categoryEN}, function(err, result) {
        if (err) return callback(err);
        callback(null, result);
      });
    },
    notranslate:
        function (callback) {
          debug("renderArticleId->notranslate");

          if (params.notranslation === "true") {
            article.addNotranslate(req.user, res.rendervar.layout.usedLanguages, function (err) {
              if (err) return callback(err);
              var returnToUrl = htmlroot + "/article/" + article.id;
              if (params.style) returnToUrl = returnToUrl + "?style=" + params.style;
              callback(null, returnToUrl);
            });
          } else return callback();
        }},
      function (err, result) {
        debug("renderArticleId->finalFunction");
        if (err) return next(err);
        if (result.notranslate) return res.redirect(result.notranslate);
        let renderer = new BlogRenderer.HtmlRenderer();



        var languages = config.getLanguages();
        for (var i = 0; i < languages.length; i++) {
          var lang = languages[i];
          if (typeof (article["markdown" + lang]) !== "undefined") {
            article["textHtml" + lang] = "<ul>" + renderer.renderArticle(lang, article) + "</ul>";
          }
        }
        if (typeof (article.comment) !== "undefined") {
          article.commentHtml = markdown.render(article.comment);
        }

        //
        if (req.query.edit && !params.edit) {
          debug("return to was called, redirecting");
          var returnToUrl = htmlroot + "/article/" + article.id;
          // if (req.session.articleReturnTo) returnToUrl = req.session.articleReturnTo;
          res.redirect(returnToUrl);
        } else {
          debug("rendering page");
          // Render the article with all calculated vars
          // (res.rendervar.layout is set by the express routing
          // mechanism before this router)
        /*  var file = path.resolve(__dirname,'..','views', "article.jade");

          var result = jade.renderFile(file,{layout:res.rendervar.layout,
                                article:article,
                                params:params,
                                placeholder:placeholder,
                                blog:result.blog,
                                changes:result.changes,
                                articleReferences:result.articleReferences,
                                usedLinks:result.usedLinks,
                                categories:categories});

          res.end(result);return; */
          res.set("content-type", "text/html");
          // change title of page
          res.rendervar.layout.title = article.blog + "#" + article.id + "/" + article.title;
          let jadeFile = "article";
          let newEditor = req.user.articleEditor === "new";
          if (newEditor) {
            jadeFile = "article/article_twocolumn";
            if (req.user.getSecondLang()===null ) jadeFile = "article/article_onecolumn";
          }
          if (newEditor && req.user.languageCount === "three") {
            jadeFile = "article/article_threecolumn";
            if (req.user.getLang3()==="--" ) jadeFile = "article/article_twocolumn";
            if (req.user.getSecondLang()==="--" ) jadeFile = "article/article_onecolumn";

            params.columns=3;
          }
          if (newEditor && req.user.languageCount === "four") {
            jadeFile = "article/article_fourcolumn";
            console.log(req.user.getSecondLang());
            if (req.user.getLang4()===null ) jadeFile = "article/article_threecolumn";
            if (req.user.getLang3()===null ) jadeFile = "article/article_twocolumn";
            if (req.user.getSecondLang()===null ) jadeFile = "article/article_onecolumn";
            params.columns=4;
          }


          res.render(jadeFile, {layout: res.rendervar.layout,
            article: article,
            googleTranslateText: configModule.getConfig("automatictranslatetext"),
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
            languageFlags: languageFlags});
        }
      }
    );
}


function renderArticleIdVotes(req, res, next) {
  debug("renderArticleIdVotes");

  var votes = configModule.getConfig("votes");

  var article = req.article;
  should.exist(article);

  async.auto({},
    function (err) {
      debug("renderArticleIdVotes->finalFunction");
      if (err) return next(err);


      let rendervars = {layout: res.rendervar.layout,
        article: article,
        votes: votes
      };
      let voteButtons = jade.renderFile(path.resolve(__dirname, "..", "views", "voteButtons.jade"), rendervars);
      let voteButtonsList = jade.renderFile(path.resolve(__dirname, "..", "views", "voteButtonsList.jade"), rendervars);
      res.json({"#voteButtons": voteButtons, "#voteButtonsList": voteButtonsList});
    }
  );
}

function renderArticleIdCommentArea(req, res, next) {
  debug("renderArticleCommentArea");


  var article = req.article;
  should.exist(article);
  let params = {};
  params.editComment = null;
  if (req.query.editComment) params.editComment = req.query.editComment;

  async.auto({},
    function (err) {
      debug("renderArticleCommentArea->finalFunction");
      if (err) return next(err);


      let rendervars = {layout: res.rendervar.layout,
        article: article,
        params: params
      };
      jade.renderFile(path.resolve(__dirname, "..", "views", "article", "commentArea.jade"), rendervars, function(err, commentArea) {
        if (err) logger.error(err);
        if (err) return next(err);
        res.json({"#commentArea": commentArea});
      });
    }
  );
}


function renderArticleIdVotesBlog(req, res, next) {
  debug("renderArticleIdVotesBlog");


  var votes = configModule.getConfig("votes");
  var voteName = req.params.votename;

  let vote = null;


  votes.forEach(function(item) {
    if (item.name === voteName) vote = item;
  });


  var article = req.article;
  should.exist(article);



  async.auto({},
    function (err) {
      debug("renderArticleIdVotes->finalFunction");

      if (err) return next(err);


      let rendervars = {
        layout: res.rendervar.layout,
        article: article,
        vote: vote
      };

      jade.renderFile(path.resolve(__dirname, "..", "views", "voteLabel.jade"), rendervars, function(err, result) {
        if (err) logger.error(err);
        if (err) return next(err);
        let v = {};
        v["#vote_" + voteName + "_" + article.id] = result;
        res.json(v);
      });
    }
  );
}




function searchAndCreate(req, res, next) {
  debug("searchAndCreate");
  var search = req.query.search;
  var show = req.query.show;
  if (!show) show = "15";
  if (req.query.edit && req.query.edit === "false") {
    var returnToUrl = htmlroot + "/osmbc.html";
    if (req.session.articleReturnTo) returnToUrl = req.session.articleReturnTo;
    res.redirect(returnToUrl);
    return;
  }
  if (!search || typeof (search) === "undefined") search = "";
  var placeholder = configModule.getPlaceholder();

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
    articleModule.fullTextSearch(search, {column: "blog", desc: true}, function (err, result) {
      debug("searchAndCreate->fullTextSearch");
      if (err) return next(err);
      let renderer = new BlogRenderer.HtmlRenderer(null);
      should.exist(res.rendervar);
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

  var noTranslation = req.query.notranslation;



  var article = req.article;
  // If article exists, everything is fine, if article NOT exist, it has to be created.

  var changes = {blog: req.body.blog,
    collection: req.body.collection,
    comment: req.body.comment,
    predecessorId: req.body.predecessorId,
    categoryEN: req.body.categoryEN,
    version: req.body.version,
    title: req.body.title,
    addComment: req.body.addComment,
    commentStatus: req.body.commentStatus,
    unpublishReason: req.body.unpublishReason,
    unpublishReference: req.body.unpublishReference};

  var languages = config.getLanguages();
  for (var i = 0; i < languages.length; i++) {
    var lang = languages[i];
    changes["markdown" + lang] = req.body["markdown" + lang];
  }
  var returnToUrl;
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
      should.exist(article);
      if (noTranslation === "true") {
        let showLangs = JSON.parse(req.body.languages);
        var languages = config.getLanguages();
        for (var i = 0; i < languages.length; i++) {
          var lang = languages[i];
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

function postArticleWithOldValues(req, res, next) {
  debug("postArticleWithOldValues");

  var noTranslation = req.query.notranslation;



  var article = req.article;
  // If article exists, everything is fine, if article NOT exist, it has to be created.

  var changes = {blog: req.body.blog,
    collection: req.body.collection,
    predecessorId: req.body.predecessorId,
    categoryEN: req.body.categoryEN,
    title: req.body.title,
    unpublishReason: req.body.unpublishReason,
    unpublishReference: req.body.unpublishReference};

  changes.old = {blog: req.body.old_blog,
    collection: req.body.old_collection,
    predecessorId: req.body.old_predecessorId,
    categoryEN: req.body.old_categoryEN,
    title: req.body.old_title,
    unpublishReason: req.body.old_unpublishReason,
    unpublishReference: req.body.old_unpublishReference};

  var languages = config.getLanguages();
  for (var i = 0; i < languages.length; i++) {
    var lang = languages[i];
    if (req.body["markdown" + lang] !== null && typeof req.body["markdown" + lang] !== "undefined") {
      changes["markdown" + lang] = req.body["markdown" + lang];
      changes.old["markdown" + lang] = req.body["old_markdown" + lang];
    }
  }
  var returnToUrl;
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
      should.exist(article);
      if (noTranslation === "true") {
        let showLangs = JSON.parse(req.body.languages);
        var languages = config.getLanguages();
        for (var i = 0; i < languages.length; i++) {
          var lang = languages[i];
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

function copyArticle(req, res, next) {
  debug("copyArticle");

  var newBlog = req.params.blog;



  var article = req.article;
  // If article exists, everything is fine, if article NOT exist, it has to be created.


  var languages = config.getLanguages();

  article.copyToBlog(newBlog, languages, function(err) {
    if (err) return next(err);
    let referer = req.header("Referer") || "/";
    res.redirect(referer);
  });
}

function postNewComment(req, res, next) {
  debug("postNewComment");
  var article = req.article;
  should.exist(article);
  var comment = req.body.comment;
  var returnToUrl;

  if (article) returnToUrl = htmlroot + "/article/" + article.id;


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


  var lang = req.params.lang;



  var article = req.article;
  should.exist(article);

  var markdown = req.body.markdown;
  var oldMarkdown = req.body.oldMarkdown;


  var change = {};
  change["markdown" + lang] = markdown;
  change.old = {};
  change.old["markdown" + lang] = oldMarkdown;
  article.setAndSave(req.user, change, function(err) {
    if (err) return next(err);
    // var returnToUrl = htmlroot+"/blog/"+article.blog+"/previewNEdit";
    let referer = req.header("Referer") || "/";
    res.redirect(referer);
  });
}

function postEditComment(req, res, next) {
  debug("postEditComment");

  var number = req.params.number;
  var article = req.article;
  should.exist(article);

  var comment = req.body.comment;
  var returnToUrl;
  returnToUrl = htmlroot + "/article/" + article.id;


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

  var number = req.query.index;



  var article = req.article;
  should.exist(article);
  article.markCommentRead(req.user, number, function(err) {
    debug("markCommentRead->markCommentRead");
    if (err) {
      next(err);
      return;
    }
    let returnToUrl  = htmlroot + "/article/" + article.id;
    returnToUrl = req.header("Referer") || returnToUrl;
    if (req.query.reload === "false") {
      res.end("OK");
    } else {
      res.redirect(returnToUrl);
    }
  });
}



function doAction(req, res, next) {
  debug("doAction");

  var action = req.params.action;
  var tag = req.params.tag;

  if (["setTag", "unsetTag", "setVote", "unsetVote"].indexOf(action) <= 0) return next(new Error(action + " is unknown"));


  var article = req.article;
  should.exist(article);

  article[action](req.user, tag, function(err) {
    debug("doAction->%s callback", action);
    if (err) {
      next(err);
      return;
    }
    let returnToUrl  = htmlroot + "/article/" + article.id;
    if (req.header("Referer")) returnToUrl = req.header("Referer");
    res.end("OK");
    // res.redirect(returnToUrl);
  });
}

function createArticle(req, res, next) {
  debug("createArticle");


  var placeholder = configModule.getPlaceholder();
  var proto = {};
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
      blogModule.findOne({status: "open"}, {column: "name", desc: false},
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
      should.exist(res.rendervar);
      res.set("content-type", "text/html");
      res.render("collect", {layout: res.rendervar.layout,
        search: "",
        placeholder: placeholder,
        showCollect: true,
        categories: blogModule.getCategories()});
    }
  );
}


function searchArticles(req, res, next) {
  debug("search");

  var search = req.query.search;
  var show = req.query.show;
  if (!show) show = "15";

  if (!search || typeof (search) === "undefined") search = "";
  var result = null;

  async.series([
    function doSearch(cb) {
      debug("search->doSearch");
      if (search !== "") {
        articleModule.fullTextSearch(search, {column: "blog", desc: true}, function(err, r) {
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
      should.exist(res.rendervar);
      let renderer = new BlogRenderer.HtmlRenderer(null);
      res.render("collect", {layout: res.rendervar.layout,
        search: search,
        show: show,
        foundArticles: result,
        renderer: renderer,
        placeholder: {categories: {}},
        showCollect: false,
        categories: blogModule.getCategories()});
    }
  );
}



function renderList(req, res, next) {
  debug("renderList");
  req.session.articleReturnTo = req.originalUrl;
  var blog = req.query.blog;
  var user = req.query.user;
  var property = req.query.property;
  var myArticles = (req.query.myArticles === "true");
  var listOfChanges = (typeof (user) === "string" && typeof (property) === "string");
  var simpleFind = !(listOfChanges || myArticles);


  var articles;

  async.parallel([
    function findArticleFunction(callback) {
      debug("renderList->findArticleFunction");
      if (!simpleFind) return callback();
      var query = {};
      if (typeof (blog) !== "undefined") {
        query.blog = blog;
      }
      let order = {column: "title"};
      if (blog === "Trash") order = {column: "id", desc: true};
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
    should.exist(res.rendervar);
    res.set("content-type", "text/html");
    res.render("articlelist", {layout: res.rendervar.layout,
      articles: articles});
  }
  );
}


/*
var Browser = require("zombie");

var env = process.env.NODE_ENV || "development";


function translateOLD(req, res, next) {
  debug("translate");
  var userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_3) AppleWebKit/535.20 (KHTML, like Gecko) Chrome/19.0.1036.7 Safari/535.20";

  Browser.waitDuration = "30s";
  let fromLang = req.params.fromLang;
  let toLang = req.params.toLang;
  let text = req.body.text;
  let link = "#" + fromLang + "/" + toLang + "/";
  let browser = new Browser({userAgent: userAgent, site: "https://translate.google.com/"});

  browser.visit(link, function (err) {
    if (err) {
      // if it is development return a test text.
      if (env === "development") {
        let textTranslate = "Google Sim Translate From " + fromLang + " to " + toLang + "(" + text + ")";
        return res.end(textTranslate);
      }
      // Not in development return an error
      return next(err);
    }
    browser.fill("textarea#source", text);
    browser.click("input#gt-submit", function(err) {
      if (err) {
        return next(err);
      }
      res.end(browser.query("#result_box").textContent);
    });
  });
}
*/

function translate(req, res, next) {
  debug("translate");

  let fromLang = req.params.fromLang;
  let toLang = req.params.toLang;
  let text = req.body.text;

  if (fromLang === "jp") { fromLang = "ja"; }
  if (toLang === "jp") { toLang = "ja"; }

  if (fromLang === "cz") { fromLang = "cs"; }
  if (toLang === "cz") { toLang = "cs"; }

  gglTranslateAPI(text, {from: fromLang, to: toLang}).then(function (result) {
    res.end(result.text);
  }).catch(function(err) { next(err); });
}

// Export Render Functions for testing purposes
exports.renderArticleId = renderArticleId;
exports.renderList = renderList;
exports.postSetMarkdown = postSetMarkdown;

// postArticle is called, by a post from the createArticle
// view or the /:article_id view, and decides
// wether to create a new object, or update an existing
exports.postArticle = postArticle;
exports.createArticle = createArticle;
exports.searchAndCreate = searchAndCreate;
exports.searchArticles = searchArticles;
exports.postNewComment = postNewComment;
exports.postEditComment = postEditComment;
exports.markCommentRead = markCommentRead;
exports.getArticleFromID = getArticleFromID;

// And configure router to use render Functions
router.get("/list", exports.renderList);
router.get("/create", exports.createArticle);
router.get("/searchandcreate", exports.searchAndCreate);
router.get("/search", exports.searchArticles);
router.post("/create", exports.postArticle);
router.post("/:article_id/copyTo/:blog", copyArticle);
router.post("/translate/:fromLang/:toLang", translate);

router.param("article_id", getArticleFromID);

router.get("/:article_id", exports.renderArticleId);
router.get("/:article_id/votes", renderArticleIdVotes);
router.get("/:article_id/commentArea", renderArticleIdCommentArea);

router.get("/:article_id/markCommentRead", exports.markCommentRead);
router.get("/:article_id/:action.:tag", doAction);
router.get("/:article_id/:votename", renderArticleIdVotesBlog);


router.post("/:article_id/addComment", exports.postNewComment);
router.post("/:article_id/setMarkdown/:lang", exports.postSetMarkdown);
router.post("/:article_id/editComment/:number", exports.postEditComment);
router.post("/:article_id", exports.postArticle);
router.post("/:article_id/witholdvalues", postArticleWithOldValues);




module.exports.router = router;
module.exports.slackrouter = slackrouter;


