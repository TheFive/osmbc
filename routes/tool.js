"use strict";

var debug = require("debug")("OSMBC:routes:tool");
var fs = require("fs");
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
var layoutRouter = require("../routes/layout.js");
var emailValidator = require("email-validator");
var BlogRenderer = require("../render/BlogRenderer.js");

var markdown = require("markdown-it")()
  .use(require("markdown-it-sup"))
  .use(require("markdown-it-imsize"), { autofill: true });

var parseEvent = require("../model/parseEvent.js");

var articleModule = require("../model/article.js");
var configModule = require("../model/config.js");


var sizeOf = require("image-size");

let htmlroot = config.getValue("htmlroot", {mustExist: true});
let bootstrap = config.getValue("bootstrap", {mustExist: true});
let osmbcDateFormat = config.getValue("CalendarDateFormat", {mustExist: true});

function renderPublicCalendar(req, res, next) {
  debug("renderPublicCalendar");

  var layout = {bootstrap: bootstrap, htmlRoot: htmlroot, path: layoutRouter.path};

  parseEvent.calendarToMarkdown({lang: "EN", enableCountryFlags: true, duration: "200"}, function(err, result, errors) {
    if (err) return next(err);
    var preview = markdown.render(result);
    preview = preview.replace("<table>", '<table class="table">');
    res.set("content-type", "text/html");
    res.render("calendarPublic.jade", {calendarAsMarkdown: result,
      errors: errors,
      preview: preview,
      layout: layout});
  });
}

function renderJSONCalendar(req, res, next) {
  debug("renderPublicCalendar");
  var email = req.query.email;
  if (!emailValidator.validate(email)) {
    return next(new Error("Please add your email to query. Thanks TheFive. " + email + " looks invalid."));
  }
  fs.appendFileSync("Calendarusage.log", email + " " + new Date() + "\n");

  parseEvent.calendarToJSON({}, function(err, result) {
    if (err) return next(err);

    res.json(result);
  });
}

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

function renderEvents(result, req, res, next) {
  let languages = res.rendervar.layout.activeLanguages;
  let eventsfilter = configModule.getConfig("eventsfilter");
  let calendarFlags = configModule.getConfig("calendarflags");
  let markdown = {};

  async.parallel([
    function para1(cbPara1) {
      async.each(result.events, function(event, eventsCB) {
        let allfilter = true;
        async.each(languages, function(lang, langCB) {
          parseEvent.convertGeoName(event.town, lang, function(err, name) {
            if (err) return langCB(err);
            event[lang] = {};
            event[lang].town = name;
            let filter = {};
            if (eventsfilter[lang]) filter = eventsfilter[lang];

            event[lang].filtered = parseEvent.filterEvent(event, filter);
            allfilter = allfilter && event[lang].filtered;

            langCB();
          });
        }, function(err) {
          event.all = {};
          event.all.filtered = allfilter;
          return eventsCB(err);
        });
      }, cbPara1);
    },
    function para2(cbPara2) {
      async.each(languages, function (lang, langCB) {
        let filter = {};
        if (eventsfilter[lang]) filter = eventsfilter[lang];
        filter.lang = lang;
        parseEvent.calendarJSONToMarkdown(result, filter, function(err, text) {
          if (err) return langCB(err);
          markdown[lang] = text;
          return langCB();
        });
      }, cbPara2);
    }
  ], function(err) {
    if (err) return next(err);
    res.render("calendarAllLang.jade", {
      layout: res.rendervar.layout,
      events: result.events,
      errors: result.errors,
      flag: flag,
      discontinue: result.discontinue,
      serviceProvider: result.serviceProvider,
      markdown: markdown,
      eventsfilter: eventsfilter,
      calendarFlags: calendarFlags,
      eventDateFormat: eventDateFormat});
  }
  );
}

function renderCalendarAllLang(req, res, next) {
  debug("renderCalendarAllLang");
  parseEvent.calendarToJSON({}, function(err, result) {
    if (err) return next(err);
    result.discontinue = true;
    result.serviceProvider = "OSMBC";
    renderEvents(result, req, res, next);
  });
}

let alternativeCalendarData = config.getValue("AlternativeCalendarData", {mustExist: true});

function renderCalendarAllLangAlternative(req, res, next) {
  debug("renderCalendarAllLang");

  var options = {
    url: alternativeCalendarData,
    method: "GET",
    json: true
  };
  request(options, function(error, response, body) {
    if (error) return next(error);
    body.forEach(function modifyItem(item) {
      item.desc = item.description;
      item.startDate = new Date(item.start);
      item.endDate = new Date(item.end);
      item.text = item.desc;
    });
    let result = {events: body, error: "No Information"};
    result.discontinue = false;
    result.serviceProvider = "Thomas";
    renderEvents(result, req, res, next);
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


router.get("/calendar2markdown", renderCalendarAsMarkdown);
router.post("/calendar2markdown", postCalendarAsMarkdown);
router.get("/calendarAllLang", renderCalendarAllLang);
router.get("/calendarAllLangAlternative", renderCalendarAllLangAlternative);
router.get("/picturetool", renderPictureTool);
router.post("/picturetool", postPictureTool);

publicRouter.get("/calendar/preview", renderPublicCalendar);
publicRouter.get("/calendar/json", renderJSONCalendar);
module.exports.router = router;
module.exports.publicRouter = publicRouter;
