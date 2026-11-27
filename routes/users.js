

import { strict as assert } from "assert";
import { series } from "async";


import { Router } from "express";
import auth from "../routes/auth.js";
import util from "../util/util.js";
import { redirectBack } from "./redirectBack.js";

import config from "../config.js";
import language from "../model/language.js";

import userModule from "../model/user.js";
import logModule from "../model/logModule.js";
import blogRenderer from "../render/BlogRenderer.js";
import { generateUserPage } from "../genstaticpage/user_gen.js";
import { userArticleSettings } from "../notification/articleChangeFilter.js";
import { mattermostUserTeam } from "../notification/mattermostUserReceiver.js";

import _debug from "debug";
const debug = _debug("OSMBC:routes:users");
const router     = Router();


const htmlroot = config.htmlRoot();

const USERS_PER_PAGE = 100;

// page number from the query, 1 for anything that is not a positive number
function requestedPage(req) {
  const page = Number.parseInt(req.query.page, 10);
  return (Number.isInteger(page) && page > 0) ? page : 1;
}

// URL of another page of the list, keeping filters and sort order
function listPageUrl(req, page) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k !== "page" && typeof v === "string") params.set(k, v);
  }
  params.set("page", String(page));
  return htmlroot + "/usert/list?" + params.toString();
}

function addCounts(users, callback) {
  logModule.getCountsForUsers(users.map(u => u.OSMUser), function(err, countsMap) {
    if (err) return callback(err);
    users.forEach(user => { user._countChanges = countsMap[user.OSMUser] || 0; });
    return callback();
  });
}

// One page of the user list. Change counts (from changes) and the rendering
// are the expensive parts, so both are done for the shown page only; sorting
// by count needs the counts of all users first.
function renderList(req, res, next) {
  debug("renderList");
  const query = {};
  const sort = { column: "OSMUser" };
  const sortByCount = req.query.sort === "OSMBC-changes";
  if (req.query.access) query.access = req.query.access;
  if (req.query.sort && !sortByCount) {
    sort.column = req.query.sort.replace(/[\W]/gim, "");
  }

  if (req.query.desc) sort.desc = true;
  if (req.query.email) query.email = req.query.email;
  if (req.query.lastAccess) query.lastAccess = req.query.lastAccess;
  if (req.query.temporaryGuest) {
    if (req.query.temporaryGuest === "true") query.temporaryGuest = true;
    if (req.query.temporaryGuest === "false") query.temporaryGuest = false;
  }

  userModule.find(query, sort, function(err, allUsers) {
    if (err) return next(err);
    const pages = Math.max(1, Math.ceil(allUsers.length / USERS_PER_PAGE));
    const page = Math.min(requestedPage(req), pages);
    const pageSlice = (list) => list.slice((page - 1) * USERS_PER_PAGE, page * USERS_PER_PAGE);

    const counted = sortByCount ? allUsers : pageSlice(allUsers);
    addCounts(counted, function(err) {
      if (err) return next(err);
      if (sortByCount) allUsers.sort((a, b) => b._countChanges - a._countChanges);
      const users = pageSlice(allUsers);
      users.forEach(user => { user._notifiesNewCollection = userArticleSettings(user).newSubmission !== "off"; });
      assert(res.rendervar);
      res.set("content-type", "text/html");
      res.render("userList", {
        layout: res.rendervar.layout,
        query: query,
        users: users,
        paging: {
          page: page,
          pages: pages,
          total: allUsers.length,
          previousUrl: (page > 1) ? listPageUrl(req, page - 1) : null,
          nextUrl: (page < pages) ? listPageUrl(req, page + 1) : null
        }
      });
    });
  });
}



function renderUserId(req, res, next) {
  debug("renderUserId");
  let redirect = false;
  let id = req.params.user_id;
  const highlight = (req.query.highlight) ?? "nothing";


  if (req.query.becomeGuest === "true" && req.user.access === "full") {
    config.logger.info("Switch user " + req.user.OSMUser + " to guest");
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
  series([
    function findAndLoaduserByName(cb) {
      debug("findAndLoaduserByName");
      userModule.findExact("OSMUser", id, function findAndLoaduserCB(err, result) {
        debug("findAndLoaduser_CB");
        if (err) return cb(err);
        user = result[0];
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
        if (err) config.logger.error(err);
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
      articleSettings: userArticleSettings(user),
      mattermostNotify: mattermostUserTeam() !== null,
      layout: res.rendervar.layout,
      highlight: highlight
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
    notifyNewCollection: req.body.notifyNewCollection,
    notifyCollectionChange: req.body.notifyCollectionChange,
    notifyGuestTextChange: req.body.notifyGuestTextChange,
    notifyVia: req.body.notifyVia,
    mailComment: req.body.mailComment,
    translationServices: req.body.translationServices,
    translationServicesMany: req.body.translationServicesMany,
    languageSetName1: req.body.languageSetName1,
    languageSetName2: req.body.languageSetName2,
    languageSetName3: req.body.languageSetName3,
    languageSetName4: req.body.languageSetName4,
    languageSetName5: req.body.languageSetName5,
    mailBlogLanguageStatusChange: req.body.mailBlogLanguageStatusChange,
    mailCommentGeneral: req.body.mailCommentGeneral,
    email: req.body.email,
    access: req.body.access,
    publicProfile: req.body.publicProfile,
    publicHtml: req.body.publicHtml
  };

  if (typeof (changes.mailComment) === "string") {
    changes.mailComment = [changes.mailComment];
  }
  if (typeof (changes.mailComment) === "undefined") {
    changes.mailComment = [];
  }
  if (typeof (changes.translationServices) === "string") {
    changes.translationServices = [changes.translationServices];
  }
  if (typeof (changes.translationServicesMany) === "string") {
    changes.translationServicesMany = [changes.translationServicesMany];
  }
  if (typeof (changes.translationServices) === "undefined") {
    changes.translationServices = [];
  }
  if (config.getValue("manyTranslationEnabled", { default: true }) === false) {
    // field is hidden in the form, keep the stored value
    delete changes.translationServicesMany;
  } else if (typeof (changes.translationServicesMany) === "undefined") {
    changes.translationServicesMany = [];
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
  series([
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
    function saveUserStep(cb) {
      user.setAndSave(req.user, changes, function(err) {
        debug("setAndSaveCB");
        cb(err);
      });
    },
    function generateUserPageStep(cb) {
      generateUserPage(req.user.OSMUser, cb);
    }

  ], function(err) {
    if (!allowedToChangeUser) return res.status(403).send("Not Allowed To Post this user");
    if (err) {
      return next(err);
    }
    res.redirect(htmlroot + "/usert/" + id);
  });
}

function inbox (req, res) {
  debug("inbox");
  const renderer = blogRenderer.createRenderer("HTML", null, { target: "editor" });
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
    redirectBack(req, res);
  });
}



router.get("/inbox", auth.checkRole(["full", "guest"]), inbox);
router.get("/list", auth.checkRole("full"), renderList);
router.get("/create", auth.checkRole("full"), createUser);
router.get("/createApiKey", auth.checkRole("full"), createApiKey);
router.get("/:user_id", auth.checkRole(["full", "guest"]), renderUserId);
router.post("/:user_id", auth.checkRole(["full", "guest"]), postUserId);


export { router };
