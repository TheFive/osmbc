var express = require('express');
var async   = require('async');
var moment   = require('moment');
var router = express.Router();

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

    var listOfOrphanBlog;


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
        articleModule.getListOfOrphanBlog(function(err,result) {
          listOfOrphanBlog = result;
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
                           listOfOrphanBlog:listOfOrphanBlog,
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

  var listOfOrphanBlog;
  if (typeof(status)!='undefined') {
    query.status = status;
  }

  async.auto({
        listOfOrphanBlog: articleModule.getListOfOrphanBlog,
        blogs:function(callback) {
                 blogModule.find(query,{column:"name",desc:true},function(err,blogs) {
                 callback(err,blogs);
              })
        }
      },function(err,result) {
          res.render('bloglist',{
                                listOfOrphanBlog:result.listOfOrphanBlog,
                                blogs:result.blogs,
                                user:req.user});
        });

});

router.get('/:blog_id/preview', function(req, res, next) {
  debug('router.get //:blog_id/preview');
  var id = req.params.blog_id;
  blogModule.findById(id,function(err,blog) {
    if (typeof(blog.id) == 'undefined') return next();

    var edit = req.query.edit;

    var changes = [];
   
    var listOfOrphanBlog;




    async.auto({ 
        getListOfOrphanBlog:articleModule.getListOfOrphanBlog,
        converter:function(callback) {
                    blog.preview(edit,function(err,result) {
                      callback(err,result);
                    })
                  }
      },
      function(err,result) {
        if (req.query.download=="true") {
          res.end(result.converter.preview,"UTF8");
          return;
        } else {
          res.render('blogpreview',{blog:blog,
                             user:req.user,
                             articles:result.converter.articles,
                             listOfOrphanBlog:result.listOfOrphanBlog,
                             preview:result.converter.preview,
                             edit:edit,
                             categories:blogModule.categories});
        }
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


