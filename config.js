"use strict";



var path     = require("path");
var fs       = require("fs");
var debug    = require("debug")("OSMBC:config");
var assert   = require("assert").strict;
var env      = process.env.NODE_ENV || "development";
var winston  = require("winston");





// Define simple first logger for winston

var logger;


// in test mode let transporter stream into nothing, as logging is not
// tested yet
if (process.env.NODE_ENV === "test" && process.env.TEST_LOG !== "TRUE") {
  logger = winston.createLogger({
    level: "info",
    transports: [
      new winston.transports.Stream({stream: fs.createWriteStream('/dev/null')})
    ]});
  } else {
  logger = winston.createLogger({
    level: 'info',
    format: winston.format.json()});

    logger.add(new winston.transports.Console({
      format: winston.format.simple()}));

}


logger.stream = {
  write: function(message) {
    logger.info(message.substring(0, message.length - 1));
  }
};



// the configurationfile should be in the "running" directory
var configurationFile = path.resolve(__dirname, "config." + env + ".json");
var configuration;
var configurationInitialised = false;




function getPostgresDBString() {
  debug("getPostgresDBString");
  configuration = exports.getConfiguration();
  var userString = "";
  if (configuration.postgres.username !== "") {
    userString = configuration.postgres.username + ":" + configuration.postgres.password + "@";
  }
  var connectStr = "postgres://" +
              userString +
              configuration.postgres.database;
  if ((typeof (configuration.postgres.connectstr) !== "undefined") &&
      (configuration.postgres.connectstr !== "")) {
    connectStr = configuration.postgres.connectstr;
  }
  if (!connectStr) {
    logger.error("Could not build a connection string for postgres. App is terminating");
    process.exit(1);
  }
  return connectStr;
}









exports.initialise = function initialise(callback) {
  if (configurationInitialised) {
    if (callback) callback();
    return;
  }
  debug("initialise");
  configurationInitialised = true;
  logger.info("Reading Config from: " + configurationFile);
  configuration = JSON.parse(fs.readFileSync(configurationFile));

  // Do some tests with the types

  configuration.languages.forEach(function(lang) {
    if (!configuration.moment_locale) configuration.moment_locale = {};
    if (configuration.moment_locale[lang]) return;
    configuration.moment_locale[lang] = lang;
  });

  assert.equal(typeof configuration.languages,"object");

  // Do some corrections, e.g. the languages MUST contain an "EN"

  if (configuration.languages.indexOf("EN") < 0) configuration.languages.push("EN");

  exports.pgstring = getPostgresDBString();
  if (callback) callback();
};



exports.getConfiguration = function() {
  exports.initialise();
  return configuration;
};
exports.getValue = function(key, options) {
  debug("getValue %s", key);
  exports.initialise();
  if (options) assert.equal(typeof (options),"object");
  var result;
  if (options) {
    result = options.default;
  }
  if (typeof (configuration[key]) !== "undefined") {
    result = configuration[key];
  }
  if (options && options.mustExist && typeof result === "undefined") {
    logger.error("Missing Value in config.*.json. Name: '" + key + "'");
    process.exit(1);
  }
  if (typeof result !== "undefined" && options && options.type && typeof result !== options.type) {
    logger.error("Value '" + key + "' does not have type " + options.type);
    process.exit(1);
  }

  if (options && options.deprecated && typeof result !== "undefined") {
    logger.error("Unnecessary Value in config.*.json. Name: '" + key + "'");
  }
  debug("getValue %s %s", key, result);
  return result;
};


const languages = exports.getValue("languages", {mustExist: true});
const htmlRoot = exports.getValue("htmlroot", {mustExist: true});
const url = exports.getValue("url", {mustExist: true});


exports.getLanguages = function() {
  return languages;
};

exports.htmlRoot = function() { return htmlRoot; };
exports.url = function() { return url; };

exports.moment_locale = function(lang) {
  return configuration.moment_locale[lang];
};




exports.getServerPort = function() {
  exports.initialise();
  return exports.getValue("serverport", {mustExist: true});
};

exports.getServerKey = function() {
  exports.initialise();
  return exports.getValue("serverkey");
}

exports.getServerCert = function() {
  exports.initialise();
  return exports.getValue("servercert");
}

exports.getCallbackUrl = function() {
  exports.initialise();
  return configuration.callbackUrl;
};

exports.env = env;
exports.logger = logger;



// deprecate Values
exports.getValue("diableOldEditor", {deprecated: true});
