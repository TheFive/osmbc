// Confirmation of links the link check can't verify (model/linkConfirmation.js):
// confirm and undo from the article page's link area (JSON), and the
// admin list of all confirmations.

import express from "express";
import _debug from "debug";

import auth from "../routes/auth.js";
import linkConfirmation from "../model/linkConfirmation.js";

const debug = _debug("OSMBC:routes:linkConfirmation");

const router = express.Router();

function renderList(req, res, next) {
  debug("renderList");
  linkConfirmation.findAll(function(err, entries) {
    if (err) return next(err);
    const now = new Date();
    res.render("linkconfirmations", {
      layout: res.rendervar.layout,
      entries: entries.map(function(e) {
        return { url: e.url, user: e.user, timestamp: e.timestamp, status: e.status, validUntil: e.validUntil(), expired: !e.isValid(now) };
      })
    });
  });
}

function postConfirm(req, res, next) {
  debug("postConfirm");
  linkConfirmation.confirm(req.user, req.body.url, function(err, result) {
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
