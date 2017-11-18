"use strict";

const debug = require("debug")("OSMBC:routes:auth");
const async = require("async");

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
  done(null, user.displayName);
});


passport.deserializeUser(function (user, done) {
  debug("passport.deserializeUser CB");
  userModule.find({OSMUser: user}, function(err, result) {
    if (result.length === 1) return done(null, result[0]);
    if (result.length === 0) return done(null,null);
    if (result.length > 1) return done(null,null);
  });
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
    return next(new Error("OSM User >" + req.user.OSMUser + "< has not enough access rights"));
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
    if (req.user && req.user.access === "full") {
      var date = new Date();
      var lastStore = new Date(req.user.lastAccess);
      // only store last access when GETting something, not in POSTs.
      if (req.method === "GET" && (!req.user.lastAccess || (date.getTime() - lastStore.getTime()) > 1000 * 5)) {
        let stamp = new Date();
        req.user.lastAccess = stamp;
        req.session.lastAccess = stamp;
        req.user.save({noVersionIncrease: true}, function (err) {
          if (err) return next(err);
        });
      }
      return next();
    }
    if (req.user && req.user.OSMUser && req.user.access !== "full"){
      let err = new Error("OSM User >" + req.user.displayName + "< has no access rights");
      return next(err);
    }
    let err = new Error("OSM User >" + req.user.displayName + "< is not an OSMBC user.");
    return next(err);
  }
  // is not authenticated
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
