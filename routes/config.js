

import _debug from "debug";
import { strict as assert } from "assert";
import async from "async";


import express from "express";
import auth from "../routes/auth.js";



import config from "../config.js";

import configModule from "../model/config.js";
import logModule from "../model/logModule.js";
const debug = _debug("OSMBC:routes:config");
const router     = express.Router();


const htmlroot = config.htmlRoot();



function renderConfigName(req, res, next) {
  debug("renderConfigName");
  const name = req.params.name;
  assert(name);
  const params = {};
  let config;
  let changes;
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
    let jadeFile = "config";
    if (name === "helpmenu") jadeFile = name;
    if (name === "calendarflags") jadeFile = name;
    if (name === "categorydescription") jadeFile = name;
    if (name === "languageflags") jadeFile = "calendarflags";
    if (name === "calendartranslation") jadeFile = name;
    if (name === "editorstrings") jadeFile = name;
    if (name === "newArticles") jadeFile = "config";
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
  const name = req.params.name;
  const changes = { yaml: req.body.yaml, type: req.body.type, name: req.body.name, text: req.body.text };
  let configData;
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



export default router;
