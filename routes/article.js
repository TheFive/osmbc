var express  = require('express');
var async    = require('async');
var router   = express.Router();
var should   = require('should');
var markdown = require('markdown').markdown;
var debug    = require('debug')('OSMBC:routes:article');

var util          = require('../util.js');
var config        = require('../config.js');

var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');
var logModule     = require('../model/logModule.js');


function renderArticleId(req,res,next) {
  debug('renderArticleId');

  // Get the ID and the article to display
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {

    // if the ID does not exist, send an error
    if (!article || typeof(article.id) == 'undefined') return next(new Error("Article does not exist"));

    // Variables for rendering purposes

    // Used for display changes (logModule)
    var changes = [];

    // Params is used for indicating EditMode
    var params = {};
    params.edit = req.query.edit;

    // calculate all used Links for the article
    var usedLinks = article.calculateLinks();

    async.auto({
      // Find usage of Links in other articles
      articleReferences:article.calculateUsedLinks.bind(article),
      // Find the assoziated blog for this article
      blog:
      function findBlog(callback) {
        blogModule.findOne({name:article.blog},function(err,result){
          callback(err,result);
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

          // calculate all previews for markdown code
          if (typeof(article.markdown)!='undefined') {
            article.textHtml = article.preview();
          } 
          if (typeof(article.markdownEN)!='undefined') {
            article.textHtmlEN = article.previewEN();
          } 
          if (typeof(article.comment)!='undefined') {
            article.commentHtml = markdown.toHTML(article.comment)
          } 
          // 
          if (req.query.edit && ! params.edit) {
            res.redirect(config.getValue('htmlroot')+"/article/"+id);    
          } else {
            // Render the article with all calculated vars
            // (res.rendervar.layout is set by the express routing
            // mechanism before this router)
            res.render('article',{layout:res.rendervar.layout,
                                  article:article,
                                  params:params,
                                  blog:result.blog,
                                  changes:result.changes,
                                  articleReferences:result.articleReferences,
                                  usedLinks:result.usedLinks,
                                  categories:blogModule.categories});
         }
        }
      );
    }
  );
}

function searchAndCreate(req,res,next) {
  debug('searchAndCreate');
  var search = req.query.search;
  articleModule.fullTextSearch(search,{column:"blog",desc:true},function(err,result){
    if (err) return next(err);
    should.exist(res.rendervar);
    res.render("collect",{layout:res.rendervar.layout,
                           search:search,
                           foundArticles:result});
  })
}


function postArticle(req, res, next) {
  debug('postArticle');
  var id = req.params.article_id;

  var article = null;
  var changes = {markdown:req.body.markdown,
                 markdownEN:req.body.markdownEN,
                 blog:req.body.blog,
                 blogEN:req.body.blogEN,
                 collection:req.body.collection,
                 comment:req.body.comment,
                 category:req.body.category,
                 categoryEN:req.body.categoryEN,
                 version:req.body.version,
                 title:req.body.title};

  async.parallel([
      function searchArticle(cb) {
        debug('postArticle->searchArticle')
        if (typeof(id)=='undefined') return cb(); 
        articleModule.findById(id,function(err,result) {
          if (err) return cb(err);
          if (!result) return cb(new Error("Article ID does not exist"));
          article = result;
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
          cb();          
        })
      }
    ],
    function setValues(err) {
      debug('postArticle->setValues');
      if (err) {return next(err);}
      should.exist(article);
      article.setAndSave(req.user.displayName,changes,function(err) {
        if (err ) 
          {
            next(err);
            return;
          }
        res.redirect(config.getValue('htmlroot')+"/article/"+article.id);    
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
  if (typeof(req.query.category) != 'undefined' ) {
    proto.category = req.query.category;
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
        res.render("collect",{layout:res.rendervar.layout});
    }
  );
}
  



function renderList(req,res,next) {
  debug('renderList');
  var blog = req.query.blog;
  var markdown = req.query.markdown;
  var markdownEN = req.query.markdownEN;
  var query = {};
  if (typeof(blog)!='undefined') {
    query.blog = blog;
  }
  if (typeof(markdown)!='undefined') {
    query.markdown = markdown;
  }
  if (typeof(markdownEN)!='undefined') {
    query.markdownEN = markdownEN;
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


// And configure router to use render Functions
router.get('/list', exports.renderList);
router.get('/create',exports.createArticle);
router.get('/searchandcreate',exports.searchAndCreate);
router.post('/create', exports.postArticle);

router.get('/:article_id', exports.renderArticleId );
router.post('/:article_id', exports.postArticle);



module.exports.router = router;


