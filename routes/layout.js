var express  = require('express');
var async    = require('async');
var moment   = require('moment');
var router   = express.Router();
var should  = require('should');
var debug    = require('debug')('OSMBC:routes:layout');

var util          = require('../util.js');
var config        = require('../config.js');

var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');
var logModule     = require('../model/logModule.js');

var htmlRoot = config.getValue("htmlroot");

function prepareRenderLayout(req,res,next) {
  debug('prepareRenderLayout');




  // Variables for rendering purposes

  // ListOfOrphanBlog is used to show all orphanedBlog to assign an article to
  var listOfOrphanBlog;
  var listOfOpenBlog;
  var listOfReviewBlog;
  // Used for display changes

  // Params is used for indicating Edit

  async.auto({
    
    listOfOrphanBlog:
    function (callback) {
      articleModule.getListOfOrphanBlog(function(err,result) {
        callback(err,result);
      })
    },
    listOfOpenBlog:
    function (callback) {
      blogModule.find({status:"open"},function(err,result) {
        if (err) return callback(err);
        var list = [];
        for (var i=0;i<result.length;i++) {
          list.push(result[i]);
        }
        callback(err,list);
      })
    },
    listOfReviewBlog:
    function (callback) {
      blogModule.find({status:"review"},function(err,result) {
        if (err) return callback(err);
        var list = [];
        for (var i=0;i<result.length;i++) {
          list.push(result[i]);
        }
        callback(err,list);
      })
    }},
  
    function (err,result) {
      if (err) return next(err);
      if (!(res.rendervar) || typeof(res.rendervar)=='undefined') res.rendervar = {};
      res.rendervar.layout = {user:req.user,
                      listOfOrphanBlog:result.listOfOrphanBlog,
                      htmlroot: htmlRoot,
                      listOfOpenBlog:result.listOfOpenBlog,
                      listOfReviewBlog:result.listOfReviewBlog,
                      moment:moment,
                      util:util,
                    }
      next();
    }
  );
}



// Export Render Functions for testing purposes
exports.prepareRenderLayout = prepareRenderLayout;



// And configure router to set the prepare Function
router.get('/:module', exports.prepareRenderLayout);
router.get('/:module/:subparam', exports.prepareRenderLayout);
router.get('/:module/:subparam/:detailparam', exports.prepareRenderLayout);



module.exports.router = router;


