

import _debug from "debug";
import { strict as assert } from "assert";
import express from "express";
import async from "async";
import HttpStatus from "http-status-codes";
import help from "../routes/help.js";
import config from "../config.js";
import language from "../model/language.js";
import logModule from "../model/logModule.js";
import userModule from "../model/user.js";
import articleModule from "../model/article.js";
import moment from "moment";
import auth from "../routes/auth.js";
import translator from "../model/translator.js";

const debug = _debug("OSMBC:routes:index");

const router = express.Router();



const appName = config.getValue("AppName", { mustExist: true });
/* GET home page. */

function renderHome(req, res, next) {
  debug("renderHome");
  assert(res.rendervar.layout);
  const date = new Date();
  date.setTime(date.getTime() - 1000 * 60 * 10);

  const todayStart = new Date();
  todayStart.setHours(0);
  todayStart.setMinutes(0);
  todayStart.setSeconds(0);



  async.auto({
    historie: logModule.find.bind(logModule, { table: "IN(blog,article)" }, { column: "id", desc: true, limit: 20 }),
    activeUser: userModule.find.bind(userModule, { lastAccess: ">" + date.toISOString() }, { column: "lastAccess", desc: true }),
    fullVisitorsToday: userModule.find.bind(userModule, { lastAccess: ">" + todayStart.toISOString(), access: "full" }, { column: "OSMUser", desc: false }),
    guestVisitorsToday: userModule.find.bind(userModule, { lastAccess: ">" + todayStart.toISOString(), access: "guest" }, { column: "OSMUser", desc: false }),
    newUsers: userModule.getNewUsers.bind(userModule)
  }, function(err, result) {
    if (err) return next(err);

    res.set("content-type", "text/html");
    const view = "index";
    assert(req.user.access === "full");
    res.render(view, {
      title: appName,
      layout: res.rendervar.layout,
      activeUserList: result.activeUser,
      fullVisitorsToday: result.fullVisitorsToday,
      guestVisitorsToday: result.guestVisitorsToday,
      newUsers: result.newUsers,
      changes: result.historie
    });
  }
  );
}

function renderGuestHome(req, res, next) {
  debug("renderGuestHome");
  assert(res.rendervar.layout);
  const date = new Date();
  date.setTime(date.getTime() - 1000 * 60 * 10);

  const todayStart = new Date();
  todayStart.setHours(0);
  todayStart.setMinutes(0);
  todayStart.setSeconds(0);

  async.auto({
    articles: articleModule.find.bind(articleModule, { firstCollector: req.user.OSMUser }, { column: "blog", desc: true })
  }, function(err, result) {
    if (err) return next(err);
    res.set("content-type", "text/html");
    const view = "index_guest";
    assert(req.user.access === "guest");

    res.render(view, {
      title: appName,
      articles: result.articles,
      layout: res.rendervar.layout
    });
  }
  );
}

const userIsOldInDays = config.getValue("userIsOldInDays", { mustExist: true });

function renderAdminHome(req, res, next) {
  debug("renderAdminHome");
  assert(res.rendervar.layout);
  let date = new moment();
  date = date.subtract(userIsOldInDays, "Days").toISOString();

  function usageTemp(callback) {
    translator.deeplUsage().then((result) => { return callback(null, result); }).catch((err) => { return callback(err); });
  }


  async.auto({
    historie: logModule.find.bind(logModule, { table: "IN(usert,config)" }, { column: "id", desc: true, limit: 20 }),
    longAbsent: userModule.find.bind(userModule, { lastAccess: "<" + date, access: "full" }),
    deeplUsage: usageTemp
  }, function(err, result) {
    if (err) return next(err);
    res.set("content-type", "text/html");
    res.render("adminindex", {
      title: appName,
      layout: res.rendervar.layout,
      longAbsent: result.longAbsent,
      changes: result.historie,
      deeplUsage: result.deeplUsage
    });
  }
  );
}


