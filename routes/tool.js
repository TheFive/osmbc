"use strict";

const debug = require("debug")("OSMBC:routes:tool");
const express = require("express");
const router = express.Router();
const config = require("../config.js");
const glob = require("glob");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const moment = require("moment");
const async = require("async");
const yaml     = require("js-yaml");
const BlogRenderer = require("../render/BlogRenderer.js");
const childProcess = require("child_process");
const logger = require("../config.js").logger;
const osmcalloader = require("../model/osmcalLoader.js");


const articleModule = require("../model/article.js");
const configModule = require("../model/config.js");


const checkRole        = require("../routes/auth.js").checkRole;
const checkUser       = require("../routes/auth.js").checkUser;

const sizeOf = require("image-size");

const htmlroot = config.htmlRoot();


config.getValue("CalendarInterface", { deprecated: true });





function generateCCLicense(license, lang, author) {
  debug("generateCCLicense");
  const licenses = configModule.getConfig("licenses");
  if (!license || license === "") license = "CC0";
  if (!lang || lang === "") lang = "EN";
  if (!author) author = "";
  if (typeof (licenses[license]) === "undefined") license = "CC0";
  let text = licenses[license][lang];
  if (typeof (text) === "undefined") text = licenses[license].EN;
  if (typeof (text) === "undefined") text = "";

  return text.replace("##author##", author);
}

async function renderPictureTool(req, res) {
  debug("renderPictureTool");

  let pictureLanguage = "DE";
  let pictureURL = "http://blog.openstreetmap.de/wp-content/themes/osmblog/images/headers/blog.png";
  let pictureMarkup = "Some cool markdown text with [^1^](#blog_article) superscript";
  let pictureAText = "Logo";
  let pictureLicense = "CC3";
  let pictureAuthor = "[Author Name](LINK)";
  const sessionData = req.session.pictureTool;

  if (sessionData) {
    if (sessionData.pictureLanguage) pictureLanguage = sessionData.pictureLanguage;
    pictureURL = sessionData.pictureURL;
    if (!pictureURL) pictureURL = "";
    pictureMarkup = sessionData.pictureMarkup;
    pictureAText = sessionData.pictureAText;
    pictureLicense = sessionData.pictureLicense;
    pictureAuthor = sessionData.pictureAuthor;
  }

  const warning = [];
  try {
    const response = await axios.get(pictureURL, { responseType: "arraybuffer" });

    let sizeX = 100;
    let sizeY = 100;
    try {
      sizeX = sizeOf(response.data).width;
      sizeY = sizeOf(response.data).height;
    } catch (err) {
      warning.push(err);
    }
    if (sizeX < 700) warning.push("Picture width lower than 700 pixel, check resulting quality.");
    if (sizeY > 900) warning.push("Picture width bigger than 900 pixel, please reduce size.");
    if (pictureURL.indexOf("blog.openstreetmap.de") < 0) warning.push("Picture not hosted on blog.openstreetmap.de");
    let genMarkup = "";

    sizeY = Math.round(sizeY * 800 / sizeX);
    sizeX = 800;
    genMarkup = "![" + pictureAText + "](" + pictureURL + " =" + sizeX + "x" + sizeY + ")\n";
    if (pictureLanguage === "DE") {
      genMarkup += "\n";
    }
    genMarkup += pictureMarkup;
    const ltext = generateCCLicense(pictureLicense, pictureLanguage, pictureAuthor);
    if (ltext !== "") genMarkup += " | " + ltext;

    const article = articleModule.create();
    article["markdown" + pictureLanguage] = genMarkup;
    article.categoryEN = "Picture";
    const renderer = new BlogRenderer.HtmlRenderer(null);
    const preview = renderer.renderArticle(pictureLanguage, article);
    const licenses = configModule.getConfig("licenses");
    // res.set("content-type", "text/html");
    res.render("pictureTool", {
      warning: warning,
      genMarkup: genMarkup,
      licenses: licenses,
      preview: preview,
      pictureLanguage: pictureLanguage,
      pictureURL: pictureURL,
      pictureMarkup: pictureMarkup,
      pictureAText: pictureAText,
      pictureAuthor: pictureAuthor,
      pictureLicense: pictureLicense,
      layout: res.rendervar.layout
    });
  } catch (error) {
    warning.push(">" + pictureURL + "< pictureURL not found");
    const licenses = configModule.getConfig("licenses");
    res.set("content-type", "text/html");
    res.render("pictureTool", {
      genMarkup: "picture not found",
      warning: warning,
      preview: "<p> Error,please try again</p>",
      pictureLanguage: pictureLanguage,
      pictureURL: pictureURL,
      pictureMarkup: pictureMarkup,
      licenses: licenses,
      pictureAText: pictureAText,
      pictureLicense: pictureLicense,
      pictureAuthor: pictureAuthor,
      layout: res.rendervar.layout
    });
  }
}

