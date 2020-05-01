"use strict";

var express  = require("express");
var async    = require("async");
var router   = express.Router();
var debug    = require("debug")("OSMBC:routes:slack");

var config   = require("../config.js");
var logger   = require("../config.js").logger;
var util     = require("../util/util.js");


var userModule     = require("../model/user.js");
var htmltitle     = require("../model/htmltitle.js");
var articleModule     = require("../model/article.js");


var botName = config.getValue("AppName", { mustExist: true }).toLowerCase();

var osmbcUrl = config.getValue("url", { mustExist: true }) + config.htmlRoot();

function articleNameSlack(article) {
  debug("articleNameSlack");
  return "[" + article.title + "](" + osmbcUrl + "/article/" + article.id + ")";
}

function ensureAuthentificated(req, res, next) {
  debug("ensureAuthentificated");
  var slackTeam = req.params.team;
  let token = "xx";
  if (config.getValue("slack").article[slackTeam]) {
    token = config.getValue("slack").article[slackTeam].token;
  }
  if (req.body.token !== token) {
    res.status(401).send("Authorisation forbidden");
    return;
  }
  // to not answer to bots

  if (req.body.user_name === "slackbot") {
    res.json({});
    return;
  }
  userModule.find({ SlackUser: req.body.user_name }, function(err, user) {
    if (err) {
      logger.error(err);
      return next(err);
    }
    var obj = {};

    obj.token = req.body.token;
    obj.team_id = req.body.team_id;
    obj.channel_id = req.body.channel_id;
    obj.channel_name = req.body.channel_name;
    obj.timestamp = new Date(req.body.timestamp);
    obj.user_id = req.body.user_id;
    obj.user_name = req.body.user_name;
    obj.username = botName;

    if (user.length === 0) {
      obj.text = "<@" + obj.user_id + "> I never heard from you. Please enter your Slack Name in <" + osmbcUrl + "/usert/self|OSMBC>";
      res.json(obj);
      return;
    }
    if (user.length > 1) {
      obj.text = "<@" + obj.user_id + "> is registered more than once in <" + osmbcUrl + "/usert/self|OSMBC>";
      res.json(obj);
      return;
    }

    req.user = user[0];
    return next();
  });
}


function searchUrlInSlack(text) {
  debug("searchUrlInSlack");
  if (text.search("<") >= 0) {
    const from = text.search("<");
    const to = text.search(">");
    if (from < to) {
      return text.substring(from + 1, to);
    }
  }
  return null;
}

function extractTextWithoutUrl(text) {
  debug("extractTextWithoutUrl");
  const url = searchUrlInSlack(text);
  if (url) text = text.replace("<" + url + ">", "");
  return text;
}









function postSlackCreateUseTBC(req, res, next) {
  debug("postSlackCreateUseTBC");

  var obj = {};

  obj.token = req.body.token;
  obj.team_id = req.body.team_id;
  obj.channel_id = req.body.channel_id;
  obj.channel_name = req.body.channel_name;
  obj.timestamp = new Date(req.body.timestamp);
  obj.user_id = req.body.user_id;
  obj.user_name = req.body.user_name;
  obj.text = req.body.text;
  obj.username = botName;

  let url = null;
  if (util.isURL(obj.text)) url = obj.text;

  let title;
  const blog = "TBC";

  if (typeof (url) === "undefined" || url === "" || url === null) {
    // This is the mattermost variant
    obj.text = "@" + req.body.user_name + " Please enter an url.";
    res.json(obj);
    return;
  }

  async.series([function calcTitle(cb) {
    if (typeof (title) === "undefined" || title === "") {
      htmltitle.getTitle(url, function (err, t) {
        if (err) return cb(err);
        title = t;
        return cb();
      });
    } else return cb();
  }], function createArticle(err) {
    if (err) return next(err);
    const changes = {
      title: title,
      collection: url,
      firstCollector: req.user.OSMUser,
      categoryEN: "-- no category yet --",
      blog: blog
    };
    articleModule.createNewArticle(function(err, result) {
      if (err) return next(err);
      changes.version = result.version;

      result.setAndSave(req.user, changes, function(err) {
        if (err) return next(err);
        obj.text = "Article: " + articleNameSlack(result) + " created in your TBC Folder.\n";
        res.json(obj);
      });
    });
  });
}



router.post("/create/:team", ensureAuthentificated, postSlackCreateUseTBC);





module.exports.router = router;

module.exports.fortestonly = {};
module.exports.fortestonly.searchUrlInSlack = searchUrlInSlack;
module.exports.fortestonly.extractTextWithoutUrl = extractTextWithoutUrl;



