var express = require('express');
var async   = require('async');
var moment = require('moment');
var router = express.Router();
var markdown = require('markdown').markdown;
var debug = require('debug')('OSMBC:routes:article');

var articleModule = require('../model/article.js');
var blogModule = require('../model/blog.js');
var logModule = require('../model/logModule.js');

/* GET users listing. */
router.get('/:article_id', function(req, res, next) {
  debug('router.get');
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {
    if (typeof(article.id) == 'undefined') return next();

   var listOfOpenBlog;
   var params = {};
    params.edit = req.query.edit;
    var changes = [];


    async.series([
      function (callback) {
        if (typeof(req.query.setCategory)!='undefined')
        {
          var changes = {category:req.query.setCategory};
          article.setAndSave(req.user.displayName,changes,function(err) {
            var info = {};
            info.message = "Category Changed";
            info.status = "message";
            if (err) {
              console.dir(err);
              info.message = JSON.stringify(err);
              info.status = 'error';
            }
            return callback();
          })
        } else return callback();
      },
      function (callback) {
        if (typeof(req.query.setBlog)!='undefined')
        {
          var changes = {blog:req.query.setBlog};
          article.setAndSave(req.user.displayName,changes,function(err) {
            var info = {};
            info.message = "Blog Changed";
            info.status = "message";
            if (err) {
              console.dir(err);
              info.message = JSON.stringify(err);
              info.status = 'error';
            }
            return callback();
          })
        } else return callback();
      },
      function (callback) {
        logModule.find({id:id},{column:"timestamp",desc :true},function(err,result) {
          if (err) return callback(err);
          changes = result;

          callback();
        })
      },
      function (callback) {
        articleModule.getListOfOpenBlog(function(err,result) {
          listOfOpenBlog = result;
          callback();
        })
      },
      function (callback){
        if (typeof(params.edit)!='undefined') {
          article.lock={};
          article.lock.user = req.user.displayName;
          article.lock.timestamp = new Date();
          article.save(callback);
        } else { 
          return callback()
        }
      }],
        function (err) {
          if (typeof(article.markdown)!='undefined') {
            var text = article.markdown;
            text = "###"+article.category+"\n* ...\n"+text+"\n* ...";
            article.textHtml = markdown.toHTML(text)
          } 
          if (typeof(article.comment)!='undefined') {
            article.commentHtml = markdown.toHTML(article.comment)
          } 

 
          res.render('article',{article:article,
                                params:params,
                                user:req.user,
                                changes:changes,
                                listOfOpenBlog:listOfOpenBlog,
                                moment:moment,
                                categories:blogModule.categories});
        }
    );
  });
});
 
router.post('/:article_id', function(req, res, next) {
  debug('router.put');
  var id = req.params.article_id;
  articleModule.findById(id,function(err,article) {
    if (typeof(article.id) == 'undefined') return next();
  	var changes = {markdown:req.body.markdown,
                   collection:req.body.collection,
                   comment:req.body.comment,
                   category:req.body.category,
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
                                  user:req.user});      
    })
 
 
  });
});

module.exports = router;


