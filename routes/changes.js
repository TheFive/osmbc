

import _debug from "debug";
import express from "express";
import assert from "assert";
import logModule from "../model/logModule.js";
import blogModule from "../model/blog.js";
import { diffWords } from "diff";
import auth from "../routes/auth.js";
const router    = express.Router();
const debug = _debug("OSMBC:routes:changes");



function generateHTMLDiff(one, other) {
  debug("generateHTMLDiff");
  if (!one) one = "";
  if (!other) other = "";

  if (typeof (one) !== "string") return "";
  if (typeof (other) !== "string") return "";

  const diff = diffWords(one, other);
  let result = "";
  diff.forEach(function(part) {
    // green for additions, red for deletions
    // grey for common parts
    let styleColor               = 'style="color:grey"';
    if (part.added) styleColor = 'class="osmbc-inserted-inverted"';
    if (part.removed) styleColor = 'class="osmbc-deleted-inverted"';


    result += "<span " + styleColor + ">" + part.value + "</span>";
  });
  return result;
}



function renderHistoryLog(req, res, next) {
  debug("renderHistoryLog");
  const date = req.query.date;
  const user = req.query.user;
  const table = req.query.table;
  const blog = blogModule.sanitizeBlogKey(req.query.blog);
  const property = req.query.property;
  const oid = req.query.oid;

  const params = { date: date, oid: oid, user: user, table: table, blog: blog, property: property };

  if (date && typeof date !== "string") return next(new Error("Datatype Error"));

  const search = {};
  if (date) search.timestamp = date + "%";
  if (date && ((date.indexOf("<") >= 0) || (date.indexOf(">") >= 0))) search.timestamp = date;
  if (date && ((date.indexOf("GE:") >= 0) || (date.indexOf(">") >= 0))) search.timestamp = date;
  if (user) search.user = user;
  if (table) {
    search.table = table;
  } else {
    search.table = "IN(usert,article,blog)";
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
  const id = req.params.change_id;
  logModule.findById(id, function(err, change) {
    if (err) return next(err);
    if (!change || typeof (change.id) === "undefined") return next(new Error("Change id >" + id + "< not found."));
    assert(res.rendervar);
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

export default router;
