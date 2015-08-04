var express = require('express');
var async   = require('async');
var moment   = require('moment');
var router = express.Router();
var markdown = require('markdown').markdown;

var debug = require('debug')('OSMBC:routes:blog');
var blogModule = require('../model/blog.js');
var logModule = require('../model/logModule.js');
var articleModule = require('../model/article.js');

/* GET users listing. */
router.get('/:blog_id', function(req, res, next) {
  debug('router.get /:blog_id');
  var id = req.params.blog_id;
  blogModule.findById(id,function(err,blog) {
    if (typeof(blog.id) == 'undefined') return next();

    var changes = [];
    var articles = {};

    var listOfOpenBlog;


    async.series([
     function (callback) {
        if (typeof(req.query.setStatus)!='undefined')
        {
          var changes = {status:req.query.setStatus};
          blog.setAndSave(req.user.displayName,changes,function(err) {
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
        articleModule.find({blog:blog.name},function(err,result){
          for (var i=0;i<result.length;i++ ) {
            var r = result[i];
            if (typeof(articles[r.category]) == 'undefined') {
              articles[r.category] = [];
            }
            articles[r.category].push(r);
          }
          callback();
        })
      },
      function (callback) {
        articleModule.getListOfOpenBlog(function(err,result) {
          listOfOpenBlog = result;
          callback();
        })
      },
      function (callback) {
        logModule.find({id:id,table:"blog"},{column:"timestamp",desc :true},function(err,result) {
          if (err) return callback(err);
          changes = result;

          callback();
        })
      }],
      function (err) {
        res.render('blog',{blog:blog,
                           user:req.user,
                           changes:changes,
                           listOfOpenBlog:listOfOpenBlog,
                           moment:moment,
                           articles:articles,
                           categories:blogModule.categories});
      }
    )
  });
});
 

 router.get('/list', function(req, res, next) {
  debug('router.get /list');
  var status = req.query.status;
  var query = {};

  var listOfOpenBlog;
  if (typeof(status)!='undefined') {
    query.status = status;
  }

  async.series([
    function (callback) {
        articleModule.getListOfOpenBlog(function(err,result) {
          listOfOpenBlog = result;
          callback();
        })
      }  
      ],function(err) {
        blogModule.find(query,{column:"name",desc:true},function(err,blogs) {
          res.render('bloglist',{blogs:blogs,
                                listOfOpenBlog:listOfOpenBlog,
                                  user:req.user});
        });

  })
});

router.get('/:blog_id/preview', function(req, res, next) {
  debug('router.get //:blog_id/preview');
  var id = req.params.blog_id;
  blogModule.findById(id,function(err,blog) {
    if (typeof(blog.id) == 'undefined') return next();

    var edit = req.query.edit;

    var changes = [];
    var articles = {};
    var fullMarkdown ="";
    var preview = "";
    var listOfOpenBlog;


    async.series([ 
      function (callback) {
        articleModule.getListOfOpenBlog(function(err,result) {
          listOfOpenBlog = result;
          callback();
        })
      },
      function (callback) {
        articleModule.find({blog:blog.name},function(err,result){
          for (var i=0;i<result.length;i++ ) {
            var r = result[i];
            if (typeof(r.markdown)!='undefined') {
              var text = r.markdown;
              r.textHtml = markdown.toHTML(text)
            } 
            if (typeof(articles[r.category]) == 'undefined') {
              articles[r.category] = [];
            }
            articles[r.category].push(r);
          }
          for (var i=0;i<blogModule.categories.length;i++) {
            var category = blogModule.categories[i];
            if (typeof(articles[category])!='undefined') {
              fullMarkdown += "## "+category+"\n";
              for (var j=0;j<articles[category].length;j++) {
                var r = articles[category][j];
                var editMark = "";
                if (edit) editMark = " [edit](/article/"+r.id+")";
                debug("Title %s",r.title);
                if (typeof(r.markdown)!='undefined' && r.markdown != "") {
                  debug("Markdown exist");
                  fullMarkdown += r.markdown+editMark+"\n";
                } else if (typeof(r.collection)!='undefined') {
                  debug("Try Collection");
                  var s = r.collection;
                  debug(s);
                  s.replace("\n","    ");
                  debug(s);
                  fullMarkdown += "    "+s+"\n"+editMark;
                }
                else {
                  debug("Use Title");
                  fullMarkdown += "    "+r.title+"\n"+editMark;
                }
              }
            }
          }
          preview = markdown.toHTML(fullMarkdown);
          callback();
        })
      }],
      function (err) {
        res.render('blogpreview',{blog:blog,
                           user:req.user,
                           articles:articles,
                           listOfOpenBlog:listOfOpenBlog,
                           preview:preview,
                           fullMarkdown:fullMarkdown,
                           categories:blogModule.categories});
      }
    )
  });});

router.get('/create', function(req, res, next) {
  debug('router.get /create');

  blogModule.createNewBlog(function(err,blogs) {
    res.redirect('/blog/list');
    //res.render('bloglist',{blogs:blogs,user:req.user});
  });
});

module.exports = router;


