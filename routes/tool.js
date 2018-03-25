"use strict";

const debug = require("debug")("OSMBC:routes:tool");
const express = require("express");
const router = express.Router();
const publicRouter = express.Router();
const config = require("../config.js");
const url = require("url");
const glob = require("glob");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const moment = require("moment");
const async = require("async");
const request = require("request");
const yaml     = require("js-yaml");
const BlogRenderer = require("../render/BlogRenderer.js");
const childProcess = require("child_process");
const logger = require("../config.js").logger;



const parseEvent = require("../model/parseEvent.js");

const articleModule = require("../model/article.js");
const configModule = require("../model/config.js");


const checkRole        = require("../routes/auth.js").checkRole;
const checkUser       = require("../routes/auth.js").checkUser;

var sizeOf = require("image-size");

let htmlroot = config.htmlRoot();
let osmbcDateFormat = config.getValue("CalendarDateFormat", {mustExist: true});




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
  if (!country) country = "";
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

    res.render("calendarAllLang", {
      layout: res.rendervar.layout,
      events: result.events,
      errors: result.errors,
      flag: flag,
      timestamp: result.timestamp,
      discontinue: result.discontinue,
      refresh: result.refreshurl,
      serviceProvider: result.serviceProvider,
      markdown: markdown,
      eventsfilter: eventsfilter,
      calendarFlags: calendarFlags,
      eventDateFormat: eventDateFormat});
  }
  );
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
      return next(Error("url: " + cc.url + " returns: \n" + response.statusCode + JSON.stringify(body)));
    }
    if (!body[cc.events]) return next(new Error("Missing events in calendar data"));
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
  debug("renderCalendarRefresh");

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
    let referer = req.header("Referer") || "/";
    res.redirect(referer);
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

    body = body.replace("</body>", " <a href=" + htmlroot + "/calendarRefresh/Thomas>Refresh (wait >60 seconds)</a></body>");
    res.send(body);
  });
}

let logFilePath = config.getValue("scripts").logFilePath;
let scriptFilePath = config.getValue("scripts").scriptFilePath;
let logFileFilter = config.getValue("scripts").logFileFilter;
let scriptFileFilter = config.getValue("scripts").scriptFileFilter;

function renderScriptLogs(req, res) {
  glob(logFilePath + "/" + logFileFilter, function(error, data) {
    if (data) data.sort();
    if (error) {
      res.status(500).send(error);
      return;
    }
    res.render("script_logs",
      {"files": data,
        layout: res.rendervar.layout});
  });
}

const fileTypeRunning = " (running).log";
const fileTypeOk = " (done).log";

function readScriptConfig(script, callback) {
  fs.readFile(path.join(scriptFilePath, script), function(err, text) {
    if (err) return callback(err);
    try {
      let configuration = yaml.safeLoad(text);
      return callback(null, configuration);
    } catch (err) {
      let error = "Error Parsing YAML File: " + script +"\n---"+err.message;
      return callback(new Error(error));
    }
  });
}

function quoteParam(param,quote) {
  if (quote) return '"' + param +'"';
  return param;
}

function renderScriptLog(req, res) {
  let file = req.params.filename;
  let text = null;
  let reload = false;

  async.series([
    (cb) => {
      // First check if given file exists
      // load it and display it without reload
      fs.readFile(path.join(logFilePath, file), (err, data) => {
        if (!err) {
          text = data;
        }
        cb(null);
      });
    },
    (cb) => {
      // now check wether a "running" log exists
      // display it with automated reload
      if (text) return cb();
      fs.readFile(path.join(logFilePath, file + fileTypeRunning), (err, data) => {
        if (!err) {
          text = data;
          reload = true;
        }
        cb(null);
      });
    },
    (cb) => {
      // if the file exists with done flag, than
      // show it but disable reload
      if (text) return cb();
      fs.readFile(path.join(logFilePath, file + fileTypeOk), (err, data) => {
        if (!err) text = data;
        cb(err);
      });
    }
  ], (err) => {
    logger.error(err);
    if (err) return res.render("script_log", {layout: res.rendervar.layout, text: "The file " + file + " could not be found.", file: file});
    res.render("script_log",
      {layout: res.rendervar.layout,
        text: text,
        file: file,
        reload: reload});
  });
}


function renderScripts(req, res) {
  glob(scriptFilePath + "/" + scriptFileFilter, function(error, data) {
    if (data) data.sort();
    if (error) {
      res.status(500).send(error);
      return;
    }
    if (!data) data = [];
    for (let i = 0; i < data.length; i++) { data[i] = path.basename(data[i]); }
    let configTable = {};
    async.eachLimit(data, 3,
      function(item, callback) {
        readScriptConfig(item, function(err, config) {
          if (err) return callback(err);
          configTable[item] = config;
          return callback();
        });
      },
      function(err) {
        if (err) return res.status(500).send(err.message);
        res.render("script_execute",
          {layout: res.rendervar.layout,
            files: data,
            configTable: configTable});
      }
    );
  });
}

