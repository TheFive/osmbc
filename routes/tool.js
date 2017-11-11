"use strict";

var debug = require("debug")("OSMBC:routes:tool");
var express = require("express");
var router = express.Router();
var publicRouter = express.Router();
var config = require("../config.js");
var url = require("url");
var http = require("http");
var https = require("https");
var moment = require("moment");
var async = require("async");
var request = require("request");
var BlogRenderer = require("../render/BlogRenderer.js");


var parseEvent = require("../model/parseEvent.js");

var articleModule = require("../model/article.js");
var configModule = require("../model/config.js");


const auth        = require("../routes/auth.js");

var sizeOf = require("image-size");

let htmlroot = config.htmlRoot();
let osmbcDateFormat = config.getValue("CalendarDateFormat", {mustExist: true});



function renderCalendarAsMarkdown(req, res, next) {
  debug("renderCalendarAsMarkdown");

  var disablePrettify = false;
  var useGeoNames = false;
  var countries = "";
  var enableCountryFlags = false;
  var date = "";
  var duration = "";
  var sessionData = req.session.calendarTool;

  if (sessionData) {
    disablePrettify = sessionData.disablePrettify;
    enableCountryFlags = sessionData.enableCountryFlags;
    date = sessionData.date;

    duration = sessionData.duration;
    if (sessionData.countries) countries = sessionData.countries;
    if (sessionData.useGeoNames) useGeoNames = sessionData.useGeoNames;
  }

  parseEvent.calendarToMarkdown(
    {lang: req.user.getMainLang(),
      enableCountryFlags: enableCountryFlags,
      duration: duration,
      countries: countries,
      date: date,
      useGeoNames: useGeoNames}, function(err, result, errors) {
      if (err) return next(err);
      res.set("content-type", "text/html");
      res.render("calendarAsMarkdown", {calendarAsMarkdown: result,
        disablePrettify: disablePrettify,
        useGeoNames: useGeoNames,
        enableCountryFlags: enableCountryFlags,
        date: date,
        countries: countries,
        duration: duration,
        errors: errors,
        layout: res.rendervar.layout});
    });
}

function eventDateFormat(e, lang) {
  var sd = moment(e.startDate);
  var ed = moment(e.endDate);
  var dateString = "";
  sd.locale(config.moment_locale(lang));
  ed.locale(config.moment_locale(lang));

  if (e.startDate) {
    dateString = sd.format(osmbcDateFormat);
  }
  if (e.endDate) {
    if ((e.startDate.getTime() !== e.endDate.getTime())) {
      dateString = sd.format(osmbcDateFormat) + "-" + ed.format(osmbcDateFormat);
    }
  }
  return dateString;
}

function flag(country, cf) {
  let c = country.toLowerCase();
  if (cf[c]) return "<img src='" + cf[c] + "'></img>";
  return country;
}

function renderCalendarAllLang(req, res, next) {
  debug("renderCalendarAllLang");
  let eventsfilter = configModule.getConfig("eventsfilter");
  let calendarFlags = configModule.getConfig("calendarflags");
  let languages = res.rendervar.layout.activeLanguages;
  let events = {};
  let markdown = {};
  parseEvent.calendarToJSON({}, function(err, result) {
    if (err) return next(err);
    result.discontinue = true;
    result.serviceProvider = "OSMBC";
    renderEvents(result, req, res, next);
  });
}

let alternativeCalendarData = config.getValue("CalendarInterface", {mustExist: true});

