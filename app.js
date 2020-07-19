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

const fileUpload = require('express-fileupload');






// Initialise config Module and variables
config.initialise();
let htmlRoot = config.htmlRoot();
logger.info("Express Routes set to: SERVER" + htmlRoot);




var app = express();


app.locals.htmlroot = config.htmlRoot();
app.locals.appName  = config.getValue("AppName", {mustExist: true});
app.locals.path     = require("./routes/layout").path;
app.locals.stylesheet = config.getValue("style");
app.locals._path = path;




app.use(helmet());

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");



// compress all requests
app.use(compression());
app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));





// Initialise Morgan Logger, (and parser to log cookies)
app.use(cookieParser());


app.use(fileUpload({safeFileNames:true,preserveExtension:true,abortOnLimit:true,limits: { fileSize: 50 * 1024 * 1024 }}));


morgan.token("OSMUser", function (req) { return (req.user && req.user.OSMUser) ? req.user.OSMUser : "no user"; });


morgan.token('remote-addr', function (req) {
  return req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});

let logInfoTemplate = config.getValue("logInfoTemplate",{mustExist: true});

if (app.get("env") !== "test") {
  app.use(morgan(logInfoTemplate, { stream: logger.stream }));
}
if ((app.get("env") === "test") && (process.env.MOCHA_WITH_MORGAN === "TRUE")) {
  app.use(morgan(logInfoTemplate, { immediate:true }));
  app.use(function(req,res,next){
    console.info("Cookies: ",req.cookies);
    next();
  });
}


// first register the unsecured path, with no cookie need.

app.use(htmlRoot + "/bower_components/bootstrap", express.static(path.join(__dirname, "/node_modules/bootstrap")));
app.use(htmlRoot + "/bower_components/font-awesome", express.static(path.join(__dirname, "/node_modules/font-awesome")));
app.use(htmlRoot + "/bower_components/jquery", express.static(path.join(__dirname, "/node_modules/jquery")));
app.use(htmlRoot + "/bower_components/d3", express.static(path.join(__dirname, "/node_modules/d3")));
app.use(htmlRoot + "/bower_components/markdown-it", express.static(path.join(__dirname, "/node_modules/markdown-it")));
app.use(htmlRoot + "/bower_components/markdown-it-imsize", express.static(path.join(__dirname, "/node_modules/markdown-it-imsize")));
app.use(htmlRoot + "/bower_components/markdown-it-sup", express.static(path.join(__dirname, "/node_modules/markdown-it-sup")));
app.use(htmlRoot + "/bower_components/moment", express.static(path.join(__dirname, "/node_modules/moment")));


app.use(htmlRoot, express.static(path.join(__dirname, "public")));

app.use(htmlRoot, calendar);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.use(htmlRoot + "/api", api);
app.use(htmlRoot + "/slack", slackrouter);







// maxAge for not logged in user cookies is 10 minutes
let cookieMaxAge = 1000*60*10;



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

function renderLogin(req, res) {
  debug("renderLogin");
  res.render("login");
}
app.get(htmlRoot+"/login",renderLogin);

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

// layout does not render, but prepares the res.rendervar variable for
// dynamic contend in layout.pug
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
  var err = new Error("Page Not Found");
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


// test error handler
// will print stacktrace
if (app.get("env") === "test") {
  debug("Set test error hander");
  app.locals.pretty = true;
  /* jshint -W098 */
  app.use(function(err, req, res, next) {
    debug("app.use Error Handler for Debug");
    res.status(err.status || 500);
    logger.error("Error Message " + err.message);
    logger.error(err.stack);
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
  logger.info("Express Error Handler Function: Error Occured");
  logger.info("error object:" + JSON.stringify(err));
  res.status(err.status || 500);
  if (err.type && err.type === "API") return res.send(err.message);
  res.render("error", {
    message: (err) ? err.message : "no err object",
    error: { detail: (err) ? err.detail : "no err object" },
    layout: {htmlroot: htmlRoot}
  });
});
/* jshint +W098 */


module.exports = app;
