#!/usr/bin/env node

/**
 * Module dependencies.
 */

import http from "http";
import https from "https";
import { readFileSync } from "fs";

import { auto } from "async";

import stoppable from "stoppable";


import app from "../app.js";

import config from "../config.js";


import configModule from "../model/config.js";
import { startAllTimers } from "../model/blog.js";
import userModule from "../model/user.js";
import messageCenter from "../notification/messageCenter.js";
import { initialiseMailReceiver } from "../notification/mailReceiver.js";
import { initialiseSlackReceiver} from "../notification/slackReceiver.js";
import _debug from "debug";
const debug = _debug("OSMBC:server");

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || config.getServerPort());
app.set("port", port);


/* check node version */

if (process.version < "v16.1.1") {
  console.error("Node Version should be >= v16");
  process.exit(1);
}

/**
 * Create HTTP server.
 */
const options = {};
let httpServer = http;
if (config.getServerKey()) {
  httpServer = https;
  options.key = readFileSync(config.getServerKey());
  options.cert = readFileSync(config.getServerCert());
}


const server = stoppable(httpServer.createServer(options, app));

/**
 * Listen on provided port, on all network interfaces.
 */
function initialiseServer() {
  debug("initialiseServer");
  auto({
    configModule: configModule.initialise,
    blogModule: ["configModule", startBlogTimer],
    messageCenter: messageCenter.initialise,
    startMailReceiver: startMailReceiver,
    startSlackReceiver: ["configModule", startSlackReceiver]
  },
  function(err) {
    if (err) {
      config.logger.error(err);
      process.exit(1);
    }
    server.listen(port);
    server.on("error", onError);
    server.on("listening", onListening);
    config.logger.info("Server Listening on port " + port);
    const used = process.memoryUsage();
    for (const key in used) {
      config.logger.info(`${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
    }
  });
}

process.on("SIGINT", function() {
  config.logger.info("Received a stoprequest (SIGINT)");
  server.stop();
  process.exit();
});


initialiseServer();


// Initialise Mail Module with all users
function startMailReceiver(callback) {
  debug("startMailReceiver");
  userModule.find({ access: "IN('guest','full')" }, function initUsers(err, result) {
    if (err) {
      return callback(new Error("Error during User Initialising for Mail " + err.message));
    }
    initialiseMailReceiver(result);
    config.logger.info("Mail Receiver initialised.");
    return callback();
  });
}

function startSlackReceiver(param, callback) {
  debug("startSlackReceiver");

  initialiseSlackReceiver(callback);
}

function startBlogTimer(param, callback) {
  debug("startBlogTimer");

  // do not autoclose if this is switched of in config.
  if (config.getValue("AutoClose") === false) return callback();

  startAllTimers(function (err) {
    if (err) {
      config.logger.error(err);
      return callback(new Error("Error during Blog Timers Start " + err.message));
    }
    config.logger.info("Timer for Auto Close started");
    return callback();
  });
}


/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string"
    ? "Pipe " + port
    : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      config.logger.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      config.logger.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string"
    ? "pipe " + addr
    : "port " + addr.port;
  debug("Listening on " + bind);
}
