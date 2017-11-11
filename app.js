"use strict";

var path         = require("path");

var express      = require("express");
var favicon      = require("serve-favicon");
var morgan       = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser   = require("body-parser");
var async        = require("async");

var debug        = require("debug")("OSMBC:app");
var passport     = require("passport");
var OpenStreetMapStrategy = require("passport-openstreetmap").Strategy;

var session      = require("express-session");
var compression  = require("compression");
var helmet       = require("helmet");

var pg           = require("pg");

var should       = require("should");

var config       = require("./config.js");

var index        = require("./routes/index").router;
var users        = require("./routes/users").router;
var article      = require("./routes/article").router;
var slackrouter  = require("./routes/slack").router;
var changes      = require("./routes/changes").router;
var blog         = require("./routes/blog").router;
var tool         = require("./routes/tool").router;
var calendar     = require("./routes/tool").publicRouter;
var api          = require("./routes/api").publicRouter;
var layout       = require("./routes/layout").router;
var configRouter = require("./routes/config").router;
var logger       = require("./config.js").logger;

var userModule   = require("./model/user.js");









// Initialise config Module
config.initialise();
var htmlRoot = config.getValue("htmlroot",{mustExist:true});
logger.info("Express Routes set to: SERVER" + htmlRoot);

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



function checkAuthentification (req, res, next) {
  debug("checkAuthentification");

  // Route / checks for authentification, so nothing has to be done,
  // just check authentification.
  // it is imporant, that the parallel ensureAutheticated function is used
  // BEFORE this easy funktion in the routes, to
  // avoid any login trouble.

  if (req.isAuthenticated()) return next();

  return next(new Error("Check Authentication runs in unauthenticated branch. Please inform your OSMBC Admin."));
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
        if (result[0].access === "full") {
          // save last access, ignore save callback
          var date = new Date();
          var lastStore = new Date(result[0].lastAccess);
          // only store last access when GETting something, not in POSTs.
          if (req.method === "GET" && (!result[0].lastAccess || (date.getTime() - lastStore.getTime()) > 1000 * 5)) {
            result[0].lastAccess = new Date();
            result[0].save({noVersionIncrease:true},function(err) { if (err) return next(err);});
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
        err = new Error("OSM User >" + req.user.displayName + "< is not an OSMBC user.");
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


// create a session store
let sessionstore = null;

if (config.getValue("sessionStore", {mustExist: true}) === "session-file-store") {
  var FileStore    = require("session-file-store")(session);
  sessionstore = new FileStore();
} else if (config.getValue("sessionStore", {mustExist: true}) === "connect-pg-simple") {
  var PgSession = require("connect-pg-simple")(session);

  sessionstore = new PgSession({
    pg: pg,        // Use global pg-module
    conString: config.pgstring // Connect using something else than default DATABASE_URL env variable
  });
}

var app = express();

app.use(helmet());

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");


function debugExpress(a) {
  var text = a;
  return function(req, res, next) { debug(text); next(); };
}

// compress all requests
app.use(debugExpress("Start Route"));
app.use(compression());
app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));


var cookieMaxAge = config.getValue("cookieMaxAge");

if (isNaN(cookieMaxAge)) {
  cookieMaxAge = null;
} else {
  cookieMaxAge = cookieMaxAge * 1000 * 60 * 60 * 24;
}


logger.info("Set Max Age of cookies to " + ((!cookieMaxAge) ? "default" : (cookieMaxAge / (1000 * 60 * 60 * 24) + " days")));



app.use(session(
  {
    store: sessionstore,
    name: config.getValue("SessionName", {mustExist: true}),
    secret: config.getValue("SessionSecret", {mustExist: true}),
    resave: true,
    saveUninitialized: true,
    cookie: {maxAge: cookieMaxAge}
  }
));


// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());

app.use(debugExpress("After passport.session"));




if (app.get("env") !== "test") {
  app.use(morgan("combined", { stream: logger.stream }));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(debugExpress("After cookieParser"));

// GET /auth/openstreetmap
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in OpenStreetMap authentication will involve redirecting
//   the user to openstreetmap.org.  After authorization, OpenStreetMap will redirect the user
//   back to this application at /auth/openstreetmap/callback
app.get(htmlRoot + "/auth/openstreetmap",
  passport.authenticate("openstreetmap"),
  function (req, res) {
    debug("never come here function!!!");
    debug(req);
    debug(res);
    // The request will be redirected to OpenStreetMap for authentication, so this
    // function will not be called.
  });

// GET /auth/openstreetmap/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(htmlRoot + "/auth/openstreetmap/callback",
  passport.authenticate("openstreetmap", {failureRedirect: "/login"}),
  function(req, res) {
    debug("passport.authenticate Function");
    res.redirect(req.session.returnTo || "/");
  });

app.get(htmlRoot + "/logout", function(req, res) {
  debug("logoutFunction");
  req.logout();
  res.redirect(htmlRoot+"/osmbc.html");
});

// first register the unsecured path

app.use(htmlRoot + "/bower_components", express.static(path.join(__dirname, "/bower_components")));
app.use(htmlRoot, express.static(path.join(__dirname, "public")));

app.use(htmlRoot, calendar);
app.use(htmlRoot + "/api", api);
app.use(htmlRoot + "/slack", slackrouter);

app.use(debugExpress("After Slack Initialisation"));
// layout does not render, but prepares the res.rendervar variable fro
// dynamic contend in layout.jade
app.use(htmlRoot + "/", ensureAuthenticated, layout);
app.use(htmlRoot + "/", checkAuthentification, index);
app.use(htmlRoot + "/usert", checkAuthentification, users);
app.use(htmlRoot + "/article", checkAuthentification, article);
app.use(htmlRoot + "/changes", checkAuthentification, changes);
app.use(htmlRoot + "/blog", checkAuthentification, blog);
app.use(htmlRoot + "/tool", checkAuthentification, tool);
app.use(htmlRoot + "/config", checkAuthentification, configRouter);

app.use(debugExpress("After different routes"));
// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.


// error handlers


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  debug("app.use Error Handler");
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});



// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  debug("Set development error hander");
  app.locals.pretty = true;
  /* jshint -W098 */
  app.use(function(err, req, res, next) {
    debug("app.use Error Handler for Debug");
    logger.error(err.toString());
    logger.error(err.stack);

    res.status(err.status || 500);
    if (err.type && err.type === "API") return res.send(err.message);
    res.render("error", {
      message: err.message,
      error: err,
      layout: {htmlroot: htmlRoot}
    });
  });
  /* jshint +W098 */
}


// development error handler
// will print stacktrace
if (app.get("env") === "test") {
  debug("Set test error hander");
  app.locals.pretty = true;
  /* jshint -W098 */
  app.use(function(err, req, res, next) {
    debug("app.use Error Handler for Debug");
    res.status(err.status || 500);
    logger.error("Error Message " + err.message);
    if (err.type && err.type === "API") return res.send(err.message+"\n"+JSON.stringify(err));
    res.render("error", {
      message: err.message,
      error: err,
      layout: {htmlroot: htmlRoot}
    });
  });
  /* jshint +W098 */
}

// production error handler
// no stacktraces leaked to user
/* jshint -W098 */
app.use(function(err, req, res, next) {
  debug("Set production error hander");
  debug("app.use status function");
  logger.info("Error Occured");
  logger.error(JSON.stringify(err));
  res.status(err.status || 500);
  if (err.type && err.type === "API") return res.send(err.message);
  res.render("error", {
    message: err.message,
    error: {},
    layout: {htmlroot: htmlRoot}
  });
});
/* jshint +W098 */


module.exports = app;
