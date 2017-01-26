"use strict";

var debug = require("debug")("OSMBC:routes:api");
var express = require("express");
var userModule = require("../model/user.js");
var publicRouter = express.Router();

var config = require("../config.js");


// If function is called just return OK
function isServerUp(req, res, next) {
  debug("isServerUp");
  var apiKey = req.params.apiKey;
  if (apiKey !== config.getValue("apiKey")) {
    let err = new Error("Not Authorised");
    err.status = 401;
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
    return next(err);
  }
  let err = null;
  if (!req.body.title) {
    err = new Error("Missing Title");
  }
  if (!req.body.collection) {
    err = new Error("Missing Collection");
  }
  let osmuser = null;
  if (req.body.OSMUser) osmuser = req.body.OSMUser;
  if (!osmuser && !req.body.email) {
    err = new Error("No Email given, can not assign to an OSMBC User");
  }
  if (!osmuser && req.body.email) {
    // Do an asynch search in all users or email adress

  }
  if (!osmuser) err = new Error("No User could be determined.");
  let category = "-- no category yet --";
  if (!req.body.categoryEN) {
    category = req.body.cateogryEN;
  }
  if (err) return next(err);
  let changes = {title: req.body.title,
    collection: req.body.collection,
    firstCollector: req.user.OSMUser,
    categoryEN: category,
    blog: "TBC"};
  articleModule.createNewArticle(function(err, result) {
    if (err) return next(err);
    changes.version = result.version;

    result.setAndSave(req.user, changes, function(err) {
      if (err) return next(err);
      obj.text = articleNameSlack(result) + " created.\n";
      res.json(obj);
    });
  });
}

publicRouter.get("/monitor/:apiKey", isServerUp);
publicRouter.get("/monitorPostgres/:apiKey", isPostgresUp);

publicRouter.post("/collectArticle/:apiKey",collectArticle);

module.exports.publicRouter = publicRouter;
