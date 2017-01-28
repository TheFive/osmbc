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


// If function is called just return OK
function isServerUp(req, res, next) {
  debug("isServerUp");
  var apiKey = req.params.apiKey;
  if (apiKey !== config.getValue("apiKey")) {
    let err = new Error("Not Authorised");
    err.status = 401;
    err.type = "API";
    return next(err);
  }
  res.end("OK");
}

// If function is called query a postgres user,
// and check, wether there is a postgres error
function isPostgresUp(req, res, next) {
  debug("isPostgresUp");
  var apiKey = req.params.apiKey;
  if (apiKey !== config.getValue("apiKey")) {
    let err = new Error("Not Authorised");
    err.status = 401;
    err.type = "API";
    return next(err);
  }
  userModule.find({OSMUser: "test"}, function(err) {
    if (err) return res.end("Postgres Error");
    res.end("OK");
  });
}

function collectArticle(req, res, next) {
  debug("collectArticle");
  var apiKey = req.params.apiKey;
  if (apiKey !== config.getValue("apiKey.TBC")) {
    let err = new Error("Not Authorised");
    err.status = 401;
    err.type = "API";
    return next(err);
  }
  let changes = {};
  changes.categoryEN = "-- no category yet --";
  if (req.body.categoryEN) {
    changes.categoryEN = req.body.cateogryEN;
  }
  changes.blog = "TBC";
  let user="";

  config.getLanguages().forEach(function copyMarkdown(lang){
    if (req.body["markdown"+lang]) {
      changes["markdown"+lang] = req.body["markdown"+lang];
    }
  });

  async.series([
    function getTitle(cb) {
      if (req.body.title) {
        changes.title = req.body.title;
        return cb();
      }
      else {
        let url = util.getAllURL(req.body.collection);
        if (url.length === 0) {
          changes.title="NOT GIVEN";
          return cb();
        }
        htmltitle.getTitle(url[0],function(err,title){
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
        error.type = "API";
        return cb(error);
      }
    },
    function getOSMuser(cb) {
      let query = {};
      if (req.body.OSMUser) {
        query.OSMUser = req.body.OSMUser;
      } else {
        query.email = req.body.email;
      }
      userModule.findOne(query,function(err,userFound){
        if (err || !userFound) {
          let err = new Error("No OSMUser given, could not resolve email address");
          err.type = "API";
          return cb(err);
        }
        user = userFound;
        changes.firstCollector = user.OSMUser;
        return cb();
      });

    }
  ],function(err) {
    if (err) return next(err);
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

publicRouter.get("/monitor/:apiKey", isServerUp);
publicRouter.get("/monitorPostgres/:apiKey", isPostgresUp);

publicRouter.post("/collectArticle/:apiKey",collectArticle);

module.exports.publicRouter = publicRouter;