function postPictureTool(req, res, next) {
  debug("postPictureTool");

  const pictureLanguage = req.body.pictureLanguage;
  const pictureURL = req.body.pictureURL;
  const pictureMarkup = req.body.pictureMarkup;
  const pictureAText = req.body.pictureAText;
  const pictureLicense = req.body.pictureLicense;
  const pictureAuthor = req.body.pictureAuthor;

  req.session.pictureTool = {
    pictureLanguage: pictureLanguage,
    pictureURL: pictureURL,
    pictureMarkup: pictureMarkup,
    pictureLicense: pictureLicense,
    pictureAuthor: pictureAuthor,

    pictureAText: pictureAText
  };
  req.session.save(function(err) {
    if (err) return next(err);
    res.redirect(htmlroot + "/tool/picturetool");
  });
}

config.getValue("PublicCalendarPage", { deprecated: true });



const logFilePath = config.getValue("scripts").logFilePath;
const scriptFilePath = config.getValue("scripts").scriptFilePath;
const logFileFilter = config.getValue("scripts").logFileFilter;
const scriptFileFilter = config.getValue("scripts").scriptFileFilter;

function renderScriptLogs(req, res) {
  glob(logFilePath + "/" + logFileFilter, function(error, data) {
    if (data) data.sort();
    if (error) {
      res.status(500).send(error);
      return;
    }
    res.render("script_logs",
      {
        files: data,
        layout: res.rendervar.layout
      });
  });
}

const fileTypeRunning = " (running).log";
const fileTypeOk = " (done).log";

function readScriptConfig(script, callback) {
  fs.readFile(path.join(scriptFilePath, script), function(err, text) {
    if (err) return callback(err);
    try {
      const configuration = yaml.safeLoad(text);
      return callback(null, configuration);
    } catch (err) {
      const error = "Error Parsing YAML File: " + script + "\n---" + err.message;
      return callback(new Error(error));
    }
  });
}

function quoteParam(param, quote) {
  debug("quoteParam");
  if (quote) return '"' + param + '"';
  // if (quote) return "'" + param + "'";
  return param;
}

function renderScriptLog(req, res) {
  debug("renderScriptLog");
  const file = req.params.filename;
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
    if (err) return res.render("script_log", { layout: res.rendervar.layout, text: "The file " + file + " could not be found.", file: file });
    res.render("script_log",
      {
        layout: res.rendervar.layout,
        text: text,
        file: file,
        reload: reload
      });
  });
}


function renderScripts(req, res) {
  debug("renderScripts");
  glob(scriptFilePath + "/" + scriptFileFilter, function(error, data) {
    if (data) data.sort();
    if (error) {
      res.status(500).send(error);
      return;
    }
    if (!data) data = [];
    for (let i = 0; i < data.length; i++) { data[i] = path.basename(data[i]); }
    const configTable = {};
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
          {
            layout: res.rendervar.layout,
            files: data,
            configTable: configTable
          });
      }
    );
  });
}

function renderScript(req, res) {
  debug("renderScript");
  const file = req.params.filename;

  readScriptConfig(file, function(err, configuration) {
    if (err) return res.status(500).send(err);
    res.render("script_execute_page", {
      layout: res.rendervar.layout,
      configuration: configuration,
      file: file,
      query: req.query
    });
  });
}



