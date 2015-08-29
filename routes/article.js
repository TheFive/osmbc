var express  = require('express');
var async    = require('async');
var moment   = require('moment');
var router   = express.Router();
var markdown = require('markdown').markdown;
var debug    = require('debug')('OSMBC:routes:article');

var util          = require('../util.js');

var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');
var logModule     = require('../model/logModule.js');


function renderArticleId(req,res,next) {
  debug('renderArticleId');

  // Get the ID to display
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {

  // if the ID does not exist, go ahead in routing process
  if (typeof(article.id) == 'undefined') return next();

  // Variables for rendering purposes

  // ListOfOpenBlog is used to show all openBlogs to assign an article to
  var listOfOpenBlog;

  // Used for display changes
  var changes = [];

  // Params is used for WHAT ??????
  var params = {};
  
  params.edit = req.query.edit;

  // calculate all used Links for the article
  var usedLinks = article.calculateLinks();

 



  async.auto({
    
    articleReferences:article.calculateUsedLinks.bind(article),
    changes:
    function (callback) {
      logModule.find({oid:id,table:"article"},{column:"timestamp",desc :true},function(err,result) {
        callback(err,result);
      })
    },
    listOfOpenBlog:
    function (callback) {
      articleModule.getListOfOpenBlog(function(err,result) {
        callback(err,result);
      })
    },
    edit:
    function (callback){
      if (typeof(params.edit)!='undefined') {
        article.lock={};
        article.lock.user = req.user.displayName;
        article.lock.timestamp = new Date();
        article.save(callback);
      } else { 
        return callback()
      }
    }},
      function (err,result) {
        if (typeof(article.markdown)!='undefined') {
          article.textHtml = article.preview();
        } 
        if (typeof(article.markdownEN)!='undefined') {
          article.textHtmlEN = article.previewEN();
        } 
        if (typeof(article.comment)!='undefined') {
          article.commentHtml = markdown.toHTML(article.comment)
        } 


        res.render('article',{article:article,
                              params:params,
                              user:req.user,
                              changes:result.changes,
                              listOfOpenBlog:result.listOfOpenBlog,
                              moment:moment,
                              articleReferences:result.articleReferences,
                              usedLinks:result.usedLinks,
                              util:util,
                              categories:blogModule.categories});
      }
    );
  });
}

module.exports.renderArticleId = renderArticleId;

router.get('/:article_id', exports.renderArticleId );

// For test purposes
 
router.post('/:article_id', function(req, res, next) {
  debug('router.post /:article_id');
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {
    if (typeof(article.id) == 'undefined') return next();
  	var changes = {markdown:req.body.markdown,
                   markdownEN:req.body.markdownEN,
                   blog:req.body.blog,
                   blogEN:req.body.blogEN,
                   collection:req.body.collection,
                   comment:req.body.comment,
                   category:req.body.category,
                   categoryEN:req.body.categoryEN,
                   title:req.body.title};

    article.setAndSave(req.user.displayName,changes,function(err) {
      res.redirect("/article/"+id);    
    })
  });
});

router.get('/create', function(req, res, next) {
  debug('router.get /create');
  var proto = {};
  if (typeof(req.query.blog) != 'undefined' ) {
    proto.blog = req.query.blog;
  }
  if (typeof(req.query.category) != 'undefined' ) {
    proto.category = req.query.category;
  }

  async.series([
    function calculateWN(callback) {
      blogModule.findOne({status:'open'},{column:"name",desc:false},
                         function calculateWNResult(err,blog){
        if (blog) {
          if (typeof(proto.blog) == 'undefined') {
            proto.blog=blog.name;
          }
        }
        callback();
      })
    }
    ],
    function(err) {
      articleModule.createNewArticle(proto,function(err,article) {
        res.redirect('/article/'+article.id+"?edit=collection");
      });
    }
  );
});


router.get('/list', function(req, res, next) {
  debug('router.get /list');
  var blog = req.query.blog;
  var markdown = req.query.markdown;
  var query = {};
  if (typeof(blog)!='undefined') {
    query.blog = blog;
  }
  if (typeof(markdown)!='undefined') {
    query.markdown = markdown;
  }
  var listOfOpenBlog;

  async.series([
     function (callback) {
        articleModule.getListOfOpenBlog(function(err,result) {
          listOfOpenBlog = result;
          callback();
        })
      }

    ],function(error) {
        articleModule.find(query,{},function(err,articles) {
        res.render('articlelist',{articles:articles,
                                  listOfOpenBlog:listOfOpenBlog,
                                  util:util,
                                  user:req.user});      
    })
 
 
  });
});

module.exports.router = router;


