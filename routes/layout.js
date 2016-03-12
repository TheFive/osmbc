"use strict";

var express  = require('express');
var async    = require('async');
var moment   = require('moment-timezone');
var router   = express.Router();
var debug    = require('debug')('OSMBC:routes:layout');

var util          = require('../util.js');
var config        = require('../config.js');
var version = require('../version.js');

var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');

var htmlRoot = config.getValue("htmlroot");
var bootstrap = config.getValue("bootstrap");

function prepareRenderLayout(req,res,next) {
  debug('prepareRenderLayout');




  // Variables for rendering purposes

  // ListOfOrphanBlog is used to show all orphanedBlog to assign an article to
  var style = "style.css";
  if (req.query.tempstyleOff == 'true') req.session.tempstyle=true;
  if (req.query.tempstyleOff == 'false') delete req.session.tempstyle;
  if (!req.session.tempstyle && config.getValue("style")) style = config.getValue("style");

  // default the main language to EN
  if (!req.session.language) req.session.language="EN";


  var languages = [];
  if (config.getLanguages()) languages = config.getLanguages();

 

  // Used for display changes

  // Params is used for indicating Edit

  async.auto({
    
    listOfOrphanBlog:
    function (callback) {
      articleModule.getListOfOrphanBlog(function(err,result) {
        callback(err,result);
      });
    },
    listOfOpenBlog:
    function (callback) {
      blogModule.find({status:"open"},function(err,result) {
        if (err) return callback(err);
        var list = [];
        for (var i=0;i<result.length;i++) {
          list.push(result[i]);
        }
        async.each(list,function(item,cb){
          item.countUneditedMarkdown(cb);
        },function(err){callback(err,list);});
      });
    },
    listOfEditBlog:
    function (callback) {
      blogModule.find({status:"edit"},function(err,result) {
        if (err) return callback(err);
        var list = [];
        for (var i=0;i<result.length;i++) {
          if (!(result[i]["reviewComment"+req.session.language])) {
            list.push(result[i]);
          }
        }
        async.each(list,function(item,cb){
          item.countUneditedMarkdown(cb);
        },function(err){callback(err,list);});
      });
    },
    listOfReviewBlog:
    function (callback) {
      blogModule.find({status:"edit"},function(err,result) {
        if (err) return callback(err);
        var list = [];
        for (var i=0;i<result.length;i++) {
          if ((result[i]["reviewComment"+req.session.language]) &&
              !(result[i]["close"+req.session.language])) {
            list.push(result[i]);
          }
        }
        async.each(list,function(item,cb){
          item.countUneditedMarkdown(cb);
        },function(err){callback(err,list);});
      });
    }
  },
  
    function (err,result) {
      if (err) return next(err);
      if (!(res.rendervar) || typeof(res.rendervar)=='undefined') res.rendervar = {};
      res.rendervar.layout = {user:req.user,
                      listOfOrphanBlog:result.listOfOrphanBlog,
                      htmlroot: htmlRoot,
                      languages:languages,
                      language:req.session.language,
                      language2:req.session.language2,
                      listOfOpenBlog:result.listOfOpenBlog,
                      listOfEditBlog:result.listOfEditBlog,
                      listOfReviewBlog:result.listOfReviewBlog,
                      listOfHelpBlog:result.listOfHelpBlog,
                      moment:moment,
                      util:util,
                      appName:config.getValue("AppName"),
                      bootstrap:bootstrap,
                      osmbc_version:version.osmbc_version,
                      style:style
                    };
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


