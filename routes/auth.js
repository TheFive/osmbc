"use strict";

const debug       = require("debug")("OSMBC:routes:auth");
const HttpStatus  = require("http-status-codes");
const path        = require("path");

const config      = require("../config.js");
const logger      = require("../config.js").logger;
const layoutConst = require("../routes/layout").layoutConst;
const async       = require("../util/async_wrap.js");

const passport     = require("passport");

const LocalHtpasswdStrategy = require("passport-local-htpasswd");
const OAuth2Strategy = require("passport-oauth2").Strategy;
const xml2js = require("xml2js");




const userModule = require("../model/user.js");


const htmlRoot = config.htmlRoot();
const createGuestUsersAutomatic = config.getValue("createGuestUsersAutomatic", { mustExist: true });
const auth = config.getValue("auth", { mustExist: true });



function initialise(app) {
  app.use(passport.initialize());
  app.use(passport.session());

  function renderLogin(req, res) {
    debug("renderLogin");
    res.render("login", { layout: layoutConst });
  }
  function renderLoginFailure(req, res) {
    debug("renderLoginFailure");
    res.render("login failure", { layout: layoutConst });
  }
  app.get(htmlRoot + "/login", renderLogin);
  app.get(htmlRoot + "/login_failure", renderLoginFailure);

  if (auth.openstreetmap.enabled) {
    app.get(htmlRoot + "/auth/openstreetmap", passport.authenticate("openstreetmap"));
    app.get(htmlRoot + "/auth/openstreetmap/callback",
      passport.authenticate("openstreetmap", { failureRedirect: config.getValue("htmlroot") + "/login" }),
      function(req, res) {
        debug("after passport.authenticate Function");
        res.redirect(req.session.returnTo || htmlRoot + "/osmbc.html");
      });
  }
  if (auth.htaccess.enabled) {
    function renderHtAccessLogin(req, res) {
      res.render("login-wpwd", { layout: layoutConst });
    }
    app.get(htmlRoot + "/htaccess/login", renderHtAccessLogin);
    const passport = require("passport");
    app.post(htmlRoot + "/login", passport.authenticate("local-htpasswd", { successRedirect: htmlRoot + "/", failureRedirect: htmlRoot + "/login_failure" }));
  }

  if (auth.openstreetmap_oauth20.enabled) {
    app.get(htmlRoot + "/auth/openstreetmap_oauth20", passport.authenticate("oauth2"));
    app.get(htmlRoot + "/auth/openstreetmap_oauth20/callback", passport.authenticate("oauth2", { failureRedirect: "/login" }),
      function(req, res) {
      // Successful authentication, redirect home.
        res.redirect(req.session.returnTo || htmlRoot + "/osmbc.html");
      });
  }
  app.get(htmlRoot + "/logout", function(req, res) {
    debug("logoutFunction");
    req.logout(function() {
      res.redirect(htmlRoot + "/osmbc.html");
    });
  });


  // Link serializing an deserializing function to passport
  passport.serializeUser(function (user, done) {
    debug("passport.serializeUser CB");
    const username = (user.displayName) ? user.displayName : ((user.username) ? (user.username) : "");
    done(null, username);
  });
  passport.deserializeUser(function (user, done) {
    debug("passport.deserializeUser CB");
    if (typeof user !== "string") {
      logger.error("deserialise user with object called, expected string");
      logger.error(JSON.stringify(user, null, 2));
      return done(null, null);
    }
    userModule.find({ OSMUser: user }, function(err, result) {
      if (err) return done(null, null);
      if (result.length === 1) {
        const overWriteRole = config.getValue("DefineRole");
        if (overWriteRole && overWriteRole[result[0].OSMUser]) {
          result[0].access = overWriteRole[result[0].OSMUser];
          logger.error("DefineRole Overwrite: Switching user " + result[0].OSMUser + " to access " + overWriteRole[result[0].OSMUser]);
        }
        return done(null, result[0]);
      }
      if (createGuestUsersAutomatic && result.length === 0) {
        userModule.createNewUser({ OSMUser: user, access: "guest", mdWeeklyAuthor: "anonymous" }, function(err, user) {
          if (err) return done(null, null);
          return done(null, user);
        });
        return;
      }
      if (result.length === 0) {
        // no automatic guest creation
        return done(new Error("User >" + user + "< does not exist"));
      }
      if (result.length > 1) return done(null, null);
    });
  });

  // Initialise all login mechisms based on config file
  if (auth.htaccess.enabled) {
    const strategy = new LocalHtpasswdStrategy({ name: "htpasswd", file: path.join(__dirname, "..", "test_pwd") });
    passport.use(strategy);
  }
  if (auth.openstreetmap_oauth20.enabled) {
    const oauth2 = auth.openstreetmap_oauth20;
    const client =  new OAuth2Strategy({
      authorizationURL: oauth2.authorizationURL,
      tokenURL: oauth2.tokenURL,
      clientID: oauth2.clientID,
      clientSecret: oauth2.clientSecret,
      callbackURL: oauth2.callbackURL,
      scope: oauth2.scope
    },
    function(accessToken, refreshToken, params, profile, cb) {
      debug("passport.access Token CB");
      return cb(null, profile);
    });
    if (client._oauth2) {
      client._oauth2.useAuthorizationHeaderforGET(true);
      client.userProfile = function (accesstoken, done) {
        debug("passport.userProfile");
        // choose your own adventure, or use the Strategy's oauth client
        this._oauth2.get("https://api.openstreetmap.org/api/0.6/user/details", accesstoken, (err, body, res) => {
          if (err) {
            return done(err);
          }
          try {
            const parser = new xml2js.Parser();
            parser.parseString(body, function (err, result) {
              if (err) return done(err);
              const userProfile = { displayName: result.osm.user[0].$.display_name, id: result.osm.user[0].$.id };
              return done(null, userProfile);
            });
            return;
          } catch (e) {
            return done(e);
          }
        });
      };
    }
    passport.use(client);
  }
}

















