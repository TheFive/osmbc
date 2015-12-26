var debug = require('debug')('OSMBC:routes:tool');
var express = require('express');
var router = express.Router();
var config = require('../config.js');

var parseEvent = require('../model/parseEvent.js');

/* GET home page. */


function renderCalenderAsMarkdown(req,res,next) {
  debug('renderCalenderAsMarkdown');

  var disablePrettify = false;
  var calenderLanguage = "DE";
  var sessionData = req.session.calenderTool;
  if (sessionData) {
    disablePrettify = sessionData.disablePrettify;
    calenderLanguage = sessionData.calenderLanguage;
  }


  parseEvent.calenderToMarkdown(calenderLanguage,function(err,result){
    if (err) return next(err);
    res.render('calenderAsMarkdown',{calenderAsMarkdown:result,
                                disablePrettify:disablePrettify,
                                calenderLanguage:calenderLanguage,
                                layout:res.rendervar.layout});  

  });
}
function postCalenderAsMarkdown(req,res,next) { //jshint ignore:line
  debug('postCalenderAsMarkdown');
  console.dir(req.body);
  var disablePrettify = (req.body.disablePrettify=="true");
  var calenderLanguage = req.body.calenderLanguage;
  req.session.calenderTool = {disablePrettify:disablePrettify,calenderLanguage:calenderLanguage};
  console.dir(req.session);
  res.redirect(config.getValue('htmlroot')+"/tool/calender2markdown");
}


router.get('/calender2markdown', renderCalenderAsMarkdown);
router.post('/calender2markdown', postCalenderAsMarkdown);


module.exports.router = router;
