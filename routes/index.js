"use strict";

var should = require('should');
var debug = require('debug')('OSMBC:routes:index');
var express = require('express');
var router = express.Router();
var help = require('../routes/help.js');
var config = require('../config.js');
var logModule = require('../model/logModule.js');

/* GET home page. */

function renderHome(req,res,next) {
  debug('renderHome');
  should.exist(res.rendervar.layout);

  logModule.find({table:"IN('blog','article','usert')"},{column:"id",desc :true,limit:20},function(err,result) {
    if (err) return next(err);
  
    res.render('index', { title: 'OSMBC' , 
                          layout:res.rendervar.layout,
                          changes:result});  
  });
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


function renderHelp(req,res) {
  debug('help');
  should.exist(res.rendervar.layout);
  var title = req.params.title;
  var text = help.getText("menu."+title+".md");
  res.render('help',{layout:res.rendervar.layout,text:text});
}
function renderChangelog(req,res,next) {
  debug('renderChangelog');
  should.exist(res.rendervar.layout);
  var text = help.getText("CHANGELOG.md");
  req.user.lastChangeLogView = res.rendervar.layout.osmbc_version;
  req.user.save(function(err){
    if (err) return next(err);
    res.render('help',{layout:res.rendervar.layout,text:text});
  });
}

router.get('/', renderHome);
router.get('/osmbc.html', renderHome);
router.get('/osmbc', renderHome);
router.get('/help/:title', renderHelp);
router.get('/changelog', renderChangelog);
router.get('/language',languageSwitcher);



module.exports.router = router;
module.exports.renderHome = renderHome;
