"use strict";

var should = require("should");
var debug = require("debug")("OSMBC:routes:index");
var express = require("express");
var async = require("async");
var router = express.Router();
var help = require("../routes/help.js");
var config = require("../config.js");
var logModule = require("../model/logModule.js");
var userModule = require("../model/user.js");
var db = require("../model/db.js");
var moment = require("moment");




let appName = config.getValue("AppName", {mustExist: true});
/* GET home page. */

function renderHome(req, res, next) {
  debug("renderHome");
  should.exist(res.rendervar.layout);
  var date = new Date();
  date.setTime(date.getTime() - 1000 * 60 * 10);

  var todayStart = new Date();
  todayStart.setHours(0);
  todayStart.setMinutes(0);
  todayStart.setSeconds(0);

  async.auto({
    "historie": logModule.find.bind(logModule, {table: "IN('blog','article')"}, {column: "id", desc: true, limit: 20}),
    "activeUser": userModule.find.bind(userModule, {lastAccess: ">" + date.toISOString()}, {column: "lastAccess", desc: true}),
    "visitorsToday": userModule.find.bind(userModule, {lastAccess: ">" + todayStart.toISOString()}, {column: "OSMUser", desc: false}),
    "newUsers": userModule.getNewUsers.bind(userModule)
  }, function(err, result) {
    if (err) return next(err);
    res.set("content-type", "text/html");
    res.render("index", { title: appName,
      layout: res.rendervar.layout,
      activeUserList: result.activeUser,
      visitorsToday: result.visitorsToday,
      newUsers: result.newUsers,
      changes: result.historie});
  }
  );
}

let userIsOldInDays = config.getValue("userIsOldInDays", {mustExist: true});

function renderAdminHome(req, res, next) {
  debug("renderAdminHome");
  should.exist(res.rendervar.layout);
  let date = new moment();
  date = date.subtract(userIsOldInDays, "Days").toISOString();


  async.auto({
    "historie": logModule.find.bind(logModule, {table: "IN('usert','config')"}, {column: "id", desc: true, limit: 20}),
    "longAbsent": userModule.find.bind(userModule, {lastAccess: "<" + date, access: "full"})
  }, function(err, result) {
    if (err) return next(err);
    res.set("content-type", "text/html");
    res.render("adminindex", { title: appName,
      layout: res.rendervar.layout,
      longAbsent: result.longAbsent,
      changes: result.historie});
  }
  );
}

function renderLongRunningQueries(req, res) {
  debug("renderLongRunningQueries");
  res.set("content-type", "text");
  let result = "No Data";
  if (db.longRunningQueries) result = JSON.stringify(db.longRunningQueries, null, 3);
  res.end(result);
}

function languageSwitcher(req, res, next) {
  debug("languageSwitcher");

  var lang = [req.user.getMainLang(), req.user.getSecondLang(), req.user.getLang3(), req.user.getLang4()];

  if (req.query.lang) lang[0] = req.query.lang;
  if (req.query.lang2) lang[1] = req.query.lang2;
  if (req.query.lang3) lang[2] = req.query.lang3;
  if (req.query.lang4) lang[3] = req.query.lang4;


  for (let v = 0; v < lang.length - 1; v++) {
    for (let i = v + 1; i < lang.length; i++) {
      while (i < lang.length && lang[v] === lang[i]) {
        lang.splice(i, 1);
      }
    }
  }




  if (config.getLanguages().indexOf(lang[0]) >= 0) {
    req.user.mainLang = lang[0];
  }
  if (lang.length >= 2 && config.getLanguages().indexOf(lang[1]) >= 0) {
    req.user.secondLang = lang[1];
  } else {
    req.user.secondLang = null;
    req.user.lang3 = null;
    req.user.lang4 = null;
  }
  if (lang.length >= 3 && config.getLanguages().indexOf(lang[2]) >= 0) {
    req.user.lang3 = lang[2];
  } else {
    req.user.lang3 = null;
    req.user.lang4 = null;
  }
  if (lang.length >= 4 && config.getLanguages().indexOf(lang[3]) >= 0) {
    req.user.lang4 = lang[3];
  } else {
    req.user.lang4 = null;
  }


  req.user.save(function finalLanguageSwitcher(err) {
    if (err) return next(err);
    var referer = req.get("referer");
    if (referer) res.redirect(referer); else res.end("changed");
  });
}

function setUserConfig(req, res, next) {
  debug("setUserConfig");

  var user = req.user;
  if (!req.query.view) return next(new Error("missing view in option"));
  if (!req.query.option) return next(new Error("missing option in option"));
  if (!req.query.value) return next(new Error("missing value in option"));

  user.setOption(req.query.view, req.query.option, req.query.value);

  req.user.save(function finalLanguageSwitcher(err) {
    if (err) return next(err);
    var referer = req.get("referer");
    if (referer) res.redirect(referer); else res.end("changed");
  });
}

function renderHelp(req, res) {
  debug("help");
  should.exist(res.rendervar.layout);
  var title = req.params.title;
  var text = help.getText("menu." + title + ".md");
  res.set("content-type", "text/html");
  res.render("help", {layout: res.rendervar.layout, text: text});
}
function createBlog(req, res) {
  debug("createBlog");
  should.exist(res.rendervar.layout);
  res.render("createblog", {layout: res.rendervar.layout});
}


function renderChangelog(req, res, next) {
  debug("renderChangelog");
  should.exist(res.rendervar.layout);
  var text = help.getText("CHANGELOG.md");
  req.user.lastChangeLogView = res.rendervar.layout.osmbc_version;
  req.user.save(function(err) {
    if (err) return next(err);
    res.set("content-type", "text/html");
    res.render("help", {layout: res.rendervar.layout, text: text});
  });
}

var htmlRoot = config.getValue("htmlroot",{mustExist:true});

function redirectHome(req,res) {
  res.redirect(htmlRoot +"/");
}

router.get("/", renderHome);
router.get("/osmbc.html", redirectHome);
router.get("/osmbc", redirectHome);
router.get("/osmbc/sql/longRunningQueries", renderLongRunningQueries);
router.get("/osmbc/admin", renderAdminHome);
router.get("/help/:title", renderHelp);
router.get("/changelog", renderChangelog);
router.get("/language", languageSwitcher);
router.get("/userconfig", setUserConfig);
router.get("/createblog", createBlog);



module.exports.router = router;