function executeScript(req, res, next) {
  debug("executeScript");
  const file = req.params.filename;

  readScriptConfig(file, function(err, configuration) {
    if (err) return res.status(500).send(err);

    const logFileBase = configuration.name + " " + req.user.OSMUser + " " + moment().format("YYYY-MM-DD HH:mm:ss");
    const logFileRunning = path.join(logFilePath, logFileBase + fileTypeRunning);
    const logFileOk = path.join(logFilePath, logFileBase + fileTypeOk);

    let script = path.join(scriptFilePath, configuration.execute);
    if (configuration.execute.substring(0, 1) === "/") script = configuration.execute;

    let pictureFile = null;

    let doThingsBeforeScript = function(err, callback) {
      if (err) return callback(err);
      return callback();
    };

    const args = [];
    configuration.params.forEach(function(param) {
      if (param.type === "static") {
        args.push(quoteParam(param.value, param.quote));
      }
      if (param.type === "checkbox" && req.body[param.title] === "on") {
        args.push(param.flag);
      }
      if (param.type === "file" && req.files && req.files[param.title]) {
        if (pictureFile) return next(new Error("Two Pictures not allowed"));
        const fn = req.files[param.title].name.replace(/\s+/g, "_");
        pictureFile = path.join(logFilePath, fn);
        doThingsBeforeScript = function(err, callback) {
          if (err) return callback(err);
          req.files[param.title].mv(pictureFile, callback);
        };
        if (param.flag) args.push(param.flag);
        if (pictureFile) args.push(quoteParam(pictureFile, param.quote));
      }
      if (param.type === "text" && req.body[param.title]) {
        args.push(quoteParam(req.body[param.title], param.quote));
      }
      if (param.type === "select") {
        args.push(quoteParam(req.body[param.title], param.quote));
      }
      if (param.type === "number" && req.body[param.title]) {
        args.push(quoteParam(req.body[param.title], param.quote));
      }
    });

    const options = {
      cwd: scriptFilePath,
      env: {
        OSMUSER: req.user.OSMUser,
        SCRIPT_PATH: scriptFilePath,
        LOG_PATH: logFilePath,
        LC_CTYPE: "de_DE.UTF-8"
      }
    };
    if (config.getValue("scripts").uid) {
      options.uid = config.getValue("scripts").uid;
    }

    doThingsBeforeScript(null, function() {
      let cp = null;
      try {
        cp = childProcess.execFile(script, args, options);
      } catch (err) {
        logger.error(err);
        return res.status(500).send(err);
      }
      function logError(err) {
        if (err) logger.error(err);
        if (pictureFile) fs.unlink(pictureFile, function() {});
      }
      try {
        cp.on("error", (error) => {
          fs.appendFile(logFileRunning, "error: " + error.message, (err) => { logger.error(err); });
          logger.error("Script " + file + " generates error");
          logger.error(error);
        });

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
      fs.appendFile(logFileRunning, "Script Started: " + script + " " + JSON.stringify(args), function(err) {
        if (err) return res.status(500).send(err);
        res.redirect(htmlroot + "/tool/scripts/log/" + logFileBase);
      });
    });
  });
}

function getEventTable(req, res, next) {
  const lang = req.query.lang;
  osmcalloader.getEventMdCb(lang, function(err, result) {
    if (err) return next(err);
    res.end(result);
  });
}

const userList = config.getValue("scripts").user;
let checkScriptRights = checkRole("full");

if (userList !== "full") checkScriptRights = checkUser(userList);

router.get("/scripts/log", checkScriptRights, renderScriptLogs);
router.get("/scripts/log/:filename", checkScriptRights, renderScriptLog);
router.get("/scripts/execute", checkScriptRights, renderScripts);
router.get("/scripts/execute/:filename", checkScriptRights, renderScript);
router.post("/scripts/execute/:filename", checkScriptRights, executeScript);

router.get("/picturetool", checkRole("full"), renderPictureTool);
router.get("/getEventTable", checkRole("full"), getEventTable);
router.post("/picturetool", checkRole("full"), postPictureTool);


module.exports.router = router;
