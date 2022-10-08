"use strict";



const path     = require("path");
const fs       = require("fs");
const debug    = require("debug")("OSMBC:config");
const assert   = require("assert").strict;
const env      = process.env.NODE_ENV || "development";
const winston  = require("winston");





// Define simple first logger for winston

let logger;


// in test mode let transporter stream into nothing, as logging is not
// tested yet
if (process.env.NODE_ENV === "test" && process.env.TEST_LOG !== "TRUE") {
  logger = winston.createLogger({
    level: "info",
    transports: [
      new winston.transports.Stream({ stream: fs.createWriteStream("/dev/null") })
    ]
  });
} else {
  logger = winston.createLogger({
    level: "info",
    format: winston.format.json()
  });

  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}


logger.stream = {
  write: function(message) {
    logger.info(message.substring(0, message.length - 1));
  }
};



// the configurationfile should be in the "running" directory
const configurationFile = path.resolve(__dirname, "config." + env + ".json");
let configuration;




function getPostgresDBString() {
  debug("getPostgresDBString");
  const conf = exports.getValue("postgres");
  let userString = "";
  if (conf.username !== "") {
    userString = conf.username + ":" + conf.password + "@";
  }
  let connectStr = "postgres://" +
              userString +
              conf.database;
  if ((typeof (conf.connectstr) !== "undefined") &&
      (conf.connectstr !== "")) {
    connectStr = conf.connectstr;
  }
  if (!connectStr) {
    logger.error("Could not build a connection string for postgres. App is terminating");
    process.exit(1);
  }
  return connectStr;
}




function getCurrentGitBranch() {
  const { execSync } = require("child_process");
  return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
}




exports.initialise = function initialise(callback) {
  if (typeof configuration !== "undefined") {
    if (callback) callback();
    return;
  }
  debug("initialise");
  logger.info("Reading Config from: " + configurationFile);
  configuration = JSON.parse(fs.readFileSync(configurationFile));

  // add or exchange some branch dependent configs
  if (env === "development") {
    let gitBranch = getCurrentGitBranch();
    console.log("Git Branch " + gitBranch);
    gitBranch = gitBranch.replace("/", "_");
    if (typeof gitBranch === "string") {
      try {
        const configBranch = JSON.parse(fs.readFileSync("config." + gitBranch + ".json"));
        for (const k in configBranch) {
          configuration[k] = configBranch[k];
        }
      } catch (err) {
        logger.info("No additional file config." + gitBranch + ".json");
      }
    }
  }


  // Do some tests with the types

  configuration.languages.forEach(function(lang) {
    if (!configuration.moment_locale) configuration.moment_locale = {};
    if (configuration.moment_locale[lang]) return;
    configuration.moment_locale[lang] = lang;
  });

  assert.equal(typeof configuration.languages, "object");



  exports.pgstring = getPostgresDBString();
  if (callback) callback();
};



exports.getConfiguration = function() {
  assert(false, "Function obsolote use single values");
  exports.initialise();
  return configuration;
};
exports.getValue = function(key, options) {
  debug("getValue %s", key);
  exports.initialise();
  if (options) assert.equal(typeof (options), "object");
  let result;
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
  if (options && options.checkFunction && options.checkFunction(result) === false) {
    logger.error("Check Function Fail in config.*.json. Name: '" + key + "'");
    process.exit(1);
  }
  if (options && options.deprecated && typeof result !== "undefined") {
    logger.error("Deprecated Value in config.*.json. Name: '" + key + "'");
    process.exit(1);
  }
  // eslint-disable-next-line valid-typeof
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


const languages = exports.getValue("languages", { mustExist: true });
const htmlRoot = exports.getValue("htmlroot", { mustExist: true });
const url = exports.getValue("url", { mustExist: true });


exports.getLanguages = function() {
  assert(false, "OSMBC Error Function obsolote");
  return languages;
};

exports.htmlRoot = function() { return htmlRoot; };
exports.url = function() { return url; };

exports.moment_locale = function(lang) {
  assert(false, "Function obsolote");
  return configuration.moment_locale[lang];
};




exports.getServerPort = function() {
  exports.initialise();
  return exports.getValue("serverport", { mustExist: true });
};

exports.getServerKey = function() {
  exports.initialise();
  return exports.getValue("serverkey");
};

exports.getServerCert = function() {
  exports.initialise();
  return exports.getValue("servercert");
};

exports.getCallbackUrl = function() {
  exports.initialise();
  return configuration.callbackUrl;
};

exports.env = env;
exports.logger = logger;



// deprecate Values
exports.getValue("diableOldEditor", { deprecated: true });
