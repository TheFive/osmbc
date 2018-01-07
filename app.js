"use strict";

const path         = require("path");

const express      = require("express");
const favicon      = require("serve-favicon");
const morgan       = require("morgan");
const cookieParser = require("cookie-parser");
const bodyParser   = require("body-parser");

const debug        = require("debug")("OSMBC:app");

const session      = require("express-session");
const compression  = require("compression");

const helmet       = require("helmet");

const config       = require("./config.js");

const index        = require("./routes/index").router;
const users        = require("./routes/users").router;
const article      = require("./routes/article").router;
const slackrouter  = require("./routes/slack").router;
const changes      = require("./routes/changes").router;
const blog         = require("./routes/blog").router;
const tool         = require("./routes/tool").router;
const calendar     = require("./routes/tool").publicRouter;
const api          = require("./routes/api").publicRouter;
const layout       = require("./routes/layout").router;
const configRouter = require("./routes/config").router;
const logger       = require("./config.js").logger;
const auth         = require("./routes/auth.js");










// Initialise config Module and variables
config.initialise();
let htmlRoot = config.htmlRoot();
logger.info("Express Routes set to: SERVER" + htmlRoot);




var app = express();

app.use(helmet());

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");



// compress all requests
app.use(compression());
app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));




// Initialise Morgan Logger, (and parser to log cookies)
app.use(cookieParser());


morgan.token("OSMUser", function (req) { return (req.user && req.user.OSMUser) ? req.user.OSMUser : "no user"; });


morgan.token('remote-addr', function (req) {
  return req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});

if (app.get("env") !== "test") {
  app.use(morgan(":OSMUser :remote-addr :remote-user [:date[clf]] \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\"", { stream: logger.stream }));
}
if ((app.get("env") === "test") && (process.env.MOCHA_WITH_MORGAN === "TRUE")) {
  app.use(morgan(":OSMUser :remote-addr :remote-user [:date[clf]] \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\"", { immediate:true }));
  app.use(function(req,res,next){
    console.info("Cookies: ",req.cookies);
    next();
  });
}


// first register the unsecured path, with no cookie need.

app.use(htmlRoot + "/bower_components", express.static(path.join(__dirname, "/bower_components")));
app.use(htmlRoot, express.static(path.join(__dirname, "public")));

app.use(htmlRoot, calendar);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.use(htmlRoot + "/api", api);
app.use(htmlRoot + "/slack", slackrouter);





// Initialise Session Store and Cookie Max Age...


var cookieMaxAge = config.getValue("cookieMaxAge");

if (isNaN(cookieMaxAge)) {
  cookieMaxAge = null;
} else {
  cookieMaxAge = cookieMaxAge * 1000 * 60 * 60 * 24;
}


logger.info("Set Max Age of cookies to " + ((!cookieMaxAge) ? "default" : (cookieMaxAge / (1000 * 60 * 60 * 24) + " days")));

const sessionstore = require("./routes/sessionStore.js")(session);

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
app.use(auth.passport.initialize());
app.use(auth.passport.session());


// GET /auth/openstreetmap
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in OpenStreetMap authentication will involve redirecting
//   the user to openstreetmap.org.  After authorization, OpenStreetMap will redirect the user
//   back to this application at /auth/openstreetmap/callback
app.get(htmlRoot + "/auth/openstreetmap", auth.passport.authenticate("openstreetmap"));

// GET /auth/openstreetmap/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(htmlRoot + "/auth/openstreetmap/callback",
  auth.passport.authenticate("openstreetmap", {failureRedirect: "/login"}),
  function(req, res) {
    debug("after passport.authenticate Function");
    res.redirect(req.session.returnTo || "/");
  });

app.get(htmlRoot + "/logout", function(req, res) {
  debug("logoutFunction");
  req.logout();
  res.redirect(htmlRoot + "/osmbc.html");
});

// layout does not render, but prepares the res.rendervar variable fro
// dynamic contend in layout.jade
app.use(htmlRoot + "/", auth.ensureAuthenticated, layout);
app.use(htmlRoot + "/", index);
app.use(htmlRoot + "/usert", users);
app.use(htmlRoot + "/article", article);
app.use(htmlRoot + "/changes", changes);
app.use(htmlRoot + "/blog", blog);
app.use(htmlRoot + "/tool", tool);
app.use(htmlRoot + "/config", configRouter);


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
    if (err.type && err.type === "API") return res.send(err.message + "\n" + JSON.stringify(err));
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
