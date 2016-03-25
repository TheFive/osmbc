"use strict";

var express  = require('express');
var async    = require('async');
var router   = express.Router();
var should   = require('should');
var markdown = require('markdown-it')();
var debug    = require('debug')('OSMBC:routes:article');

var config        = require('../config.js');


var settingsModule= require('../model/settings.js');
var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');
var logModule     = require('../model/logModule.js');
var configModule  = require('../model/config.js');





function renderArticleId(req,res,next) {
  debug('renderArticleId');

  // Get the ID and the article to display
  var id = req.params.article_id;

  var languageFlags = configModule.getConfig("languageflags");






  articleModule.findById(id,function(err,article) {
    debug('renderArticleId->findById');


    // if the ID does not exist, send an error
    if (!article || typeof(article.id) == 'undefined') return next(new Error("Article "+id+" does not exist"));

    // Variables for rendering purposes

   
    var categories = blogModule.getCategories();

    // Params is used for indicating EditMode
    var params = {};
    var style = req.query.style;
    if (!style) if (req.session.lastStyle) style = req.session.lastStyle;
    if (!style) style = req.user.blogSetting0 + req.user.blogLanguages0;
    if (!style) style = "overviewEN";
    var s = settingsModule.getSettings(style,req.session.language,req.session.language2);
    if (style) params.style = style;
    params.edit = req.query.edit;
    params.left_lang = s.left_lang;
    params.right_lang = s.right_lang;
    params.editComment = null;
    if (req.query.editComment) params.editComment = req.query.editComment;
    if (req.query.notranslation) params.notranslation = req.query.notranslation;


 
    var placeholder = configModule.getPlaceholder();
    async.auto({
      // Find usage of Links in other articles
      articleReferences:article.calculateUsedLinks.bind(article),
      // Find the assoziated blog for this article
      blog:
      function findBlog(callback) {
        debug('renderArticleId->blog');

        blogModule.findOne({name:article.blog},function(err,blog){
          debug('renderArticleId->findeOne');

          if (blog) {
            categories = blog.getCategories();
          } else {
            debug('no blog found !!');
          }

          callback(err,blog);
        });
      },
      // Find all log messages for the article
      changes:
      function (callback) {
        debug('renderArticleId->changes');

        logModule.find(" where data->>'oid' ='"+id+"' and data->>'table' = 'article' and data->>'property' not like 'comment%' ",{column:"timestamp",desc :true},function(err,result) {
          debug('renderArticleId->findLog');

          callback(err,result);
        });
      },
      // (informal) locking information for the article
      edit:
      function (callback){
        debug('renderArticleId->edit');

        if (typeof(params.edit)!='undefined') {
          if (params.edit=="false") {
            delete params.edit;
            article.doUnlock(callback);
            return;
          }
          article.doLock(req.user.displayName,callback);
          return;
        } else { 
          return callback();
        }
      },
        notranslate:
          function (callback){
            debug('renderArticleId->notranslate');

            if (params.notranslation==='true') {
              article.addNotranslate(req.user,function (err) {
                if (err) return callback(err);
                var returnToUrl = config.getValue('htmlroot')+"/article/"+article.id;
                if (params.style) returnToUrl = returnToUrl+"?style="+params.style;
                callback(null,returnToUrl);
              });
            } else return callback();
      }},
        function (err,result) {
          debug('renderArticleId->finalFunction');
          if (err) return next(err);
          if (result.notranslate) return res.redirect(result.notranslate);


          var languages = config.getLanguages();
          for (var i=0;i<languages.length;i++) {
            var lang = languages[i];
            if (typeof(article["markdown"+lang])!='undefined') {
              article["textHtml"+lang]="<ul>"+article.getPreview(lang)+"</ul>";
            }
          }
          if (typeof(article.comment)!='undefined') {
            article.commentHtml = markdown.render(article.comment);
          } 

          // 
          if (req.query.edit && ! params.edit) {
            debug("return to was called, redirecting");
            var returnToUrl = config.getValue('htmlroot')+"/article/"+article.id;
            if (req.session.articleReturnTo) returnToUrl = req.session.articleReturnTo;
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

            res.end(result);return;*/
            res.render('article',{layout:res.rendervar.layout,
                                  article:article,
                                  params:params,
                                  placeholder:placeholder,
                                  blog:result.blog,
                                  changes:result.changes,
                                  articleReferences:result.articleReferences,
                                  usedLinks:result.usedLinks,
                                  categories:categories,
                                  languageFlags:languageFlags});
         }
        }
      );
    }
  );
}

function searchAndCreate(req,res,next) {
  debug('searchAndCreate');
  var search = req.query.search;
  if (req.query.edit && req.query.edit=="false") {
    var returnToUrl = config.getValue('htmlroot')+"/osmbc.html";
    if (req.session.articleReturnTo) returnToUrl = req.session.articleReturnTo;
    res.redirect(returnToUrl);    
    return;
  }
  if (!search || typeof(search)=='undefined') search = "";
  var placeholder = configModule.getPlaceholder();

  articleModule.fullTextSearch(search,{column:"blog",desc:true},function(err,result){
    debug('searchAndCreate->fullTextSearch');
    if (err) return next(err);
    should.exist(res.rendervar);
    res.render("collect",{layout:res.rendervar.layout,
                           search:search,
                           placeholder:placeholder,
                           showCollect:true,
                           categories:blogModule.getCategories(),
                           foundArticles:result});
  });
}


