"use strict";

const debug = require("debug")("OSMBC:routes:auth");
const async = require("async");
const should = require("should");

const config = require("../config.js");
const logger = require("../config.js").logger;

const passport     = require("passport");
const OpenStreetMapStrategy = require("passport-openstreetmap").Strategy;

const userModule = require("../model/user.js");


var htmlRoot = config.htmlRoot();

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
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  debug("passport.deserializeUser CB");
  done(null, user);
});


// taken from https://github.com/jaredhanson/passport-openstreetmap/blob/master/examples/login/app.js
// Use the OpenStreetMapStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and OpenStreetMap profile), and
//   invoke a callback with a user object.


passport.use(new OpenStreetMapStrategy({
  consumerKey: config.getValue("OPENSTREETMAP_CONSUMER_KEY", {mustExist: true}),
  consumerSecret: config.getValue("OPENSTREETMAP_CONSUMER_SECRET", {mustExist: true}),
  callbackURL: config.getValue("callbackUrl", {mustExist: true})
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


function checkRole(role) {
  let roleArray = role;
  if (typeof role === "string") roleArray = [role];
  return function checkAuthentification (req, res, next) {
    debug("checkAuthentification");
    if (!req.isAuthenticated()) return next(new Error("Check Authentication runs in unauthenticated branch. Please inform your OSMBC Admin."));
    if (roleArray.indexOf(req.user.access) >= 0) return next();
    return next(new Error("OSM User >" + req.user.displayName + "< has not enough access rights"));
  };
}

function hasRole(role) {
  let roleArray = role;
  if (typeof role === "string") roleArray = [role];
  return function checkAuthentification (req, res, next) {
    debug("checkAuthentification");
    if (!req.isAuthenticated()) return next(new Error("Check Authentication runs in unauthenticated branch. Please inform your OSMBC Admin."));
    if (roleArray.indexOf(req.user.access) >= 0) return next();
    return next("route");
  };
}


function ensureAuthenticated (req, res, next) {
  debug("ensureAuthenticated");

  if (req.isAuthenticated()) {
    // if (req.user.displayName =="TheFive") return next();
    // check User
    userModule.find({OSMUser: req.user.displayName}, function(err, result) {
      debug("ensureAuthenticated->userFind");
      if (err) return next(err);
      if (result.length === 1) {
        for (var k in result[0]) {
          req.user[k] = result[0][k];
        }
        debug("User found");
        if ((result[0].access === "full") || (result[0].access === "guest")) {
          // save last access, ignore save callback
          var date = new Date();
          var lastStore = new Date(result[0].lastAccess);
          // only store last access when GETting something, not in POSTs.
          if (req.method === "GET" && (!result[0].lastAccess || (date.getTime() - lastStore.getTime()) > 1000 * 5)) {
            result[0].lastAccess = new Date();
            result[0].save({noVersionIncrease: true}, function(err) { if (err) return next(err); });
          }
          debug("User accepted");
          return next();
        }
      }
      debug("User Not Found %s(found)", result.length);
      should(result.length).lessThan(2);
      if (result.length === 1) {
        err = new Error("OSM User >" + req.user.displayName + "< has no access rights");
      }
      if (result.length === 0) {
        let osmname = req.user.displayName;
        req.user = userModule.create();
        req.user.OSMUser = osmname;
        req.user.access = "guest";
        return next();
      }
      return next(err);
    });
    return;
  }
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
    res.redirect(htmlRoot + "/auth/openstreetmap");
  });
}


module.exports.passport = passport;
module.exports.checkRole = checkRole;
module.exports.hasRole = hasRole;
module.exports.ensureAuthenticated = ensureAuthenticated;
