"use strict";
const pg = require("pg");
var config = require("../config.js");
var should = require("should");
var sqldebug  = require("debug")("OSMBC:model:sql");


let pgConfigValues = config.getValue("postgres", {mustexist: true});

should.exist(pgConfigValues.username);
should.exist(pgConfigValues.database);
should.exist(pgConfigValues.password);
should.exist(pgConfigValues.server);
should.exist(pgConfigValues.port);
var logger    = require("../config.js").logger;

if (pgConfigValues.connectStr && pgConfigValues.connectStr !== "") {
  logger.error("Database connectStr is deprecated, please remove from config");
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
  idleTimeoutMillis: 30000
};

// this initializes a connection pool
// it will keep idle connections open for 30 seconds
// and set a limit of maximum 10 idle clients
let pool = new pg.Pool(pgConfig);

// export the query method for passing queries to the pool
module.exports.query = function (text, values, callback) {
  if (typeof values === "function") {
    callback = values;
    values = undefined;
  }
  should.exist(callback);

  var startTime = new Date().getTime();
  sqldebug("SQL: start %s", text);
  pool.query(text, values, function(err, result) {
    var endTime = new Date().getTime();
    if (err) {
      sqldebug("SQL: [" + (endTime - startTime) / 1000 + "]( Result: ERROR)" + text);
      return callback(err);
    }
    sqldebug("SQL: [" + (endTime - startTime) / 1000 + "](" + ((result.rows) ? result.rows.length : 0) + " rows)" + text);
    return callback(null, result);
  });
};

// the pool also supports checking out a client for
// multiple operations, such as a transaction
module.exports.connect = function (callback) {
  return pool.connect(callback);
};

module.exports.fortestonly = {};
module.exports.fortestonly.testpool = function rebindPool() {
  let pool = new pg.Pool(pgConfig);
  return pool;
};