function renderCalendarAllLangAlternative(req, res, next) {
  debug("renderCalendarAllLang");

  let par = req.params.calendar;

  let cc = alternativeCalendarData[par];

  var options = {
    url: cc.url,
    method: "GET",
    json: true
  };
  let result = {events: []};
  request(options, function(error, response, body) {
    if (error) return next(error);
    if (response.statusCode !== 200) {
      return next(Error("url: " + cc.url + " returns:\n" + body));
    }
    if (!body[cc.events]) return next("Missing events in calendar data");
    body[cc.events].forEach(function modifyItem(item) {
      let i = {};
      i.desc = item[cc.desc];
      i.startDate = new Date(item[cc.startDate]);
      i.endDate = new Date(item[cc.endDate]);
      i.text = item[cc.text];
      i.markdown = item[cc.markdown];
      i.big = item[cc.big];
      i.country = item[cc.country];
      i.town = item[cc.town];
      result.events.push(i);
    });
    result.error = "no information";
    result.discontinue = false;
    result.timestamp = "unknown";
    result.refreshurl = false;
    if (cc.refreshurl) result.refreshurl = true;
    if (cc.timestamp) result.timestamp = body[cc.timestamp];
    result.serviceProvider = par;
    renderEvents(result, req, res, next);
  });
}

function renderCalendarRefresh(req, res, next) {
  debug("renderCalendarAllLang");

  let par = req.params.calendar;

  let cc = alternativeCalendarData[par];

  if (!cc.refreshurl) return next(new Error("Refreshurl missing"));

  var options = {
    url: cc.refreshurl,
    method: "GET"
  };
  request(options, function(error, response, body) {
    if (error) return next(error);
    if (response.statusCode !== 200) {
      return next(Error("url: " + cc.url + " returns:\n" + body));
    }
    );
  });
}


function postCalendarAsMarkdown(req, res, next) {
  debug("postCalendarAsMarkdown");
  var disablePrettify = (req.body.disablePrettify === "true");
  var enableCountryFlags = req.body.enableCountryFlags;
  var useGeoNames = req.body.useGeoNames;
  var duration = req.body.duration;

  var date = req.body.date;

  req.session.calendarTool = {disablePrettify: disablePrettify,
    date: date,
    duration: duration,
    useGeoNames: useGeoNames,
    enableCountryFlags: enableCountryFlags};
  req.session.save(function(err) {
    if (err) return next(err);
    res.redirect(htmlroot + "/tool/calendar2markdown");
  });
}

function generateCCLicense(license, lang, author) {
  debug("generateCCLicense");
  var licenses = configModule.getConfig("licenses");
  if (!license || license === "") license = "CC0";
  if (!lang || lang === "") lang = "EN";
  if (!author) author = "";
  if (typeof (licenses[license]) === "undefined") license = "CC0";
  var text = licenses[license][lang];
  if (typeof (text) === "undefined") text = licenses[license].EN;
  if (typeof (text) === "undefined") text = "";

  return text.replace("##author##", author);
}

