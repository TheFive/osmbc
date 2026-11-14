
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { strict as assert } from "assert";
import winston from "winston";
import _debug from "debug";
import { load as yamlLoad } from "js-yaml";
import packageJson from "./package.json" with { type: "json" };
import { mergeConfigs } from "./util/configSplit.js";

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



// config.<env>.yaml is read from the app directory, or from OSMBC_CONFIG_DIR
// if set (e.g. /etc/osmbc, so the app directory can stay read-only)
const configurationBaseName = "config." + env;
const configurationDir = process.env.OSMBC_CONFIG_DIR ? path.resolve(process.env.OSMBC_CONFIG_DIR) : __dirname;
let configuration;

function parseConfigFile(fileName, fileContent) {
  if (fileName.endsWith(".json")) return JSON.parse(fileContent);
  if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
    const parsed = yamlLoad(fileContent);
    return parsed || {};
  }
  throw new Error("Unsupported config file type: " + fileName);
}

function readConfigByBaseName(baseName, dirName = __dirname) {
  const candidates = [
    path.resolve(dirName, baseName + ".yaml"),
    path.resolve(dirName, baseName + ".yml"),
    path.resolve(dirName, baseName + ".json")
  ];
  for (const fileName of candidates) {
    if (!fs.existsSync(fileName)) continue;
    const fileContent = fs.readFileSync(fileName, "UTF8");
    return {
      fileName,
      data: parseConfigFile(fileName, fileContent)
    };
  }
  return null;
}




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




function initialise(callback) {
  if (typeof configuration !== "undefined") {
    if (callback) callback();
    return;
  }
  debug("initialise");
  const baseConfig = readConfigByBaseName(configurationBaseName, configurationDir);
  if (!baseConfig) {
    logger.error("No config file found for " + configurationBaseName + " (yaml/yml/json) in " + configurationDir);
    process.exit(1);
  }
  logger.info("Reading Config from: " + baseConfig.fileName);
  configuration = baseConfig.data;

  // optional second file with the editorial settings, see util/configSplit.js
  if (configuration.editorial_config) {
    const editorialFile = path.resolve(configurationDir, configuration.editorial_config);
    let editorial;
    try {
      editorial = parseConfigFile(editorialFile, fs.readFileSync(editorialFile, "UTF8"));
    } catch (err) {
      logger.error("Could not read editorial config (editorial_config) " + editorialFile + ": " + err.message);
      process.exit(1);
    }
    logger.info("Reading editorial Config from: " + editorialFile);
    const merged = mergeConfigs(configuration, editorial);
    if (merged.conflicts.length > 0) {
      logger.error("Values set in both config files, remove them from one: " + merged.conflicts.join(", "));
      process.exit(1);
    }
    configuration = merged.config;
  }

  // per test run overrides, set by tools/run-tests.mjs so that several
  // test runs (worktrees) can run in parallel without sharing port, DB or files
  if (env === "test") {
    if (process.env.OSMBC_TEST_PORT) configuration.serverport = Number(process.env.OSMBC_TEST_PORT);
    if (process.env.OSMBC_TEST_DB) configuration.postgres.database = process.env.OSMBC_TEST_DB;
    if (process.env.OSMBC_TEST_TMPDIR) {
      configuration.maillog_directory = process.env.OSMBC_TEST_TMPDIR;
      configuration.exportlog_directory = process.env.OSMBC_TEST_TMPDIR;
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

function getValue(key, subkey, options) {
  debug("getValue %s", key);
  initialise();
  if (typeof subkey === "object") {
    options = subkey;
    subkey = null;
  }
  if (options) assert.equal(typeof (options), "object");
  let result;
  if (options) {
    result = options.default;
  }
  if (typeof (configuration[key]) !== "undefined") {
    result = configuration[key];
  }
  if (result && subkey) {
    result = result[subkey];
  }
  if (options && options.mustExist && typeof result === "undefined") {
    logger.error("Missing Value in config.*.(yaml|yml|json). Name: '" + key + (subkey ? "." + subkey : "") + "'");
    process.exit(1);
  }
  if (options && options.checkFunction && options.checkFunction(result) === false) {
    logger.error("Check Function Fail in config.*.(yaml|yml|json). Name: '" + key + "'");
    process.exit(1);
  }
  if (options && options.deprecated && typeof result !== "undefined") {
    logger.error("Deprecated Value in config.*.(yaml|yml|json). Name: '" + key + "'");
    process.exit(1);
  }
  // eslint-disable-next-line valid-typeof
  if (typeof result !== "undefined" && options && options.type && typeof result !== options.type) {
    logger.error("Value '" + key + "' does not have type " + options.type);
    process.exit(1);
  }

  if (options && options.deprecated && typeof result !== "undefined") {
    logger.error("Unnecessary Value in config.*.(yaml|yml|json). Name: '" + key + "'");
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

// Directories OSMBC writes into at runtime. Default inside the app
// directory; set them to move all runtime data out of it. Relative
// paths are resolved against the app directory.
function getCacheDir() {
  return path.resolve(__dirname, getValue("cache_directory", { default: "cache" }));
}

function getProfileDir() {
  return path.resolve(__dirname, getValue("profile_directory", { default: path.join("public", "profile") }));
}



// deprecate Values
getValue("diableOldEditor", { deprecated: true });


const config = {
  getValue: getValue,
  env: env,
  logger: logger,
  version: packageJson.version,
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
  getConfigDir: () => { return configurationDir; },
  getCacheDir: getCacheDir,
  getProfileDir: getProfileDir,
  getServerHostname: getServerHostname
};

export default config;
