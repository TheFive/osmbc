"use strict";

const debug      = require("debug")("OSMBC:routes:auth");
const async      = require("../util/async_wrap.js");
const HttpStatus = require("http-status-codes");

const config = require("../config.js");
const logger = require("../config.js").logger;

const passport     = require("passport");
const OpenStreetMapStrategy = require("passport-openstreetmap").Strategy;

const userModule = require("../model/user.js");


const htmlRoot = config.htmlRoot();

// taken from: https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete OpenStreetMap profile is
//   serialized and deserialized.
// in OSMBC only the displayName is relevant (as long as there is no user database)
// so this is enough for serialising.
// if there will be a user database, this has to be integrated here
passport.serializeUser(function (user, done) {
  debug("passport.serializeUser CB");
  const username = (user.displayName) ? user.displayName : "";
  done(null, username);
});

const createGuestUsersAutomatic = config.getValue("createGuestUsersAutomatic", { mustExist: true });

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


// taken from https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
// Use the OpenStreetMapStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and OpenStreetMap profile), and
//   invoke a callback with a user object.

let Strategy = null;
if (process.env.NODE_ENV === "test") {
  Strategy = require("passport-mocked").Strategy;
} else {
  Strategy = OpenStreetMapStrategy;
}

passport.use(new Strategy({
  name: "openstreetmap",
  consumerKey: config.getValue("OPENSTREETMAP_CONSUMER_KEY", { mustExist: true }),
  consumerSecret: config.getValue("OPENSTREETMAP_CONSUMER_SECRET", { mustExist: true }),
  callbackURL: config.getValue("callbackUrl", { mustExist: true }),
  requestTokenURL: "https://www.openstreetmap.org/oauth/request_token",
  accessTokenURL: "https://www.openstreetmap.org/oauth/access_token",
  userAuthorizationURL: "https://www.openstreetmap.org/oauth/authorize"
},
function (token, tokenSecret, profile, done) {
  debug("passport.use Token Function");

  // asynchronous verification, for effect...
  process.nextTick(function () {
    debug("passport.use Token Function->prozess.nextTick");

    // To keep the example simple, the user's OpenStreetMap profile is returned to
    // represent the logged-in user.  In a typical application, you would want
    // to associate the OpenStreetMap account with a user record in your database,
    // and return that user instead.
    return done(null, profile);
  });
}
));


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
        req.user.save({ noVersionIncrease: true }, function (err) {
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
