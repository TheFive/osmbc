"use strict";

var express  = require('express');
var async    = require('async');
var moment   = require('moment-timezone');
var router   = express.Router();
var debug    = require('debug')('OSMBC:routes:layout');

var util          = require('../util.js');
var config        = require('../config.js');
var version = require('../version.js');
var markdown = require('markdown-it')();

var articleModule = require('../model/article.js');
var blogModule    = require('../model/blog.js');

var htmlRoot = config.getValue("htmlroot");
var bootstrap = config.getValue("bootstrap");


function calculateUnreadMessages(list,user) {
  var result = 0;
  for (let k=0;k<list.length;k++) {
    let a = list[k];
    if (a.commentRead && a.commentRead[user]>= a.commentList.length-1) continue;
    result +=1;
  }
  return result;
}


function prepareRenderLayout(req,res,next) {
  debug('prepareRenderLayout');




  // Variables for rendering purposes

  // ListOfOrphanBlog is used to show all orphanedBlog to assign an article to
  var style = "style.css";
  if (req.query.tempstyleOff == 'true') req.session.tempstyle=true;
  if (req.query.tempstyleOff == 'false') delete req.session.tempstyle;
  if (!req.session.tempstyle && config.getValue("style")) style = config.getValue("style");



  var languages = [];
  if (config.getLanguages()) languages = config.getLanguages();

 
  var userMentions = 0;
  var mainLangMentions = 0;
  var secondLangMentions = 0;
  var usedLanguages = {};
  usedLanguages[req.user.language]=true;

  // Used for display changes

  // Params is used for indicating Edit

  async.auto({
    
    listOfOrphanBlog:
    function (callback) {
      articleModule.getListOfOrphanBlog(function(err,result) {
        callback(err,result);
      });
    },
    tbc:function (callback) {
      let blog = blogModule.getTBC();
      blog.calculateDerived(req.user,function(err){
        if (err) return callback(err);
        callback(null,blog);
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
          item.calculateDerived(req.user,function(err){
            if (err) return cb(err);
            userMentions += calculateUnreadMessages(item._userMention,req.user.OSMUser);
            mainLangMentions += calculateUnreadMessages(item._mainLangMention,req.user.OSMUser);
            secondLangMentions += calculateUnreadMessages(item._secondLangMention,req.user.OSMUser);
            for (let k in item._usedLanguages) usedLanguages[k]=true;
            cb();
          });
        },function(err){
          callback(err,list);
        });
      });
    },
    editBlog:function (callback) {
      blogModule.find({status:"edit"},function(err,list) {
        if (err) return callback(err);
        async.each(list,function(item,cb){
          item.calculateDerived(req.user,function(err){
            if (err) return cb(err);
            for (let k in item._usedLanguages) usedLanguages[k]=true;
            cb();
          });
        },function(err){callback(err,list);});
      });
    },
    listOfEditBlog:["editBlog",
      function (callback,param) {
        var list = [];
        for (let i=0;i<param.editBlog.length;i++) {
          if (!(param.editBlog[i]["reviewComment"+req.user.getMainLang()])) {
            list.push(param.editBlog[i]);
          }
        }
        for (let i=0; i<list.length;i++) {
          let item = list[i];
          userMentions += calculateUnreadMessages(item._userMention,req.user.OSMUser);
          mainLangMentions += calculateUnreadMessages(item._mainLangMention,req.user.OSMUser);
          secondLangMentions += calculateUnreadMessages(item._secondLangMention,req.user.OSMUser);
        }

        callback(null,list);
    }],
    listOfReviewBlog:["editBlog",
        function (callback,param) {
          var list = [];
          for (let i=0;i<param.editBlog.length;i++) {
            if ((param.editBlog[i]["reviewComment"+req.user.getMainLang()]) &&
              !(param.editBlog[i]["close"+req.user.getMainLang()])) {
              list.push(param.editBlog[i]);
            }
          }
          for (let i=0; i<list.length;i++) {
            let item = list[i];
            userMentions += calculateUnreadMessages(item._userMention,req.user.OSMUser);
            mainLangMentions += calculateUnreadMessages(item._mainLangMention,req.user.OSMUser);
            secondLangMentions += calculateUnreadMessages(item._secondLangMention,req.user.OSMUser);
          }

          callback(null,list);
        }]
    },

    function (err,result) {
      if (err) return next(err);
      if (!(res.rendervar) || typeof(res.rendervar)=='undefined') res.rendervar = {};
      res.rendervar.layout = {user:req.user,
                      listOfOrphanBlog:result.listOfOrphanBlog,
                      htmlroot: htmlRoot,
                      languages:languages,
                      markdown:markdown,
                      userMentions:userMentions,
                      mainLangMentions:mainLangMentions,
                      secondLangMentions:secondLangMentions,
                      language:req.user.getMainLang(),
                      language2:req.user.getSecondLang(),
                      listOfOpenBlog:result.listOfOpenBlog,
                      listOfEditBlog:result.listOfEditBlog,
                      listOfReviewBlog:result.listOfReviewBlog,
                      listOfHelpBlog:result.listOfHelpBlog,
                      tbc:result.tbc,
                      moment:moment,
                      util:util,
                      usedLanguages:usedLanguages,
                      appName:config.getValue("AppName"),
                      bootstrap:bootstrap,
                      osmbc_version:version.osmbc_version,
                      style:style,
                      title:config.getValue("AppName"),
                      md_render:util.md_render
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


