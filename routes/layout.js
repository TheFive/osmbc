"use strict";

const express       = require("express");
const async         = require("async");
const moment        = require("moment-timezone");
const router        = express.Router();
const debug         = require("debug")("OSMBC:routes:layout");

const util          = require("../util/util.js");
const config        = require("../config.js");
const language      = require("../model/language.js");

const version       = require("../version.js");
const markdown      = require("markdown-it")();

const blogModule    = require("../model/blog.js");
const userModule    = require("../model/user.js");

const htmlRoot      = config.htmlRoot();
const appName       = config.getValue("AppName", { mustExist: true });



const url = config.getValue("url");

function calculateUnreadMessages(list, user) {
  let result = 0;
  for (let k = 0; k < list.length; k++) {
    const a = list[k];
    if (a.commentRead && a.commentRead[user] >= a.commentList.length - 1) continue;
    result += 1;
  }
  return result;
}

const layoutConst = {
  htmlroot: htmlRoot,
  url: url,
  moment: moment,
  markdown: markdown,
  util: util,
  appName: appName,
  osmbc_version: version.osmbc_version,
  title: appName,
  auth: config.getValue("auth", { mustExist: true })
};




function prepareRenderLayout(req, res, next) {
  debug("prepareRenderLayout");




  // Variables for rendering purposes

  let style = "/stylesheets/style.css";
  if (req.query.tempstyleOff === "true") req.session.tempstyle = true;
  if (req.query.tempstyleOff === "false") delete req.session.tempstyle;
  if (!req.session.tempstyle && config.getValue("style")) style = config.getValue("style");




  const languages = language.getLid();


  let userMentions = 0;
  let mainLangMentions = 0;
  let secondLangMentions = 0;
  const usedLanguages = {};
  if (req.user.language) usedLanguages[req.user.language] = true;

  async.auto({

    tbc: function (callback) {
      const blog = blogModule.getTBC();
      blog.calculateDerived(req.user, function(err) {
        if (err) return callback(err);
        callback(null, blog);
      });
    },
    listOfOpenBlog:
    function (callback) {
      blogModule.find({ status: "open" }, function(err, result) {
        if (err) return callback(err);
        const list = [];
        for (let i = 0; i < result.length; i++) {
          list.push(result[i]);
        }
        async.each(list, function(item, cb) {
          item.calculateDerived(req.user, function(err) {
            if (err) return cb(err);
            userMentions += calculateUnreadMessages(item._userMention, req.user.OSMUser);
            mainLangMentions += calculateUnreadMessages(item._mainLangMention, req.user.OSMUser);
            secondLangMentions += calculateUnreadMessages(item._secondLangMention, req.user.OSMUser);
            for (const k in item._usedLanguages) usedLanguages[k] = true;
            cb();
          });
        }, function(err) {
          callback(err, list);
        });
      });
    },
    editBlog: function (callback) {
      blogModule.find({ status: "edit" }, function(err, list) {
        if (err) return callback(err);
        async.each(list, function(item, cb) {
          item.calculateDerived(req.user, function(err) {
            if (err) return cb(err);
            for (const k in item._usedLanguages) usedLanguages[k] = true;
            cb();
          });
        }, function(err) { callback(err, list); });
      });
    },
    listOfEditBlog: ["editBlog",
      function (param, callback) {
        const list = [];
        for (let i = 0; i < param.editBlog.length; i++) {
          if (!(param.editBlog[i]["reviewComment" + req.user.getMainLang()])) {
            list.push(param.editBlog[i]);
          }
        }
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          userMentions += calculateUnreadMessages(item._userMention, req.user.OSMUser);
          mainLangMentions += calculateUnreadMessages(item._mainLangMention, req.user.OSMUser);
          secondLangMentions += calculateUnreadMessages(item._secondLangMention, req.user.OSMUser);
        }

        callback(null, list);
      }],
    listOfReviewBlog: ["editBlog",
      function (param, callback) {
        const list = [];
        for (let i = 0; i < param.editBlog.length; i++) {
          if ((param.editBlog[i]["reviewComment" + req.user.getMainLang()]) &&
              !(param.editBlog[i]["close" + req.user.getMainLang()])) {
            list.push(param.editBlog[i]);
          }
        }
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          userMentions += calculateUnreadMessages(item._userMention, req.user.OSMUser);
          mainLangMentions += calculateUnreadMessages(item._mainLangMention, req.user.OSMUser);
          secondLangMentions += calculateUnreadMessages(item._secondLangMention, req.user.OSMUser);
        }

        callback(null, list);
      }]
  },

  function (err, result) {
    if (err) {
      debug(JSON.stringify(err));
      return next(err);
    }
    const activeLanguages = [];
    languages.forEach(function(item) {
      if (usedLanguages[item]) activeLanguages.push(item);
    });
    if (!result.editBlog) result.editBlog = [];
    if (!result.listOfOpenBlog) result.listOfOpenBlog = [];
    if (!result.listOfEditBlog) result.listOfEditBlog = [];
    if (!result.listOfReviewBlog) result.listOfReviewBlog = [];

    const scriptUser = config.getValue("scripts").user;
    const blogTranslationVisibleFor = config.getValue("blogTranslationVisibleFor");

    if (!(res.rendervar) || typeof (res.rendervar) === "undefined") res.rendervar = {};

    res.rendervar.layout = Object.assign({}, layoutConst, {
      user: req.user,
      languages: languages,
      userMentions: userMentions,
      mainLangMentions: mainLangMentions,
      secondLangMentions: secondLangMentions,
      listOfOpenBlog: result.listOfOpenBlog,
      listOfEditBlog: result.listOfEditBlog,
      listOfReviewBlog: result.listOfReviewBlog,
      editBlog: result.editBlog,
      tbc: result.tbc,
      activeLanguages: activeLanguages,
      style: style,
      user_locale: language.momentLocale((req.user.language) ? req.user.language : req.user.getMainLang()),
      language_locale: language.momentLocale(req.user.getMainLang()),
      language2_locale: language.momentLocale(req.user.getSecondLang()),
      md_render: util.md_render,
      md_renderInline: markdown.renderInline,
      getAvatar: userModule.getAvatar,
      scriptUser: scriptUser,
      blogTranslationVisibleFor: blogTranslationVisibleFor
    });
    next();
  }
  );
}



// Export Render Functions for testing purposes
exports.prepareRenderLayout = prepareRenderLayout;



// And configure router to set the prepare Function
router.get("*", exports.prepareRenderLayout);



module.exports.router = router;
module.exports.layoutConst = layoutConst;
