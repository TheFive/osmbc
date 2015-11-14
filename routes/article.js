var express  = require('express');
var async    = require('async');
var router   = express.Router();
var should   = require('should');
var markdown = require('markdown').markdown;
var debug    = require('debug')('OSMBC:routes:article');
var path     = require('path');
var fs       = require('fs');

var util          = require('../util.js');
var config        = require('../config.js');

var settingsModule = require('../model/settings.js');
var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');
var logModule     = require('../model/logModule.js');


var placeholder = {
  
}



function renderArticleId(req,res,next) {
  debug('renderArticleId');

  // Get the ID and the article to display
  var id = req.params.article_id;

  var file =  path.resolve(__dirname,'..','data', "article.placeholder.json");
  var placeholder =  JSON.parse(fs.readFileSync(file));
    





  articleModule.findById(id,function(err,article) {

    // if the ID does not exist, send an error
    if (!article || typeof(article.id) == 'undefined') return next(new Error("Article "+id+" does not exist"));

    // Variables for rendering purposes

    // Used for display changes (logModule)
    var changes = [];
    var categories = blogModule.getCategories();

    // Params is used for indicating EditMode
    var params = {};
    var style = req.query.style;
    if (!style) if (req.session.lastStyle) style = req.session.lastStyle;
    if (!style) style = req.user.blogSetting0 + req.user.blogLanguages0;
    if (!style) style = "overviewEN";
    var s = settingsModule.getSettings(style);
    if (style) params.style = style;
    params.edit = req.query.edit;
    params.left_lang = s.left_lang;
    params.right_lang = s.right_lang;


    // calculate all used Links for the article
    var usedLinks = article.calculateLinks();

    async.auto({
      // Find usage of Links in other articles
      articleReferences:article.calculateUsedLinks.bind(article),
      // Find the assoziated blog for this article
      blog:
      function findBlog(callback) {
        blogModule.findOne({name:article.blog},function(err,blog){
          if (blog) categories = blog.getCategories();
          callback(err,blog);
        })
      },
      // Find all log messages for the article
      changes:
      function (callback) {
        logModule.find({oid:id,table:"article"},{column:"timestamp",desc :true},function(err,result) {
          callback(err,result);
        })
      },
      // (informal) locking information for the article
      edit:
      function (callback){
        if (typeof(params.edit)!='undefined') {
          if (params.edit=="false") {
            delete params.edit;
            article.doUnlock(callback);
            return;
          }
          article.doLock(req.user.displayName,callback);
          return;
        } else { 
          return callback()
        }
      }},
        function (err,result) {

          var languages = config.getLanguages();
          for (i=0;i<languages.length;i++) {
            var lang = languages[i];
            if (typeof(article["markdown"+lang])!='undefined') {
              article["textHtml"+lang]="<ul>"+article.getPreview(lang)+"</ul>";
            }
          }
          if (typeof(article.comment)!='undefined') {
            article.commentHtml = markdown.toHTML(article.comment)
          } 

          // 
          if (req.query.edit && ! params.edit) {
            var returnToUrl = config.getValue('htmlroot')+"/article/"+article.id;
            if (req.session.articleReturnTo) returnToUrl = req.session.articleReturnTo;
            res.redirect(returnToUrl);    
          } else {
            // Render the article with all calculated vars
            // (res.rendervar.layout is set by the express routing
            // mechanism before this router)
            res.render('article',{layout:res.rendervar.layout,
                                  article:article,
                                  params:params,
                                  placeholder:placeholder,
                                  blog:result.blog,
                                  changes:result.changes,
                                  articleReferences:result.articleReferences,
                                  usedLinks:result.usedLinks,
                                  categories:categories});
         }
        }
      );
    }
  );
}