function postArticle(req, res, next) {
  debug('postArticle');

  var id = req.params.article_id;

 

  var article = null;
  var changes = {blog:req.body.blog,
                 collection:req.body.collection,
                 comment:req.body.comment,
                 categoryEN:req.body.categoryEN,
                 version:req.body.version,
                 title:req.body.title,
                 commentStatus:req.body.commentStatus,
                 unpublishReason:req.body.unpublishReason,
                 unpublishReference:req.body.unpublishReference};

  var languages = config.getLanguages();
  for (var i=0;i<languages.length;i++){
    var lang = languages[i];
    changes["markdown"+lang] = req.body["markdown"+lang];
  }
  var returnToUrl ;

  async.parallel([
      function searchArticle(cb) {
        debug('postArticle->searchArticle');
        if (typeof(id)=='undefined') return cb(); 
        articleModule.findById(id,function(err,result) {
          debug('postArticle->searchArticle->findById');
          if (err) return cb(err);
          if (!result) return cb(new Error("Article ID does not exist"));
          article = result;
          returnToUrl  = config.getValue('htmlroot')+"/article/"+article.id;
          if (req.session.articleReturnTo) returnToUrl = req.session.articleReturnTo;
          cb();
        });
      },
      function createArticle(cb) {
        debug('postArticle->createArticle');

        if (typeof(id)!='undefined') return cb(); 
        articleModule.createNewArticle(function(err,result){
          debug('postArticle->createArticle->createNewArticle');
          if (err) return next(err);
          if (typeof(result.id) == 'undefined') return cb(new Error("Could not create Article"));
          article = result;
          changes.version = result.version;
          returnToUrl  = config.getValue('htmlroot')+"/article/"+article.id;
          cb();          
        });
      }
    ],
    function setValues(err) {
      debug('postArticle->setValues');
      if (err) {return next(err);}
      should.exist(article);
      article.setAndSave(req.user,changes,function(err) {
       debug('postArticle->setValues->setAndSave');
        if (err ) {
          next(err);
          return;
        }
        res.redirect(returnToUrl);    
      });
    }
  );
}

function postNewComment(req, res, next) {
  debug('postNewComment');

  var id = req.params.article_id;

 

  var article = null;
  var comment = req.body.comment;
  var returnToUrl;

  async.parallel([
      function searchArticle(cb) {
        debug('postNewComment->searchArticle');
        if (typeof(id)=='undefined') return cb(); 
        articleModule.findById(id,function(err,result) {
          debug('postNewComment->searchArticle->findById');
          if (err) return cb(err);
          if (!result) return cb(new Error("Article ID does not exist"));
          article = result;
          returnToUrl  = config.getValue('htmlroot')+"/article/"+article.id;
          cb();
        });
      }
    ],
    function setValues(err) {
      debug('postNewComment->setValues');
      if (err) {return next(err);}
      should.exist(article);
      article.addComment(req.user,comment,function(err) {
       debug('postNewComment->setValues->addComment');
        if (err ) {
          next(err);
          return;
        }
        res.redirect(returnToUrl);    
      });
    }
  );
}


function postSetMarkdown(req, res, next) {
  debug('postSetMarkdown');

  var id = req.params.article_id;
  var lang = req.params.lang;



  var article = null;
  var markdown = req.body.markdown;
  var oldMarkdown = req.body.oldMarkdown;

  async.parallel([
      function searchArticle(cb) {
        debug('postNewComment->searchArticle');
        if (typeof(id)=='undefined') return cb();
        articleModule.findById(id,function(err,result) {
          debug('postNewComment->searchArticle->findById');
          if (err) return cb(err);
          if (!result) return cb(new Error("Article ID does not exist"));
          article = result;
          cb();
        });
      }
    ],
    function setValues(err) {
      debug('postNewComment->setValues');
      if (err) {return next(err);}
      should.exist(article);
      var change = {};
      change["markdown"+lang]=markdown;
      change.old = {};
      change.old["markdown"+lang]=oldMarkdown;
      article.setAndSave(req.user,change,function(err){
        if (err) return next(err);
        var returnToUrl = config.getValue('htmlroot')+"/blog/"+article.blog+"/previewNEdit";
        res.redirect(returnToUrl);
      });
    }
  );
}
function postEditComment(req, res, next) {
  debug('postEditComment');

  var id = req.params.article_id;
  var number = req.params.number;



  var article = null;
  var comment = req.body.comment;
  var returnToUrl;

  async.parallel([
      function searchArticle(cb) {
        debug('postNewComment->searchArticle');
        if (typeof(id)=='undefined') return cb();
        articleModule.findById(id,function(err,result) {
          debug('postNewComment->searchArticle->findById');
          if (err) return cb(err);
          if (!result) return cb(new Error("Article ID does not exist"));
          article = result;
          returnToUrl  = config.getValue('htmlroot')+"/article/"+article.id;
          cb();
        });
      }
    ],
    function setValues(err) {
      debug('postNewComment->setValues');
      if (err) {return next(err);}
      should.exist(article);
      article.editComment(req.user,number,comment,function(err) {
        debug('postNewComment->setValues->addComment');
        if (err ) {
          next(err);
          return;
        }
        res.redirect(returnToUrl);
      });
    }
  );
}