function renderScript(req, res) {
  let file = req.params.filename;

  readScriptConfig(file, function(err, configuration) {
    if (err) return res.status(500).send(err);
    res.render("script_execute_page", {
      layout: res.rendervar.layout,
      configuration: configuration,
      file: file
    });
  });
}



function executeScript(req, res, next) {
  let file = req.params.filename;

  readScriptConfig(file, function(err, configuration) {
    if (err) return res.status(500).send(err);

    let logFileBase = configuration.name + " " + req.user.OSMUser + " " + moment().format("YYYY-MM-DD HH:mm:ss");
    let logFileRunning = path.join(logFilePath, logFileBase + fileTypeRunning);
    let logFileOk = path.join(logFilePath, logFileBase + fileTypeOk);

    let script = path.join(scriptFilePath, configuration.execute);

    let pictureFile = null;

    let doThingsBeforeScript = function(err, callback) {
      if (err) return callback(err);
      return callback();
    };

    let args = [];
    configuration.params.forEach(function(param) {
      if (param.type === "checkbox" && req.body[param.title] === "on") {
        args.push(param.flag);
      }
      if (param.type === "file" && req.files && req.files[param.title]) {
        if (pictureFile) return next(new Error("Two Pictures not allowed"));
        pictureFile = path.join(logFilePath, req.files[param.title].name);
        doThingsBeforeScript = function(err, callback) {
          if (err) return callback(err);
          req.files[param.title].mv(pictureFile, callback);
        };
        if (param.flag) args.push(param.flag);
        if (pictureFile) args.push(qouteParam(pictureFile,param.quote));
      }
      if (param.type === "text" && req.body[param.title]) {
        args.push(quoteParam(req.body[param.title],param.quote));
      }
      if (param.type === "number" && req.body[param.title]) {
        args.push(quoteParam(req.body[param.title],param.quote));
      }
    });

    let options = {
      cwd: scriptFilePath,
      env: {
        OSMUSER: req.user.OSMUser,
        SCRIPT_PATH: scriptFilePath,
        LOG_PATH: logFilePath
      }
    };
    if (config.getValue("scripts").uid) {
      options.uid = config.getValue("scripts").uid;
    }

    doThingsBeforeScript(null, function() {
      let cp = null
      try {
        cp = childProcess.execFile(script, args, options);
      } catch (err) {
        logger.error(err);
        return res.status(500).send(err);
      }
      try {
        cp.on("error", (error) => {
          fs.appendFile(logFileRunning, "error: " + error.message, (err) => { logger.error(err); });
          logger.error("Script " + file + " generates error");
          logger.error(error);
        });
        function logError(err) {
          if (err) logger.error(err);
          if (pictureFile) fs.unlink(pictureFile, function() {});
        }
        cp.stdout.on("data", (data) => {
          fs.appendFile(logFileRunning, data, logError);
        });
        cp.stderr.on("data", (data) => {
          fs.appendFile(logFileRunning, "error: " + data, logError);
        });
        cp.on("close", () => {
          fs.rename(logFileRunning, logFileOk, logError);
          if (pictureFile) fs.unlink(pictureFile, function() {});
        });
      } catch (err) {
        return next(err);
      }
      fs.appendFile(logFileRunning, "Script Started:\n", function(err) {
        if (err) return res.status(500).send(err);
        res.redirect(htmlroot + "/tool/scripts/log/" + logFileBase);
      });
    });
  });
}

let userList = config.getValue("scripts").user;
let checkScriptRights = checkRole("full");

if (userList !== "full") checkScriptRights = checkUser(userList);

router.get("/scripts/log", checkScriptRights, renderScriptLogs);
router.get("/scripts/log/:filename", checkScriptRights, renderScriptLog);
router.get("/scripts/execute", checkScriptRights, renderScripts);
router.get("/scripts/execute/:filename", checkScriptRights, renderScript);
router.post("/scripts/execute/:filename", checkScriptRights, executeScript);

router.get("/calendarAllLang/:calendar", checkRole("full"), renderCalendarAllLangAlternative);
router.get("/picturetool", checkRole("full"), renderPictureTool);
router.post("/picturetool", checkRole("full"), postPictureTool);

publicRouter.get("/calendar/preview", renderPublicCalendar);
publicRouter.get("/calendarRefresh/:calendar", renderCalendarRefresh);

module.exports.router = router;
module.exports.publicRouter = publicRouter;
