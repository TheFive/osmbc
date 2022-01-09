"use strict";

const assert   = require("assert");
const async    = require("async");
const debug    = require("debug")("OSMBC:routes:users");


const express    = require("express");
const router     = express.Router();
const auth       = require("../routes/auth.js");
const HttpError  = require("standard-http-error");


const config   = require("../config.js");
const language = require("../model/language.js");
const logger   = require("../config.js").logger;

const userModule = require("../model/user.js");
const logModule = require("../model/logModule.js");
const blogRenderer = require("../render/BlogRenderer.js");


const htmlroot = config.htmlRoot();

function renderList(req, res, next) {
  debug("renderList");
  let users;
  const query = {};
  const sort = { column: "OSMUser" };
  if (req.query.access) query.access = req.query.access;
  if (req.query.sort && req.query.sort !== "OSMBC-changes") sort.column = req.query.sort;
  if (req.query.desc) sort.desc = true;
  if (req.query.email) query.email = req.query.email;
  if (req.query.lastAccess) query.lastAccess = req.query.lastAccess;
  if (req.query.temporaryGuest) {
    if (req.query.temporaryGuest === "true") query.temporaryGuest = true;
    if (req.query.temporaryGuest === "false") query.temporaryGuest = false;
  }

  async.parallel([
    function(callback) {
      userModule.find(query, sort, function(err, result) {
        if (err) return callback(err);
        users = result;
        async.each(users, function (item, eachcb) {
          item.calculateChanges(eachcb);
        }, function(err) {
          if (req.query.sort === "OSMBC-changes") {
            users.sort(function(b, a) { return a._countChanges - b._countChanges; });
          }
          return callback(err);
        });
      });
    }
  ], function(error) {
    if (error) return next(error);
    assert(res.rendervar);
    res.set("content-type", "text/html");
    res.render("userList", {
      layout: res.rendervar.layout,
      query: query,
      users: users
    });
  }
  );
}



function renderUserId(req, res, next) {
  debug("renderUserId");
  let redirect = false;
  let id = req.params.user_id;


  if (req.query.becomeGuest === "true" && req.user.access === "full") {
    logger.info("Switch user " + req.user.OSMUser + " to guest");
    req.user.access = "guest";
    req.user.temporaryGuest = true;
    req.user.save({ noVersionIncrease: true }, function(err) {
      if (err) return next(err);
      res.redirect(htmlroot + "/usert/self");
    });
    return;
  }
  if (req.query.becomeFull === "true" && req.user.access === "guest" && req.user.temporaryGuest === true) {
    req.user.access = "full";
    delete req.user.temporaryGuest;
    req.user.save({ noVersionIncrease: true }, function(err) {
      if (err) return next(err);
      res.redirect(htmlroot + "/usert/self");
    });
    return;
  }


  if (id === "self") return res.redirect(res.rendervar.layout.htmlroot + "/usert/" + req.user.id);
  assert(id);
  if (req.user.access === "guest") {
    if ((req.user.OSMUser !== id) && (req.user.id !== id)) {
      return res.status(403).send("Not allowed for guests.");
    }
  }

  const params = {};
  let user;
  let changes;
  let userHeatMapArray = null;
  async.series([
    function findAndLoaduserByName(cb) {
      debug("findAndLoaduserByName");
      userModule.findOne({ OSMUser: id }, function findAndLoaduserCB(err, result) {
        debug("findAndLoaduser_CB");
        if (err) return cb(err);
        user = result;
        if (user) id = user.id;
        return cb();
      });
    },
    function findAndLoaduserById(cb) {
      debug("findAndLoaduserById");
      userModule.findById(id, function findAndLoaduserCB(err, result) {
        debug("findAndLoaduser_CB");
        if (err) return cb(err);
        if (result) user = result;
        if (!user || typeof (user.id) === "undefined") return cb(new Error("User ID >" + id + "< Not Found"));
        if (req.query.validation) {
          user.validateEmail(req.user, req.query.validation, function (err) {
            if (err) return cb(err);
            redirect = true;
            res.redirect(res.rendervar.layout.htmlroot + "/usert/" + user.id);
            return cb();
          });
        } else cb();
      });
    },
    function findAndLoadChanges(cb) {
      debug("findAndLoadChanges");
      logModule.find({ table: "usert", oid: id }, { column: "timestamp", desc: true }, function findAndLoadChangesCB(err, result) {
        debug("findAndLoadChanges_CB");
        if (err) return cb(err);
        changes = result;
        cb();
      });
    },
    function findAndLoadHeatCalendarData(cb) {
      debug("findAndLoadHeatCalendarData");
      logModule.countLogsForUser(user.OSMUser, function(err, result) {
        if (err) logger.error(err);
        userHeatMapArray = result;
        cb(null, result);
      });
    }
  ],
  function finalRenderCB(err) {
    debug("finalRenderCB");
    if (err) return next(err);
    if (redirect) return;
    assert(res.rendervar);
    let view = "user";
    if (req.user.access === "guest") view = "user_guest";
    res.set("content-type", "text/html");
    res.render(view, {
      usershown: user,
      changes: changes,
      params: params,
      userHeatMapArray: userHeatMapArray,
      langlist: language.getLid(),
      layout: res.rendervar.layout
    });
  }
  );
}

