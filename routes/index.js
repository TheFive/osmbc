"use strict";

var should = require('should');
var debug = require('debug')('OSMBC:routes:index');
var express = require('express');
var async = require('async');
var router = express.Router();
var help = require('../routes/help.js');
var config = require('../config.js');
var logModule = require('../model/logModule.js');
var userModule = require('../model/user.js');

/* GET home page. */

function renderHome(req,res,next) {
  debug('renderHome');
  should.exist(res.rendervar.layout);
  var date = new Date();
  date.setTime(date.getTime()-1000*60*15);

  async.auto({
    "historie":logModule.find.bind(logModule,{table:"IN('blog','article')"},{column:"id",desc :true,limit:20}),
      "activeUser":userModule.find.bind(userModule,{lastAccess:">"+date.toISOString()},{column:"lastAccess",desc :true})
  },function(err,result) {
    if (err) return next(err);
    res.set('content-type', 'text/html');
    //console.log(res.get('content-type'));
    res.render('index', { title: config.getValue("AppName") ,
      layout:res.rendervar.layout,
      activeUserList:result.activeUser,
      changes:result.historie});
    }
  );
}

function renderAdminHome(req,res,next) {
  debug('renderAdminHome');
  should.exist(res.rendervar.layout);
  async.auto({
    "historie":logModule.find.bind(logModule,{table:"IN('usert','config')"},{column:"id",desc :true,limit:20})
    },function(err,result) {
      if (err) return next(err);
      res.set('content-type', 'text/html');
      res.render('adminindex', { title: config.getValue("AppName") ,
        layout:res.rendervar.layout,

        changes:result.historie});
    }
  );
}

function languageSwitcher(req,res,next) {
  debug('languageSwitcher');
  var lang = req.user.getMainLang();
  var lang2 = req.user.getSecondLang();

  if (req.query.lang) lang = req.query.lang;
  if (req.query.lang2) lang2 = req.query.lang2;

  if (lang2 === lang) lang2 = "none";

  if (config.getLanguages().indexOf(lang)>=0) {
    req.user.mainLang = lang;
  }
  if (config.getLanguages().indexOf(lang2)>=0) {
    req.user.secondLang = lang2;
  }
  if (lang2==="none") {req.user.secondLang=null;}
  req.user.save(function finalLanguageSwitcher(err){
    if (err) return next(err);
    var referer = req.get('referer');
    if (referer) res.redirect(referer); else res.end("changed");
  });
}

function setUserConfig(req,res,next) {
  debug('setUserConfig');

  var user = req.user;
  if (!req.query.view) return next(new Error("missing view in option"));
  if (!req.query.option) return next(new Error("missing option in option"));
  if (!req.query.value) return next(new Error("missing value in option"));

  user.setOption(req.query.view,req.query.option,req.query.value);

  req.user.save(function finalLanguageSwitcher(err){
    if (err) return next(err);
    var referer = req.get('referer');
    if (referer) res.redirect(referer); else res.end("changed");
  });
}

function renderHelp(req,res) {
  debug('help');
  should.exist(res.rendervar.layout);
  var title = req.params.title;
  var text = help.getText("menu."+title+".md");
  res.set('content-type', 'text/html');
  res.render('help',{layout:res.rendervar.layout,text:text});
}
function createBlog(req,res) {
  debug('createBlog');
  should.exist(res.rendervar.layout);
  res.render('createblog',{layout:res.rendervar.layout});
}


function renderChangelog(req,res,next) {
  debug('renderChangelog');
  should.exist(res.rendervar.layout);
  var text = help.getText("CHANGELOG.md");
  req.user.lastChangeLogView = res.rendervar.layout.osmbc_version;
  req.user.save(function(err){
    if (err) return next(err);
    res.set('content-type', 'text/html');
    res.render('help',{layout:res.rendervar.layout,text:text});
  });
}

router.get('/', renderHome);
router.get('/osmbc.html', renderHome);
router.get('/osmbc', renderHome);
router.get('/osmbc/admin',renderAdminHome);
router.get('/help/:title', renderHelp);
router.get('/changelog', renderChangelog);
router.get('/language',languageSwitcher);
router.get('/userconfig',setUserConfig);
router.get('/createblog',createBlog);



module.exports.router = router;
module.exports.renderHome = renderHome;
