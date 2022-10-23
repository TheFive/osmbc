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
const pug          = require("pug");
const HttpStatus   = require("http-status-codes");

const helmet       = require("helmet");
const crypto       = require("crypto");

const config       = require("./config.js");

const index        = require("./routes/index").router;
const users        = require("./routes/users").router;
const article      = require("./routes/article").router;
const slackrouter  = require("./routes/slack").router;
const changes      = require("./routes/changes").router;
const blog         = require("./routes/blog").router;
const tool         = require("./routes/tool").router;
const api          = require("./routes/api").publicRouter;
const layout       = require("./routes/layout").router;
const layoutConst  = require("./routes/layout").layoutConst;
const configRouter = require("./routes/config").router;
const logger       = require("./config.js").logger;
const auth         = require("./routes/auth.js");
const rateLimit    = require("express-rate-limit");

const fileUpload = require("express-fileupload");






// Initialise config Module and variables
config.initialise();
const htmlRoot = config.htmlRoot();
logger.info("Express Routes set to: SERVER" + htmlRoot);


const limitValues = config.getValue("limitValues", { mustExist: true });

const limitWindowMs = limitValues.limitWindowsMs ?? 15 * 60 * 1000;
const limitMaxCount = limitValues.limitMaxCount ?? 150;

const limiter = rateLimit({
  windowMs: limitWindowMs,
  max: limitMaxCount,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});


const app = express();


app.locals.htmlroot = config.htmlRoot();
app.locals.appName = config.getValue("AppName", { mustExist: true });
app.locals.path = require("./routes/layout").path;
app.locals.stylesheet = config.getValue("style");
app.locals._path = path;




app.use(helmet());
app.use(limiter);

// Initialise Helmet with Nonce for dynamic generated scripts
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("hex");
  if (app.get("env") === "test") res.locals.cspNonce = "Fixed Nonce for Test";

  const cspMiddleware = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      objectSrc: ["'none'"],
      imgSrc: ["*"],
      styleSrc: ["'self' 'unsafe-inline'"],
      upgradeInsecureRequests: [],
      scriptSrc: ["'self'", "'unsafe-inline'"], //, `'nonce-${res.locals.cspNonce}'`
      scriptSrcAttr: ["'self'", "'unsafe-inline'"] //, `'nonce-${res.locals.cspNonce}'`
    }
  });
  cspMiddleware(res, res, next);
});
app.use(helmet.referrerPolicy({ policy: "same-origin" }));
app.use(helmet.crossOriginEmbedderPolicy({ policy: "credentialless" }));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");



// compress all requests
app.use(compression());
app.use(favicon(path.join(__dirname, "public", "images", "favicon.ico")));

// check for media folder foreward

const mediaFolder = config.getValue("media folder", { mustExist: true });

if (mediaFolder["externally mirrored"] === false) {
  const { createProxyMiddleware } = require("http-proxy-middleware");
  app.use(mediaFolder.local, createProxyMiddleware({ target: mediaFolder.remote, changeOrigin: true }));
}






app.use(cookieParser());


app.use(fileUpload({ safeFileNames: true, preserveExtension: true, abortOnLimit: true, limits: { fileSize: 50 * 1024 * 1024 } }));


morgan.token("OSMUser", function (req) { return (req.user && req.user.OSMUser) ? req.user.OSMUser : "no user"; });


morgan.token("remote-addr", function (req) {
  return req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
});

const logInfoTemplate = config.getValue("logInfoTemplate", { mustExist: true });

if (app.get("env") !== "test") {
  app.use(morgan(logInfoTemplate, { stream: logger.stream }));
}
if ((app.get("env") === "test") && (process.env.MOCHA_WITH_MORGAN === "TRUE")) {
  app.use(morgan(logInfoTemplate, { immediate: true }));
  app.use(function(req, res, next) {
    console.info("Cookies: ", req.cookies);
    next();
  });
}


// first register the unsecured path, with no cookie need.


app.use(htmlRoot, express.static(path.join(__dirname, "public")));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.use(htmlRoot + "/api", api);
app.use(htmlRoot + "/slack", slackrouter);







// maxAge for not logged in user cookies is 10 minutes
const cookieMaxAge = config.getValue("cookieMaxAge") * 1000 * 60 * 60 * 24;





logger.info("Set Max Age of cookies to " + ((!cookieMaxAge) ? "default" : (cookieMaxAge / (1000 * 60 * 60 * 24) + " days")));

const sessionstore = require("./routes/sessionStore.js")(session);

app.use(session(
  {
    store: sessionstore,
    name: config.getValue("SessionName", { mustExist: true }),
    secret: config.getValue("SessionSecret", { mustExist: true }),
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: cookieMaxAge }
  }
));


// Initialise authenication stuff including passport

auth.initialise(app);



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
  const err = new Error("Page Not Found " + req.url);
  err.status = 404;
  next(err);
});




app.use(function(err, req, res, next) {
  debug("Express Error Handler");
  logger.error("Error Message " + err.message);
  if (app.get("env") !== "production") {
    logger.error(err.stack);
  }
  res.status(err.status || 500);
  if (err.type && err.type === "API") return res.send(err.message);
  const prodErr = { message: err.message, status: err.status };
  try {
    const errHtml = pug.renderFile(path.join(__dirname, "views", "error.pug"),
      {
        message: err.message ?? "no err message",
        detail: err.detail ?? null,
        error: (app.get("env") !== "production") ? err : prodErr,
        nonce: res.locals.cspNonce,
        layout: layoutConst,
        getReasonPhrase: HttpStatus.getReasonPhrase

      });
    res.send(errHtml);
  } catch (err) { console.error(err); }
});




module.exports = app;
