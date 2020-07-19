"use strict";

const { Pool } = require("pg");
var config = require("../config.js");
var assert = require("assert").strict;
var sqldebug  = require("debug")("OSMBC:model:sql");


const pgConfigValues = config.getValue("postgres", { mustexist: true });
const logTime = config.getValue("postgresLogStatements", { default: 1000 });


assert(pgConfigValues.username);
assert(pgConfigValues.database);
assert(typeof pgConfigValues.password !== "undefined");
assert(pgConfigValues.server);
assert(pgConfigValues.port);
var logger    = require("../config.js").logger;

if (pgConfigValues.connectstr && pgConfigValues.connectStr !== "") {
  logger.error("Database connectstr is deprecated, please remove from config");
  process.exit(1);
}


// create a config to configure both pooling behavior
// and client options
// note: all config is optional and the environment variables
// will be read if the config is not present
var pgConfig = {
  user: pgConfigValues.username,
  database: pgConfigValues.database,
  password: pgConfigValues.password,
  host: pgConfigValues.server,
  port: pgConfigValues.port,
  max: 10,
  connectionTimeoutMillis: 1000,
  idleTimeoutMillis: 1000
};

// this initializes a connection pool
// it will keep idle connections open for 30 seconds
// and set a limit of maximum 10 idle clients
let pool = null;

function getPool() {
  if (pool) return pool;
  pool = new Pool(pgConfig);
  pool.on("error", function(err, client) {
    console.error("There is an error in PG Pool / Problem with database");
    console.error(err);
    console.error("-------- client ----------------------");
    console.error(client);
    process.exit(1);
  });
  return pool;
}

let deep = 0;
// export the query method for passing queries to the pool
module.exports.query = function (text, values, callback) {
  if (typeof values === "function") {
    callback = values;
    values = undefined;
  }
  assert(callback);
  assert(typeof callback === "function");

  var startTime = new Date().getTime();
  sqldebug("SQL: start %s", text);
  function handleResult(err, result) {
    deep = deep - 1;
    var endTime = new Date().getTime();
    if (endTime - startTime > logTime) {
      logger.info("SQL: >>>>>>>>>> [" + (endTime - startTime) / 1000 + "] \n" + text + "\n");
      if (values) logger.info("SQL: VALUES " + JSON.stringify(values));
      logger.info("SQL: <<<<<<<<<< (" + deep + ")");
    }
    if (err) {
      if (err.message.indexOf("connect ECONNREFUSED") >= 0) {
        err.message = "\nError connecting to PSQL, is database started ? \n" + err.message;
      }
      sqldebug("SQL: [" + (endTime - startTime) / 1000 + "]( Result: ERROR)" + text);
      return callback(err);
    }
    sqldebug("SQL: [" + (endTime - startTime) / 1000 + "](" + ((result.rows) ? result.rows.length : 0) + " rows)" + text);
    return callback(null, result);
  }
  deep = deep + 1;
  if (values === undefined) {
    getPool().query(text, handleResult);
  } else {
    getPool().query(text, values, handleResult);
  }
};


module.exports.getPool = getPool;
