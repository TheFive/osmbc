// Answers for links the link check can't verify (model/linkConfirmation.js):
// exists / missing and undo from the article's link area and the blog page
// (JSON), and the admin list of all answers with search and filter.

import express from "express";
import _debug from "debug";

import auth from "../routes/auth.js";
import linkConfirmation from "../model/linkConfirmation.js";

const debug = _debug("OSMBC:routes:linkConfirmation");

const router = express.Router();

function renderList(req, res, next) {
  debug("renderList");
  const filter = { text: req.query.q, answer: req.query.answer };
  linkConfirmation.search(filter, function(err, entries) {
    if (err) return next(err);
    const now = new Date();
    res.render("linkconfirmations", {
      layout: res.rendervar.layout,
      q: (typeof req.query.q === "string") ? req.query.q : "",
      answer: filter.answer || "all",
      answerFilters: linkConfirmation.answerFilters,
      entries: entries.map(function(e) {
        return { url: e.url, exists: e.linkExists(), user: e.user, timestamp: e.timestamp, status: e.status, validUntil: e.validUntil(), expired: !e.isValid(now) };
      })
    });
  });
}

// form values "true"/"false"; anything else goes on unchanged and the model refuses it
function existsParam(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function postConfirm(req, res, next) {
  debug("postConfirm");
  linkConfirmation.confirm(req.user, req.body.url, existsParam(req.body.exists), function(err, result) {
    if (err) return next(err);
    res.json(result);
  });
}

function postRevoke(req, res, next) {
  debug("postRevoke");
  linkConfirmation.revoke(req.user, req.body.url, function(err) {
    if (err) return next(err);
    res.json({ state: "revoked" });
  });
}

router.get("/", auth.checkRole(["full"]), renderList);
router.post("/confirm", auth.checkRole(["full"]), postConfirm);
router.post("/revoke", auth.checkRole(["full"]), postRevoke);

export default router;