function checkRole(role, functions) {
  debug("checkRole");
  let roleArray = role;

  let functionsArray = functions;
  if (typeof role === "string") roleArray = [role];
  if (typeof functions === "function") functionsArray = [functions];
  return function checkAuthentification (req, res, next) {
    debug("checkAuthentification");
    if (!req.isAuthenticated()) return next(new Error("Check Authentication runs in unauthenticated branch. Please inform your OSMBC Admin."));
    const accessIndex = roleArray.indexOf(req.user.access);
    if (accessIndex >= 0) {
      if (!functionsArray) return next();
      if (!functionsArray[accessIndex]) return next();
      return functionsArray[accessIndex](req, res, next);
    }
    return res.status(HttpStatus.FORBIDDEN).send("OSM User >" + req.user.OSMUser + "< has not enough access rights");
  };
}

function checkUser(user) {
  debug("checkUser");
  let userArray = user;
  if (typeof user === "string") userArray = [user];
  return function checkAuthentificationUser (req, res, next) {
    debug("checkAuthentificationUser");
    if (!req.isAuthenticated()) return next(new Error("Check Authentication runs in unauthenticated branch. Please inform your OSMBC Admin."));
    const accessIndex = userArray.indexOf(req.user.OSMUser);
    if (accessIndex >= 0) {
      return next();
    }
    return res.status(HttpStatus.FORBIDDEN).send("OSM User >" + req.user.OSMUser + "< has not enough access rights");
  };
}

function hasRole(role) {
  debug("hasRole");
  let roleArray = role;
  if (typeof role === "string") roleArray = [role];
  return function checkAuthentification (req, res, next) {
    debug("checkAuthentification");
    if (!req.isAuthenticated()) return next(new Error("Check Authentication runs in unauthenticated branch. Please inform your OSMBC Admin."));
    if (roleArray.indexOf(req.user.access) >= 0) return next();
    return next("route");
  };
}

let cookieMaxAge = config.getValue("cookieMaxAge");

if (isNaN(cookieMaxAge)) {
  cookieMaxAge = null;
} else {
  cookieMaxAge = cookieMaxAge * 1000 * 60 * 60 * 24;
}


function ensureAuthenticated (req, res, next) {
  debug("ensureAuthenticated");
  debug("Requested URL:  %s", req.url);
  if (req.isAuthenticated()) {
    debug("ensureAuthenticated: OK");
    if (req.user && req.user.access && req.user.access !== "denied") {
      if (!req.session.prolonged) {
        req.session.cookie.maxAge = cookieMaxAge;
        req.session.prolonged = true;
      }
      const date = new Date();
      const lastStore = new Date(req.user.lastAccess);
      // only store last access when GETting something, not in POSTs.
      if (req.method === "GET" && (!req.user.lastAccess || (date.getTime() - lastStore.getTime()) > 1000 * 5)) {
        const stamp = new Date();
        req.user.lastAccess = stamp;
        req.user.save({ noVersionIncrease: true, onlyIfVersionEqual: true }, function (err) {
          if (err) return next(err);
        });
      }
      return next();
    }
    if (req.user && req.user.access === "denied") {
      return res.status(403).send("OSM User >" + req.user.OSMUser + "< has no access rights. Please contact weeklyOSM Team to enable your account.");
    }
    return res.status(403).send("OSM User >" + req.user.OSMUser + "< is not an OSMBC user.");
  }
  // is not authenticated
  debug("ensureAuthenticated: Not OK");
  async.series([
    function saveReturnTo(cb) {
      if (!req.session.returnTo) {
        logger.info("Setting session return to to " + req.originalUrl);
        req.session.returnTo = req.originalUrl;
        return req.session.save(cb);
      }
      return cb();
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect(htmlRoot + "/login");
  });
}


module.exports.passport = passport;
module.exports.checkRole = checkRole;
module.exports.checkUser = checkUser;
module.exports.hasRole = hasRole;
module.exports.ensureAuthenticated = ensureAuthenticated;
module.exports.initialise = initialise;
