
import path, { join } from "path";

import express from "express";
import favicon from "serve-favicon";
import morgan, { token } from "morgan";
import bodyParser from "body-parser";

import session from "express-session";
import compression from "compression";
import { renderFile } from "pug";
import { getReasonPhrase as _getReasonPhrase } from "http-status-codes";

import helmet, { contentSecurityPolicy, referrerPolicy, crossOriginEmbedderPolicy } from "helmet";
import { randomBytes } from "crypto";

import config from "./config.js";

import indexRouter from "./routes/index.js";
import { router as users } from "./routes/users.js";
import articleRouter from "./routes/article.js";
import slackRouter from "./routes/slack.js";
import changesRouter from "./routes/changes.js";
import blogRouter from "./routes/blog.js";
import toolRouter from "./routes/tool.js";
import publicApiRouter from "./routes/api.js";
import layoutRouter from "./routes/layout.js";
import configRouter from "./routes/config.js";
import auth from "./routes/auth.js";
import rateLimit from "express-rate-limit";

import fileUpload from "express-fileupload";
import _debug from "debug";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createSessionStore } from "./routes/sessionStore.js";
const debug = _debug("OSMBC:app");






// Initialise config Module and variables
config.initialise();
const htmlRoot = config.htmlRoot();
config.logger.info("Express Routes set to: SERVER" + htmlRoot);


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
app.locals.stylesheet = config.getValue("style");
app.locals._path = path;




app.use(helmet());
app.use(limiter);

// Initialise Helmet with Nonce for dynamic generated scripts
app.use((req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString("hex");
  if (app.get("env") === "test") res.locals.cspNonce = "Fixed Nonce for Test";

  const cspMiddleware = contentSecurityPolicy({
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
app.use(referrerPolicy({ policy: "same-origin" }));
app.use(crossOriginEmbedderPolicy({ policy: "credentialless" }));

// view engine setup
app.set("views", join(config.getDirName(), "views"));
app.set("view engine", "pug");



// compress all requests
app.use(compression());
app.use(favicon(join(config.getDirName(), "public", "images", "favicon.ico")));

// check for media folder foreward

const mediaFolder = config.getValue("media folder", { mustExist: true });

if (mediaFolder["externally mirrored"] === false) {
  app.use(mediaFolder.local, createProxyMiddleware({ target: mediaFolder.remote, changeOrigin: true }));
}






// app.use(cookieParser());


app.use(fileUpload({ safeFileNames: true, preserveExtension: true, abortOnLimit: true, limits: { fileSize: 50 * 1024 * 1024 } }));


token("OSMUser", function (req) { return (req.user && req.user.OSMUser) ? req.user.OSMUser : "no user"; });


token("remote-addr", function (req) {
  return req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
});

const logInfoTemplate = config.getValue("logInfoTemplate", { mustExist: true });

if (app.get("env") !== "test") {
  app.use(morgan(logInfoTemplate, { stream: config.logger.stream }));
}
if ((app.get("env") === "test") && (process.env.MOCHA_WITH_MORGAN === "TRUE")) {
  app.use(morgan(logInfoTemplate, { immediate: true }));
  app.use(function(req, res, next) {
    console.info("Cookies: ", req.cookies);
    return next();
  });
}


// first register the unsecured path, with no cookie need.


app.use(htmlRoot, express.static(join(config.getDirName(), "public")));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.use(htmlRoot + "/api", publicApiRouter);
app.use(htmlRoot + "/slack", slackRouter);







// maxAge for not logged in user cookies is 10 minutes
const cookieMaxAge = config.getValue("cookieMaxAge") * 1000 * 60 * 60 * 24;





config.logger.info("Set Max Age of cookies to " + ((!cookieMaxAge) ? "default" : (cookieMaxAge / (1000 * 60 * 60 * 24) + " days")));

const sessionstore = createSessionStore(session);


// only work with secure cookies, but it looks there are problems in production with it
// TheFive April 2023.
let secure = false;
if (process.env.NODE_ENV === "test") secure = false;

app.use(session(
  {
    store: sessionstore,
    name: config.getValue("SessionName", { mustExist: true }),
    secret: config.getValue("SessionSecret", { mustExist: true }),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: cookieMaxAge, secure: secure }
  }
));


// use CSRF to become more secure, but it looks not working
// may be get started together with test module (switch test to httpS) TheFive April 2023
// if (process.env.NODE_ENV !== "test") app.use(csrf());


// Initialise authenication stuff including passport

auth.initialise(app);



// layout does not render, but prepares the res.rendervar variable for
// dynamic contend in layout.pug
app.use(htmlRoot + "/", auth.ensureAuthenticated, layoutRouter);
app.use(htmlRoot + "/", indexRouter);
app.use(htmlRoot + "/usert", users);
app.use(htmlRoot + "/article", articleRouter.router);
app.use(htmlRoot + "/changes", changesRouter);
app.use(htmlRoot + "/blog", blogRouter);
app.use(htmlRoot + "/tool", toolRouter);
app.use(htmlRoot + "/config", configRouter);


// error handlers


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  debug("app.use Error Handler");
  const err = new Error("Page Not Found " + req.url);
  err.status = 404;
  return next(err);
});




app.use(function(err, req, res, next) {
  debug("Express Error Handler");
  if (res.headersSent) {
    return next(err);
  }
  config.logger.error("Logging Error Stack");
  config.logger.error("Error Message " + err.message);
  if (app.get("env") !== "production") {
    config.logger.error(err.stack);
  }
  res.status(err.status || 500);
  if (err.type && err.type === "API") return res.send(err.message);
  const prodErr = { message: err.message, status: err.status };
  try {
    const errHtml = renderFile(join(config.getDirName(), "views", "error.pug"),
      {
        message: err.message ?? "no err message",
        detail: err.detail ?? null,
        error: (app.get("env") !== "production") ? err : prodErr,
        nonce: res.locals.cspNonce,
        layout: layoutRouter.layoutConst,
        getReasonPhrase: _getReasonPhrase

      });
    res.set({
      "Content-Type": "text/html"
    });
    res.send(errHtml);
  } catch (err) {
    console.error("Application Error Handler failed");
    console.error(err);
  }
});




export default app;
