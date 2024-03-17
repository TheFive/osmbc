
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { strict as assert } from "assert";
import winston from "winston";
import _debug from "debug";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const debug = _debug("OSMBC:config");

const env      = process.env.NODE_ENV || "development";


let pgstring;



// Define simple firstconfig.logger for winston

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
  const conf = getValue("postgres");
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
  return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
}




function initialise(callback) {
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



  pgstring = getPostgresDBString();
  if (callback) callback();
};



function getConfiguration() {
  assert(false, "Function obsolote use single values");
  initialise();
  return configuration;
};

function getValue(key, options) {
  debug("getValue %s", key);
  initialise();
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


const languages = getValue("languages", { mustExist: true });
const _htmlRoot = getValue("htmlroot", { mustExist: true });
const _url =  getValue("url", { mustExist: true });


function getLanguages() {
  assert(false, "OSMBC Error Function obsolote");
  return languages;
};

function htmlRoot() { return _htmlRoot; };
function url() { return _url; };

function momentLocale(lang) {
  assert(false, "Function obsolote");
  return configuration.moment_locale[lang];
};




function getServerPort() {
  initialise();
  return getValue("serverport", { mustExist: true });
};

function getServerHostname() {
  initialise();
  return getValue("serverhostname");
}

function getServerKey() {
  initialise();
  return getValue("serverkey");
};

function getServerCert() {
  initialise();
  return getValue("servercert");
};

function getCallbackUrl() {
  initialise();
  return configuration.callbackUrl;
};



// deprecate Values
getValue("diableOldEditor", { deprecated: true });


const config = {
  getValue: getValue,
  env: env,
  logger: logger,
  getConfiguration: getConfiguration,
  getPGString: () => { return pgstring; },
  getLanguages: getLanguages,
  htmlRoot: htmlRoot,
  url: url,
  momentLocale: momentLocale,
  getServerPort: getServerPort,
  getServerKey: getServerKey,
  getServerCert: getServerCert,
  getCallbackUrl: getCallbackUrl,
  initialise: initialise,
  getDirName: () => { return __dirname; },
  getServerHostname: getServerHostname
};

export default config;
