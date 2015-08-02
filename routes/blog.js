var express = require('express');
var async   = require('async');
var moment   = require('moment');
var router = express.Router();
var debug = require('debug')('OSMBC:routes:blog');
var blogModule = require('../model/blog.js');
var logModule = require('../model/logModule.js');

/* GET users listing. */
router.get('/:blog_id', function(req, res, next) {
  debug('router.get /:blog_id');
  var id = req.params.blog_id;
  blogModule.findById(id,function(err,blog) {
    if (typeof(blog.id) == 'undefined') return next();

    var changes = [];
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
        logModule.find({id:id,table:"blog"},{column:"timestamp",desc :true},function(err,result) {
          if (err) return callback(err);
          changes = result;

          callback();
        })
      }],
      function (err) {
        res.render('blog',{blog:blog,user:req.user,changes:changes,moment:moment});
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
  blogModule.find(query,{column:"name",desc:true},function(err,blogs) {
    res.render('bloglist',{blogs:blogs,user:req.user});
  });
});

router.get('/create', function(req, res, next) {
  debug('router.get /create');

  blogModule.createNewBlog(function(err,blogs) {
    res.redirect('/blog/list');
    //res.render('bloglist',{blogs:blogs,user:req.user});
  });
});

module.exports = router;


