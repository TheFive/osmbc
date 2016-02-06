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

function languageSwitcher(req,res,next) { //jshint ignore:line
  debug('languageSwitcher');
  var lang = req.query.lang;
  var lang2 = req.query.lang2;
  console.dir(req.query);
  if (config.getLanguages().indexOf(lang)>=0) {
    req.session.language = lang;
  }
  if (config.getLanguages().indexOf(lang2)>=0) {
    req.session.language2 = lang2;
  }
  if (lang2==="none") {req.session.language2=null;}
  console.dir(req.session);
  res.redirect(req.get('referer'));
}

function renderReleaseNotes(req,res,next) {  // jshint ignore:line
  debug('renderReleaseNotes');
  var level = req.query.level;
  should.exist(res.rendervar.layout);
  res.render('release_notes',{level:level,
                              layout:res.rendervar.layout});  
}
function renderHelp(req,res,next) { // jshint ignore:line
  debug('help');
  should.exist(res.rendervar.layout);
  var title = req.params.title;
  var text = help.getText("menu."+title+".md");
  res.render('help',{layout:res.rendervar.layout,text:text});  
}

router.get('/', renderHome);
router.get('/osmbc.html', renderHome);
router.get('/osmbc', renderHome);
router.get('/release_notes.html', renderReleaseNotes);
router.get('/help/:title', renderHelp);
router.get('/language',languageSwitcher);



module.exports.router = router;
module.exports.renderHome = renderHome;
