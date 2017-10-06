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



const config       = require("./config.js");
const logger       = require("./config.js").logger;


const auth         = require("./routes/auth.js");
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




// Initialise config Module
config.initialise();
var htmlRoot = config.htmlRoot();
logger.info("Express Routes set to: SERVER" + htmlRoot);





var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");



// compress all requests
app.use(compression());
app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));


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




if (app.get("env") !== "test") {
  app.use(morgan("combined", { stream: logger.stream }));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

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
app.get(htmlRoot + "/auth/openstreetmap/callback", auth.passport.authenticate("openstreetmap", {failureRedirect: "/login"}),
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

// layout does not render, but prepares the res.rendervar variable fro
// dynamic contend in layout.jade
app.use(htmlRoot + "/", auth.ensureAuthenticated, layout);
app.use(htmlRoot + "/", auth.checkAuthentification, index);
app.use(htmlRoot + "/usert", auth.checkAuthentification, users);
app.use(htmlRoot + "/article", auth.checkAuthentification, article);
app.use(htmlRoot + "/changes", auth.checkAuthentification, changes);
app.use(htmlRoot + "/blog", auth.checkAuthentification, blog);
app.use(htmlRoot + "/tool", auth.checkAuthentification, tool);
app.use(htmlRoot + "/config", auth.checkAuthentification, configRouter);


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
