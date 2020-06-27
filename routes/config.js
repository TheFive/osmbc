"use strict";

var assert   = require("assert");
var async    = require("../util/async_wrap.js");
var debug    = require("debug")("OSMBC:routes:config");


var express    = require("express");
var router     = express.Router();
const auth        = require("../routes/auth.js");



var config = require("../config.js");

var configModule = require("../model/config.js");
var logModule = require("../model/logModule.js");


const htmlroot = config.htmlRoot();



function renderConfigName(req, res, next) {
  debug("renderConfigName");
  var name = req.params.name;
  assert(name);
  var params = {};
  var config;
  var changes;
  async.series([
    function findConfigByName(cb) {
      debug("findAndCreateConfig");
      configModule.getConfigObject(name, function(err, result) {
        if (err) return cb(err);
        config = result;
        if (!config) return cb(new Error("Config >" + name + "< not found"));
        // JSON is not initially saved, so create it by getting it.
        config.json = config.getJSON();
        return cb();
      });
    },
    function findAndLoadChanges(cb) {
      debug("findAndLoadChanges");
      logModule.find({ table: "config", oid: config.id }, { column: "timestamp", desc: true }, function findAndLoadChangesCB(err, result) {
        debug("findAndLoadChanges_CB");
        if (err) return cb(err);
        changes = result;
        cb();
      });
    }
  ],
  function finalRenderCB(err) {
    debug("finalRenderCB");
    if (err) return next(err);
    assert(res.rendervar);
    var jadeFile = "config";
    if (name === "calendarflags") jadeFile = name;
    if (name === "categorydescription") jadeFile = name;
    if (name === "languageflags") jadeFile = "calendarflags";
    if (name === "calendartranslation") jadeFile = name;
    if (name === "editorstrings") jadeFile = name;
    if (name === "categorytranslation") jadeFile = name;
    if (name === "automatictranslatetext") jadeFile = name;
    if (name === "slacknotification") jadeFile = name;
    if (name === "votes") jadeFile = name;
    if (name === "eventsfilter") jadeFile = name;
    if (name === "ignoreforsearch") jadeFile = "config";
    res.set("content-type", "text/html");
    res.render("config/" + jadeFile, {
      config: config,
      changes: changes,
      params: params,
      layout: res.rendervar.layout
    });
  }
  );
}

function postConfigId(req, res, next) {
  debug("postUserId");
  var name = req.params.name;
  var changes = { yaml: req.body.yaml, type: req.body.type, name: req.body.name, text: req.body.text };
  var configData;
  async.series([
    function findUser(cb) {
      debug("findConfig");
      configModule.getConfigObject(name, function(err, result) {
        if (err) return next(err);
        debug("findById");
        configData = result;
        if (typeof (configData.id) === "undefined") return cb(new Error("Config Not Found"));
        return cb();
      });
    },
    function saveConfig(cb) {
      configData.setAndSave(req.user, changes, function(err) {
        debug("setAndSaveCB");
        cb(err);
      });
    }

  ], function(err) {
    if (err) return next(err);
    res.redirect(htmlroot + "/config/" + configData.name);
  });
}


router.get("/:name", auth.checkRole("full"), renderConfigName);
router.post("/:name", auth.checkRole("full"), postConfigId);


module.exports.router = router;