function searchAndCreate(req,res,next) {
  debug('searchAndCreate');
  var search = req.query.search;
  var file =  path.resolve(__dirname,'..','data', "article.placeholder.json");
  var placeholder =  JSON.parse(fs.readFileSync(file));
 
  if (!search || typeof(search)=='undefined') search = "";
  articleModule.fullTextSearch(search,{column:"blog",desc:true},function(err,result){
    if (err) return next(err);
    should.exist(res.rendervar);
    res.render("collect",{layout:res.rendervar.layout,
                           search:search,
                           placeholder:placeholder,
                           showCollect:true,
                           categories:blogModule.getCategories(),
                           foundArticles:result});
  })
}
 // Generate Compile Error

 //Funktino kaputt Collect geht nicht.

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
                 commentStatus:req.body.commentStatus};

  var languages = config.getLanguages();
  for (var i=0;i<languages.length;i++){
    var lang = languages[i];
    changes["markdown"+lang] = req.body["markdown"+lang];
  }
  var returnToUrl ;

  async.parallel([
      function searchArticle(cb) {
        debug('postArticle->searchArticle')
        if (typeof(id)=='undefined') return cb(); 
        articleModule.findById(id,function(err,result) {
          if (err) return cb(err);
          if (!result) return cb(new Error("Article ID does not exist"));
          article = result;
          returnToUrl  = config.getValue('htmlroot')+"/article/"+article.id;
          if (req.session.articleReturnTo) returnToUrl = req.session.articleReturnTo;
          cb();
        })
      },
      function createArticle(cb) {
        debug('postArticle->createArticle');

        if (typeof(id)!='undefined') return cb(); 
        articleModule.createNewArticle(function(err,result){
          if (err) return next(err);
          if (typeof(result.id) == 'undefined') return cb(new Error("Could not create Article"));
          article = result;
          returnToUrl  = config.getValue('htmlroot')+"/article/"+article.id;
          cb();          
        })
      }
    ],
    function setValues(err) {
      debug('postArticle->setValues');
      if (err) {return next(err);}
      should.exist(article);
      article.setAndSave(req.user.displayName,changes,function(err) {
        if (err ) {
          next(err);
          return;
        }
        res.redirect(returnToUrl);    
      })
    }
  )
}

function createArticle(req, res, next) {
  debug('createArticle');
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
      })
    }
    ],
    function finalFunction(err) {
      debug('createArticle->finalFunction');
        should.exist(res.rendervar);
        res.render("collect",{layout:res.rendervar.layout,
                              search:"",
                              showCollect:true,
                              categories:blogModule.getCategories()});
    }
  );
}
 

function search(req, res, next) {
  debug('search');
  var search = req.query.search;
  if (!search || typeof(search)=='undefined') search = "";
  var result = null;
 
  async.series([
    function doSearch(cb) {
       articleModule.fullTextSearch(search,{column:"blog",desc:true},function(err,r){
          if (err) return cb(err);
          result = r;
          cb();
       })    

    }
    ],
    function finalFunction(err) {
      debug('search->finalFunction');
      if (err) return next(err);
      should.exist(res.rendervar);
      res.render("collect",{layout:res.rendervar.layout,
                            search:search,
                            foundArticles:result,
                            showCollect:false,
                            categories:blogModule.getCategories()});
    }
  );
} 



function renderList(req,res,next) {
  debug('renderList');
  req.session.articleReturnTo = req.originalUrl;
  var blog = req.query.blog;
  var markdownDE = req.query.markdownDE;
  var markdownEN = req.query.markdownEN;
  var categoryEN = req.query.categoryEN;
  var query = {};
  if (typeof(blog)!='undefined') {
    query.blog = blog;
  }
  if (typeof(markdownDE)!='undefined') {
    query.markdownDE = markdownDE;
  }
  if (typeof(markdownEN)!='undefined') {
    query.markdownEN = markdownEN;
  }
  if (typeof(categoryEN)!='undefined') {
    query.categoryEN = categoryEN;
  }

  
  var articles;

  async.parallel([
      function findArticleFunction(callback) {
        debug('renderList->findArticleFunction');
        articleModule.find(query,{column:"title"},function(err,result) {
          articles = result;
          callback();
        })
      }

    ],function finalFunction(error) {
      debug('renderList->finalFunction');
        should.exist(res.rendervar);
        res.render('articlelist',{layout:res.rendervar.layout,
                                  articles:articles});      
    }
  )
}


// Export Render Functions for testing purposes
exports.renderArticleId = renderArticleId;
exports.renderList = renderList;

// postArticle is called, by a post from the createArticle
// view or the /:article_id view, and decides
// wether to create a new object, or update an existing
exports.postArticle = postArticle;
exports.createArticle = createArticle;
exports.searchAndCreate = searchAndCreate;
exports.search = search;


// And configure router to use render Functions
router.get('/list', exports.renderList);
router.get('/create',exports.createArticle);
router.get('/searchandcreate',exports.searchAndCreate);
router.get('/search',exports.search);
router.post('/create', exports.postArticle);

router.get('/:article_id', exports.renderArticleId );
router.post('/:article_id', exports.postArticle);



module.exports.router = router;


