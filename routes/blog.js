var express = require('express');
var async   = require('async');
var should = require('should');
var router = express.Router();

var debug = require('debug')('OSMBC:routes:blog');
var blogModule = require('../model/blog.js');
var logModule = require('../model/logModule.js');
var articleModule = require('../model/article.js');
var config = require('../config.js');

/* GET users listing. */
router.get('/:blog_id', function(req, res, next) {
  debug('router.get /:blog_id');
  var id = req.params.blog_id;
 
  var edit = 'overpass';
  var lang = "DE";

  if (req.query.style == 'preview') {
    lang = "DE";
    edit = true;
  }
  if (req.query.style == 'previewEN') {
    lang = "EN";
    edit = true;
  }
  if (req.query.style == 'overview') {
    lang = "DE";
    edit = 'overview';
  }

  blogModule.findById(id,function(err,blog) {
    if (! blog || typeof(blog.id) == 'undefined') return next();

    var changes = [];
    var articles = {};
    var main_text;



    async.series([
      function (callback) {
        blog.preview(edit,lang,function(err,result) {
          if (err) return callback(err);
          main_text = result.preview;
          articles = result.articles;
          callback();
        })
      },
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
 
 /*    function (callback) {
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
      },*/
      function (callback) {
        logModule.find({oid:id,table:"blog"},{column:"timestamp",desc :true},function(err,result) {
          if (err) return callback(err);
          changes = result;

          callback();
        })
      }],
      function (err) {
        should.exist(res.rendervar);
        res.render('blog',{layout:res.rendervar.layout,
                           main_text:main_text,
                           blog:blog,
                           changes:changes,
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

  if (typeof(status)!='undefined') {
    query.status = status;
  }

  async.auto({
        blogs:function(callback) {
                 blogModule.find(query,{column:"name",desc:true},function(err,blogs) {
                 callback(err,blogs);
              })
        }
      },function(err,result) {
          should.exist(res.rendervar);
          res.render('bloglist',{layout:res.rendervar.layout,
                                blogs:result.blogs});
        });

});

router.get('/:blog_id/preview', function(req, res, next) {
  debug('router.get //:blog_id/preview');
  var id = req.params.blog_id;
  blogModule.findById(id,function(err,blog) {
    if (typeof(blog.id) == 'undefined') return next();

    var edit = req.query.edit;
    var lang = req.query.lang;
    if (typeof(lang)=='undefined') lang = "DE";

    var changes = [];
   




    async.auto({ 
        converter:function(callback) {
                    blog.preview(edit,lang,function(err,result) {
                      callback(err,result);
                    })
                  }
      },
      function(err,result) {
        if (req.query.download=="true") {
          res.end(result.converter.preview,"UTF8");
          return;
        } else {
          should.exist(res.rendervar);
          res.render('blogpreview',{layout:res.rendervar.layout,
                             blog:blog,
                             articles:result.converter.articles,
                             preview:result.converter.preview,
                             edit:edit,
                             lang:lang,
                             categories:blogModule.categories});
        }
      }
    )
  });});

router.get('/create', function(req, res, next) {
  debug('router.get /create');

  blogModule.createNewBlog(function(err,blogs) {
    res.redirect(config.getValue('htmlroot')+'/blog/list?status=open');
    //res.render('bloglist',{blogs:blogs,user:req.user});
  });
});

module.exports = router;