function languageSwitcher(req, res, next) {
  debug("languageSwitcher");

  let lang = req.user.langArray;
  if (!lang) lang = [req.user.getMainLang(), req.user.getSecondLang(), req.user.getLang3(), req.user.getLang4()];
  if (!(lang instanceof Array)) {
    return res.end("Internal Error ");
  }

  function isValidLang(lang) {
    return language.getLanguages()[lang] !== undefined;
  }

  if (req.body.lang) lang[0] = req.body.lang;
  if (req.body.lang0) lang[0] = req.body.lang0;
  for (let i = 1; i < 20; i++) {
    if (req.body["lang" + i]) {
      if (isValidLang(req.body["lang" + i])) {
        lang[i - 1] = req.body["lang" + i];
      } else {
        lang[i - 1] = null;
      }
    }
  }


  for (let v = 0; v < lang.length - 1; v++) {
    for (let i = v + 1; i < lang.length; i++) {
      while (i < lang.length && (lang[v] === lang[i] || lang[i] === null)) {
        lang.splice(i, 1);
      }
    }
  }




  if (language.getLanguages()[lang[0]]) {
    req.user.mainLang = lang[0];
  }
  if (lang.length >= 2 && language.getLanguages()[lang[1]]) {
    req.user.secondLang = lang[1];
  } else {
    req.user.secondLang = null;
    req.user.lang3 = null;
    req.user.lang4 = null;
  }
  if (lang.length >= 3 && language.getLanguages()[lang[2]]) {
    req.user.lang3 = lang[2];
  } else {
    req.user.lang3 = null;
    req.user.lang4 = null;
  }
  if (lang.length >= 4 && language.getLanguages()[lang[3]]) {
    req.user.lang4 = lang[3];
  } else {
    req.user.lang4 = null;
  }
  req.user.langArray = lang;

  req.user.save(function finalLanguageSwitcher(err) {
    if (err) return next(err);
    res.end("OK");
  });
}

function languageSetSwitcher(req, res, next) {
  debug("languageSetSwitcher");

  const set = req.body.set;
  const action = req.body.action;

  if (action === "save") {
    req.user.saveLanguageSet(set, function (err) {
      if (err) return next(err);
      res.end("OK");
      return res.end("OK");
    });
    return;
  }
  if (action === "delete") {
    req.user.deleteLanguageSet(set, function (err) {
      if (err) return next(err);
      return res.end("OK");
    });
    return;
  }

  req.user.languageSet = set;

  if (set === "Individual") req.user.languageSet = "";

  req.user.save(function finalLanguageSwitcher(err) {
    if (err) return next(err);
    return res.end("OK");
  });
}

function setUserConfig(req, res, next) {
  debug("setUserConfig");

  const user = req.user;
  if (!req.body.view) {
    const err = new Error("missing view in option");
    err.status = HttpStatus.BAD_REQUEST;
    return next(err);
  }
  if (!req.body.option) {
    const err = new Error("missing option in option");
    err.status = HttpStatus.BAD_REQUEST;
    return next(err);
  }
  if (!req.body.value) {
    const err = new Error("missing value in option");
    err.status = HttpStatus.BAD_REQUEST;
    return next(err);
  }
  user.setOption(req.body.view, req.body.option, req.body.value);

  req.user.save(function finalLanguageSwitcher(err) {
    if (err) return next(err);
    res.end("OK");
  });
}

function createBlog(req, res) {
  debug("createBlog");
  assert(res.rendervar.layout);
  res.render("createblog", { layout: res.rendervar.layout });
}


function renderChangelog(req, res, next) {
  debug("renderChangelog");
  assert(res.rendervar.layout);
  const text = help.getText("CHANGELOG.md");
  req.user.lastChangeLogView = res.rendervar.layout.osmbc_version;
  req.user.save(function(err) {
    if (err) return next(err);
    res.set("content-type", "text/html");
    res.render("help", { layout: res.rendervar.layout, text: text });
  });
}

const htmlRoot = config.htmlRoot();

function redirectHome(req, res) {
  debug("redirectHome");
  res.redirect(htmlRoot + "/");
}

router.get("/", auth.hasRole(["full"]), renderHome);
router.get("/", auth.checkRole(["guest"]), renderGuestHome);
router.get("/osmbc.html", redirectHome);
router.get("/osmbc", redirectHome);
router.get("/osmbc/admin", auth.checkRole(["full"]), renderAdminHome);
router.get("/changelog", auth.checkRole(["full", "guest"]), renderChangelog);
router.post("/language", auth.checkRole(["full", "guest"]), languageSwitcher);
router.post("/languageset", auth.checkRole(["full", "guest"]), languageSetSwitcher);
router.post("/setuserconfig", auth.checkRole(["full", "guest"]), setUserConfig);
router.get("/createblog", auth.checkRole(["full"]), createBlog);



export default router;
