// Links (model/link.js): editors' answers exists / missing and undo from the
// card "Links to check" on blog and article page (JSON), and the admin list
// of all checked links with search and filter.

import express from "express";
import _debug from "debug";

import auth from "../routes/auth.js";
import linkModule from "../model/link.js";

const debug = _debug("OSMBC:routes:link");

const router = express.Router();

function renderList(req, res, next) {
  debug("renderList");
  const options = { text: req.query.q, filter: req.query.filter };
  linkModule.search(options, function(err, found) {
    if (err) return next(err);
    res.render("links", {
      layout: res.rendervar.layout,
      q: (typeof req.query.q === "string") ? req.query.q : "",
      filter: options.filter || "all",
      filters: linkModule.filters,
      total: found.total,
      links: found.links
    });
  });
}

// form values "true"/"false"; anything else goes on unchanged and the model refuses it
function existsParam(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function postAnswer(req, res, next) {
  debug("postAnswer");
  linkModule.answer(req.user, req.body.url, existsParam(req.body.exists), function(err, result) {
    if (err) return next(err);
    res.json(result);
  });
}

function postRevoke(req, res, next) {
  debug("postRevoke");
  linkModule.revoke(req.user, req.body.url, function(err, result) {
    if (err) return next(err);
    res.json(result);
  });
}

router.get("/", auth.checkRole(["full"]), renderList);
router.post("/answer", auth.checkRole(["full"]), postAnswer);
router.post("/revoke", auth.checkRole(["full"]), postRevoke);

export default router;
