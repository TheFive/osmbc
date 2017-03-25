"use strict";

var debug         = require("debug")("OSMBC:routes:api");
var express       = require("express");
var userModule    = require("../model/user.js");
var publicRouter  = express.Router();
var async         = require("async");
var htmltitle     = require("../model/htmltitle.js");
var util          = require("../util.js");
var articleModule = require("../model/article.js");
var config        = require("../config.js");


let apiKeys = config.getValue("apiKeys", {mustExist: true});

function checkApiKey(req, res, next) {
  debug("checkApiKey");
  var apiKey = req.params.apiKey;

  if (apiKeys[apiKey]) {
    req.apiKey = apiKeys[apiKey];
    return next();
  }

  userModule.findOne({apiKey:req.params.apiKey},function(err,user){
    if (err || !user) {
      let err = new Error("Not Authorised");
      err.status = 401;
      err.type = "API";
      return next(err);
    }
    req.user = user;
    next();
  });
}

// If function is called just return OK
function isServerUp(req, res) {
  debug("isServerUp");
  res.end("OK");
}

// If function is called query a postgres user,
// and check, wether there is a postgres error
function isPostgresUp(req, res) {
  debug("isPostgresUp");
  userModule.find({OSMUser: "test"}, function(err) {
    if (err) return res.end("Postgres Error");
    res.end("OK");
  });
}

function collectArticle(req, res, next) {
  debug("collectArticle");
  let changes = {};
  changes.categoryEN = "-- no category yet --";
  if (req.body.categoryEN) {
    changes.categoryEN = req.body.categoryEN;
  }
  changes.blog = "TBC";
  let user = "";

  config.getLanguages().forEach(function copyMarkdown(lang) {
    if (req.body["markdown" + lang]) {
      changes["markdown" + lang] = req.body["markdown" + lang];
    }
  });

  async.series([
    function getTitle(cb) {
      if (req.body.title) {
        changes.title = req.body.title;
        return cb();
      } else {
        let url = [];
        if (typeof req.body.collection === "string") url = util.getAllURL(req.body.collection);
        if (url.length === 0) {
          changes.title = "NOT GIVEN";
          return cb();
        }
        htmltitle.getTitle(url[0], function(err, title) {
          if (err) cb(cb);
          changes.title = title;
          return cb();
        });
      }
    },
    function getCollection(cb) {
      if (req.body.collection) {
        changes.collection = req.body.collection;
        return cb();
      } else {
        let error = new Error("Missing Collection");
        error.status = 422;
        error.type = "API";
        return cb(error);
      }
    },
    function getOSMuser(cb) {
      let query = {};
      if (req.body.OSMUser) {
        query.OSMUser = req.body.OSMUser;
      } else {
        if (!req.body.email) {
          let err = new Error("No OSMUser && EMail given");
          err.type = "API";
          err.status = 422;
          return cb(err);
        }
        query.email = req.body.email;
      }
      userModule.findOne(query, function(err, userFound) {
        if (err || !userFound) {
          let err = new Error("No OSMUser given, could not resolve email address");
          err.type = "API";
          err.status = 422;
          return cb(err);
        }
        user = userFound;
        changes.firstCollector = user.OSMUser;
        return cb();
      });
    }
  ], function(err) {
    if (err) return next(err);

    // check on existence of markdown in body

    if (req.body.markdown && typeof user === "object" && user.language) {
      changes["markdown" + user.language] = req.body.markdown;
    }
    articleModule.createNewArticle(function(err, result) {
      if (err) return next(err);
      changes.version = result.version;

      result.setAndSave(user, changes, function(err) {
        if (err) return next(err);
        res.send("Article Collected in TBC.");
      });
    });
  });
}

function collectArticleLink(req, res, next) {
  debug("collectArticleLink");
  let changes = {};
  changes.categoryEN = "-- no category yet --";
  changes.blog = "TBC";
  let collection = encodeURI(req.query.collection);
  if (!req.user) return next(new Error("for collect not defined"));
  changes.firstCollector = req.user.OSMUser;
  async.series([
    function getTitle(cb) {
      if (req.query.title) {
        changes.title = req.query.title;
        return cb();
      } else {
        let url = [];
        if (typeof collection === "string") url = util.getAllURL(collection);
        if (url.length === 0) {
          changes.title = "NOT GIVEN";
          return cb();
        }
        htmltitle.getTitle(url[0], function(err, title) {
          if (err) cb(err);
          changes.title = title;
          return cb();
        });
      }
    },
    function getCollection(cb) {
      if (req.query.collection) {
        changes.collection = collection;
        return cb();
      } else {
        let error = new Error("Missing Collection");
        error.status = 422;
        error.type = "API";
        return cb(error);
      }
    }
  ], function(err) {
    if (err) return next(err);

    // check on existence of markdown in body
    articleModule.createNewArticle(function(err, result) {
      if (err) return next(err);
      changes.version = result.version;

      result.setAndSave(req.user, changes, function(err) {
        if (err) return next(err);
        res.set("Access-Control-Allow-Origin","*");
        res.send("Article Collected in TBC.");
      });
    });
  });
}

publicRouter.param("apiKey", checkApiKey);

publicRouter.get("/monitor/:apiKey", isServerUp);
publicRouter.get("/monitorPostgres/:apiKey", isPostgresUp);

publicRouter.post("/collectArticle/:apiKey", collectArticle);
publicRouter.get("/collect/:apiKey",collectArticleLink);

module.exports.publicRouter = publicRouter;