function createArticle(req, res, next) {
  debug('createArticle');


  var placeholder = configModule.getPlaceholder();
  var proto = {};
  if (typeof(req.query.blog) != 'undefined' ) {
    proto.blog = req.query.blog;
  }
  if (typeof(req.query.categoryEN) != 'undefined' ) {
    proto.categoryEN = req.query.categoryEN;
  }

  async.series([
    function calculateWN(callback) {
      debug('createArticle->calculatenWN');
      // Blog Name is defined, so nothing to calculate
      if (proto.blog) return callback();
      blogModule.findOne({status:'open'},{column:"name",desc:false},
                         function calculateWNResult(err,blog){
        debug('createArticle->calculateWNResult');
        if (blog) {
          if (typeof(proto.blog) == 'undefined') {
            proto.blog=blog.name;
          }
        }
        callback();
      });
    }
    ],
    function finalFunction(err) {
      debug('createArticle->finalFunction');
        if (err) return next(err);
        should.exist(res.rendervar);
        res.render("collect",{layout:res.rendervar.layout,
                              search:"",
                              placeholder:placeholder,
                              showCollect:true,
                              categories:blogModule.getCategories()});
    }
  );
}
 

function searchArticles(req, res, next) {
  debug('search');
  var search = req.query.search;
  if (!search || typeof(search)=='undefined') search = "";
  var result = null;
 
  async.series([
    function doSearch(cb) {
      debug('search->doSearch');
      if (search !== "") {
        articleModule.fullTextSearch(search,{column:"blog",desc:true},function(err,r){
          debug('search->doSearch->fullTextSearch');
          if (err) return cb(err);
          result = r;
          cb();
        });            
      }
      else return cb();
    }
    ],
    function finalFunction(err) {
      debug('search->finalFunction');
      if (err) return next(err);
      should.exist(res.rendervar);
      res.render("collect",{layout:res.rendervar.layout,
                            search:search,
                            foundArticles:result,
                            placeholder:{},
                            showCollect:false,
                            categories:blogModule.getCategories()});
    }
  );
} 



function renderList(req,res,next) {
  debug('renderList');
  req.session.articleReturnTo = req.originalUrl;
  var blog = req.query.blog;
  var user = req.query.user;
  var property = req.query.property;
  var myArticles = (req.query.myArticles === "true");
  var listOfChanges = (typeof(user)=="string" && typeof(property)=="string");
  var simpleFind = !(listOfChanges || myArticles);

  
  var articles;

  async.parallel([
      function findArticleFunction(callback) {
        debug('renderList->findArticleFunction');
        if (!simpleFind) return callback();
        var query = {};
        if (typeof(blog)!='undefined') {
          query.blog = blog;
        }
        articleModule.find(query,{column:"title"},function(err,result) {
          debug('renderList->findArticleFunction->find');
          articles = result;
          callback();
        });
      },
      function findMyArticles(callback) {
        debug('renderList->findMyArticles');
        if (!myArticles) return callback();

  
        articleModule.findEmptyUserCollectedArticles(req.session.language,req.user.displayName,function(err,result) {
          debug('renderList->findMyArticles->find');
          articles = result;
          callback();
        });
      },
      function findUserEditedArticles(callback) {
        debug('renderList->findMyArticles');
        if (!listOfChanges) return callback();

  
        articleModule.findUserEditFieldsArticles(blog,user,property,function(err,result) {
          debug('renderList->findMyArticles->find');
          articles = result;
          callback();
        });
      }


    ],function finalFunction(error) {
      debug('renderList->finalFunction');
        if (error) return next(error);
        should.exist(res.rendervar);
        res.render('articlelist',{layout:res.rendervar.layout,
                                  articles:articles});      
    }
  );
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


// And configure router to use render Functions
router.get('/list', exports.renderList);
router.get('/create',exports.createArticle);
router.get('/searchandcreate',exports.searchAndCreate);
router.get('/search',exports.searchArticles);
router.post('/create', exports.postArticle);

router.get('/:article_id', exports.renderArticleId );

router.post('/:article_id/addComment', exports.postNewComment);
router.post('/:article_id/setMarkdown/:lang', exports.postSetMarkdown);
router.post('/:article_id/editComment/:number', exports.postEditComment);
router.post('/:article_id', exports.postArticle);



module.exports.router = router;


