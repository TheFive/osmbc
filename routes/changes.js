"use strict";

var express = require("express");
var should = require("should");
var router = express.Router();
var debug = require("debug")("OSMBC:routes:changes");
var logModule = require("../model/logModule.js");
var jsdiff = require("diff");
const auth        = require("../routes/auth.js");



function generateHTMLDiff(one, other) {
  debug("generateHTMLDiff");
  if (!one) one = "";
  if (!other) other = "";

  if (typeof (one) !== "string") return "";
  if (typeof (other) !== "string") return "";

  const diff = jsdiff.diffWords(one, other);
  var result = "";
  diff.forEach(function(part) {
    // green for additions, red for deletions
    // grey for common parts
    var styleColor               = 'style="color:grey"';
    if (part.added) styleColor = 'class="osmbc-inserted-inverted"';
    if (part.removed) styleColor = 'class="osmbc-deleted-inverted"';


    result += "<span " + styleColor + ">" + part.value + "</span>";
  });
  return result;
}



function renderHistoryLog(req, res, next) {
  debug("renderHistoryLog");
  var date = req.query.date;
  var user = req.query.user;
  var table = req.query.table;
  var blog = req.query.blog;
  var property = req.query.property;
  var oid = req.query.oid;

  var params = { date: date, oid: oid, user: user, table: table, blog: blog, property: property };


  var search = {};
  if (date) search.timestamp = date + "%";
  if (date && ((date.indexOf("<") >= 0) || (date.indexOf(">") >= 0))) search.timestamp = date;
  if (date && ((date.indexOf("GE:") >= 0) || (date.indexOf(">") >= 0))) search.timestamp = date;
  if (user) search.user = user;
  if (table) {
    search.table = table;
  } else {
    search.table = "IN ('usert','article','blog')";
  }

  if (blog) search.blog = blog;

  if (property) search.property = property;

  if (oid) search.oid = oid;


  logModule.find(search, { column: "timestamp", desc: true, limit: 150 }, function (err, result) {
    debug("logModule.find");
    if (err) return next(err);
    res.set("content-type", "text/html");
    res.render("history", { history: result, layout: res.rendervar.layout, params: params });
  });
}

/* GET users listing. */
function renderChangeId(req, res, next) {
  debug("renderChangeId");
  var id = req.params.change_id;
  logModule.findById(id, function(err, change) {
    if (err) return next(err);
    if (!change || typeof (change.id) === "undefined") return next(new Error("Change id >" + id + "< not found."));
    should.exist(res.rendervar);
    res.set("content-type", "text/html");
    res.render("change", {
      change: change,
      coloredChange: generateHTMLDiff(change.from, change.to),
      layout: res.rendervar.layout
    });
  });
}


router.get("/log", auth.checkRole("full"), renderHistoryLog);
router.get("/:change_id", auth.checkRole("full"), renderChangeId);

module.exports.router = router;