function postUserId(req, res, next) {
  debug("postUserId");
  const id = req.params.user_id;
  const changes = {
    OSMUser: req.body.OSMUser,
    SlackUser: req.body.SlackUser,
    mdWeeklyAuthor: req.body.mdWeeklyAuthor,
    color: req.body.color,
    languageCount: req.body.languageCount,
    language: req.body.language,
    mailAllComment: req.body.mailAllComment,
    mailNewCollection: req.body.mailNewCollection,
    mailComment: req.body.mailComment,
    mailBlogLanguageStatusChange: req.body.mailBlogLanguageStatusChange,
    mailCommentGeneral: req.body.mailCommentGeneral,
    email: req.body.email,
    access: req.body.access
  };

  if (typeof (changes.mailComment) === "string") {
    changes.mailComment = [changes.mailComment];
  }
  if (typeof (changes.mailComment) === "undefined") {
    changes.mailComment = [];
  }
  if (typeof (changes.mailBlogLanguageStatusChange) === "string") {
    changes.mailBlogLanguageStatusChange = [changes.mailBlogLanguageStatusChange];
  }
  if (typeof (changes.mailBlogLanguageStatusChange) === "undefined") {
    changes.mailBlogLanguageStatusChange = [];
  }
  if (["three", "four"].indexOf(changes.languageCount) < 0) changes.languageCount = "two";
  let user;
  let allowedToChangeUser = true;
  async.series([
    function findUser(cb) {
      debug("findUser");
      userModule.findById(id, function(err, result) {
        if (err) return cb(err);
        user = result;
        if (req.user.access === "guest") {
          if (user.OSMUser !== req.user.OSMUser) {
            allowedToChangeUser = false;
            return cb(new Error("Not Allowed"));
          }
        }
        debug("findById");
        if (typeof (user.id) === "undefined") return cb(new Error("User ID >" + id + "< Not Found"));
        return cb();
      });
    },
    function saveUser(cb) {
      user.setAndSave(req.user, changes, function(err) {
        debug("setAndSaveCB");
        cb(err);
      });
    }

  ], function(err) {
    if (!allowedToChangeUser) return res.status(403).send("Not Allowed To Post this user");
    if (err && (err instanceof HttpError)) {
      res.status(err.code).send(err.message);
    }

    if (err) return next(err);
    res.redirect(htmlroot + "/usert/" + id);
  });
}

function inbox (req, res) {
  debug("inbox");
  const renderer = new blogRenderer.HtmlRenderer(null);
  req.session.articleReturnTo = req.originalUrl;
  res.set("content-type", "text/html");
  res.render("inbox", { layout: res.rendervar.layout, renderer: renderer });
}

function createUser(req, res, next) {
  debug("createUser");
  userModule.createNewUser(function(err, user) {
    if (err) return next(err);
    res.redirect(htmlroot + "/usert/" + user.id + "?edit=true");
  });
}

function createApiKey(req, res, next) {
  debug("createApiKey");
  req.user.createApiKey(function(err) {
    if (err) return next(err);
    const referer = req.header("Referer") || config.htmlRoot() + "/osmbc";
    res.redirect(referer);
  });
}



router.get("/inbox", auth.checkRole(["full", "guest"]), inbox);
router.get("/list", auth.checkRole("full"), renderList);
router.get("/create", auth.checkRole("full"), createUser);
router.get("/createApiKey", auth.checkRole("full"), createApiKey);
router.get("/:user_id", auth.checkRole(["full", "guest"]), renderUserId);
router.post("/:user_id", auth.checkRole(["full", "guest"]), postUserId);

module.exports.createUser = createUser;
module.exports.postUserId = postUserId;
module.exports.renderUserId = renderUserId;
module.exports.renderList = renderList;

module.exports.router = router;
