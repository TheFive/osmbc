var debug = require('debug')('OSMBC:routes:tool');
var express = require('express');
var router = express.Router();
var config = require('../config.js');
var url = require('url');
var http = require('http');
var https = require('https');

var parseEvent = require('../model/parseEvent.js');

var articleModule = require('../model/article.js');

var licenses = require("../data/licenses.js");

var sizeOf = require('image-size');




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

function generateCCLicense(license,lang,author){
  debug("generateCCLicense");
  if (!license || license == "") license = "CC0"
  if (!lang || lang == "") lang = "EN";
  if (!author) author = "";  
  console.log(license);
  console.dir(licenses);
  var text = licenses[license][lang];
  if (typeof(text)=="undefined") text = licenses[license].EN;
  return text.replace("##author##",author);
} 

function renderPictureTool(req,res,next) {
  debug('renderPictureTool');

  var pictureLanguage = "DE";
  var pictureURL = "";
  var pictureMarkup = "";
  var pictureAText = "";
  var pictureLicense = "CC0";
  var pictureAuthor = "[Author Name](LINK)";
  var sessionData = req.session.pictureTool;
  
  if (sessionData) {
    pictureLanguage = sessionData.pictureLanguage;
    pictureURL = sessionData.pictureURL;
    if (!pictureURL) pictureURL ="";
    pictureMarkup = sessionData.pictureMarkup;
    pictureAText = sessionData.pictureAText;
    pictureLicense = sessionData.pictureLicense;
    pictureAuthor = sessionData.pictureAuthor;
  }

  var warning =[];


  var options = url.parse(pictureURL);
  
  var p = http;
  if (pictureURL.substring(0,5)=="https") p = https;

  var chunks = [];
  var request = p.get(options,function (req){
    console.log("http.get");
    req.on('data', function (chunk) {
      console.log("data");
      chunks.push(chunk);
    });
    req.on('end', function() {
      console.log("end");
      var buffer = Buffer.concat(chunks);
      var sizeX = 100;
      var sizeY = 100;
      try {
        var sizeX = sizeOf(buffer).width;
        var sizeY = sizeOf(buffer).height;
      } catch (err) {
        warning.push(err);
      }
      if (sizeX < 700) warning.push("Picture width lower than 700 pixel, check resulting quality.");
      if (sizeY > 900) warning.push("Picture width bigger than 900 pixel, please reduce size.");
      if (pictureURL.indexOf("blog.openstreetmap.de")<0) warning.push("Picture not hosted on blog.openstreetmap.de");
      var genMarkup="";

      sizeY = Math.round(sizeY * 800 / sizeX);
      sizeX = 800; 
      genMarkup = "!["+pictureAText+"]("+pictureURL+ " ="+sizeX+"x"+sizeY+")\n";
      if (pictureLanguage=="DE") {
         genMarkup += "\n"
      }
      genMarkup += pictureMarkup;

      genMarkup += " | "+generateCCLicense(pictureLicense,pictureLanguage,pictureAuthor);
      var article = articleModule.create();
      article["markdown"+pictureLanguage]=genMarkup;
      article.categoryEN = "Picture";
      var preview = article.getPreview(pictureLanguage);
      res.render('pictureTool',{warning:warning,
                                genMarkup:genMarkup,
                                licenses:licenses,
                                preview:preview,
                                pictureLanguage:pictureLanguage,
                                pictureURL:pictureURL,
                                pictureMarkup:pictureMarkup,
                                pictureAText:pictureAText,
                                pictureAuthor:pictureAuthor,
                                pictureLicense:pictureLicense,
                                layout:res.rendervar.layout});  
    });
  });
  


  request.on('error',function(err) {
    console.log("error");
    warning.push(">"+pictureURL+"< pictureURL not found")
   
    res.render('pictureTool',{genMarkup:"picture not found",
                              warning:warning,
                              preview:"<p> Error,please try again</p>",
                              pictureLanguage:pictureLanguage,
                              pictureURL:pictureURL,
                              pictureMarkup:pictureMarkup,
                              licenses:licenses,
                              pictureAText:pictureAText,
                              pictureLicense:pictureLicense,
                              pictureAuthor:pictureAuthor,
                              layout:res.rendervar.layout});  

  })
  request.end();

}
function postPictureTool(req,res,next) { //jshint ignore:line
  debug('postPictureTool');

  pictureLanguage = req.body.pictureLanguage;
  pictureURL = req.body.pictureURL;
  pictureMarkup = req.body.pictureMarkup;
  pictureAText = req.body.pictureAText;
  pictureLicense = req.body.pictureLicense;
  pictureAuthor = req.body.pictureAuthor;

  req.session.pictureTool = {pictureLanguage:pictureLanguage,
                              pictureURL:pictureURL,
                              pictureMarkup:pictureMarkup,
                              pictureLicense:pictureLicense,
                              pictureAuthor:pictureAuthor,
                              
                              pictureAText:pictureAText};
  res.redirect(config.getValue('htmlroot')+"/tool/picturetool");
}


router.get('/calender2markdown', renderCalenderAsMarkdown);
router.post('/calender2markdown', postCalenderAsMarkdown);
router.get('/picturetool', renderPictureTool);
router.post('/picturetool', postPictureTool);


module.exports.router = router;