function renderPictureTool(req, res) {
  debug("renderPictureTool");

  var pictureLanguage = "DE";
  var pictureURL = "http://blog.openstreetmap.de/wp-content/themes/osmblog/images/headers/blog.png";
  var pictureMarkup = "Some cool markdown text with [^1^](#blog_article) superscript";
  var pictureAText = "Logo";
  var pictureLicense = "CC3";
  var pictureAuthor = "[Author Name](LINK)";
  var sessionData = req.session.pictureTool;

  if (sessionData) {
    if (sessionData.pictureLanguage) pictureLanguage = sessionData.pictureLanguage;
    pictureURL = sessionData.pictureURL;
    if (!pictureURL) pictureURL = "";
    pictureMarkup = sessionData.pictureMarkup;
    pictureAText = sessionData.pictureAText;
    pictureLicense = sessionData.pictureLicense;
    pictureAuthor = sessionData.pictureAuthor;
  }

  var warning = [];


  var options = url.parse(pictureURL);

  var p = http;
  if (pictureURL.substring(0, 5) === "https") p = https;

  var chunks = [];
  var request = p.get(options, function (req) {
    req.on("data", function (chunk) {
      chunks.push(chunk);
    });
    req.on("end", function() {
      var buffer = Buffer.concat(chunks);
      var sizeX = 100;
      var sizeY = 100;
      try {
        sizeX = sizeOf(buffer).width;
        sizeY = sizeOf(buffer).height;
      } catch (err) {
        warning.push(err);
      }
      if (sizeX < 700) warning.push("Picture width lower than 700 pixel, check resulting quality.");
      if (sizeY > 900) warning.push("Picture width bigger than 900 pixel, please reduce size.");
      if (pictureURL.indexOf("blog.openstreetmap.de") < 0) warning.push("Picture not hosted on blog.openstreetmap.de");
      var genMarkup = "";

      sizeY = Math.round(sizeY * 800 / sizeX);
      sizeX = 800;
      genMarkup = "![" + pictureAText + "](" + pictureURL + " =" + sizeX + "x" + sizeY + ")\n";
      if (pictureLanguage === "DE") {
        genMarkup += "\n";
      }
      genMarkup += pictureMarkup;
      var ltext = generateCCLicense(pictureLicense, pictureLanguage, pictureAuthor);
      if (ltext !== "") genMarkup += " | " + ltext;

      var article = articleModule.create();
      article["markdown" + pictureLanguage] = genMarkup;
      article.categoryEN = "Picture";
      let renderer = new BlogRenderer.HtmlRenderer(null);
      var preview = renderer.renderArticle(pictureLanguage, article);
      var licenses = configModule.getConfig("licenses");
      res.set("content-type", "text/html");
      res.render("pictureTool", {warning: warning,
        genMarkup: genMarkup,
        licenses: licenses,
        preview: preview,
        pictureLanguage: pictureLanguage,
        pictureURL: pictureURL,
        pictureMarkup: pictureMarkup,
        pictureAText: pictureAText,
        pictureAuthor: pictureAuthor,
        pictureLicense: pictureLicense,
        layout: res.rendervar.layout});
    });
  });



  request.on("error", function() {
    warning.push(">" + pictureURL + "< pictureURL not found");
    var licenses = configModule.getConfig("licenses");
    res.set("content-type", "text/html");
    res.render("pictureTool", {genMarkup: "picture not found",
      warning: warning,
      preview: "<p> Error,please try again</p>",
      pictureLanguage: pictureLanguage,
      pictureURL: pictureURL,
      pictureMarkup: pictureMarkup,
      licenses: licenses,
      pictureAText: pictureAText,
      pictureLicense: pictureLicense,
      pictureAuthor: pictureAuthor,
      layout: res.rendervar.layout});
  });
  request.end();
}
function postPictureTool(req, res, next) {
  debug("postPictureTool");

  var pictureLanguage = req.body.pictureLanguage;
  var pictureURL = req.body.pictureURL;
  var pictureMarkup = req.body.pictureMarkup;
  var pictureAText = req.body.pictureAText;
  var pictureLicense = req.body.pictureLicense;
  var pictureAuthor = req.body.pictureAuthor;

  req.session.pictureTool = {pictureLanguage: pictureLanguage,
    pictureURL: pictureURL,
    pictureMarkup: pictureMarkup,
    pictureLicense: pictureLicense,
    pictureAuthor: pictureAuthor,

    pictureAText: pictureAText};
  req.session.save(function(err) {
    if (err) return next(err);
    res.redirect(htmlroot + "/tool/picturetool");
  });
}

let publicCalendarPage = config.getValue("PublicCalendarPage", {mustExist: true});

function renderPublicCalendar(req, res, next) {
  debug("renderPublicCalendar");
  request.get({url: publicCalendarPage}, function(err, response, body) {
    if (err) return next(err);
    if (response.statusCode !== 200) return next(new Error("Public Calendar returned status " + response.statusCode));
    res.send(body);
  });
}

router.get("/calendar2markdown", auth.checkRole("full"), renderCalendarAsMarkdown);
router.post("/calendar2markdown", auth.checkRole("full"), postCalendarAsMarkdown);
router.get("/calendarAllLang", auth.checkRole("full"), renderCalendarAllLang);
router.get("/picturetool", auth.checkRole("full"), renderPictureTool);
router.post("/picturetool", auth.checkRole("full"), postPictureTool);

publicRouter.get("/calendar/preview", renderPublicCalendar);

module.exports.router = router;
module.exports.publicRouter = publicRouter;
