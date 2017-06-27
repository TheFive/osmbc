"use strict";
const pg = require('pg');
var config = require("../config.js");
var should = require("should");
var sqldebug  = require("debug")("OSMBC:model:sql");

module.exports.longRunningQueries = {};

function compareLRQ(a, b) {
  return b.duration - a.duration;
}

function longRunningQueriesAdd(duration, query, table) {
  if (!exports.longRunningQueries[table]) exports.longRunningQueries[table] = [];
  let t = exports.longRunningQueries[table];


  if (t.length > 10) {
    if (t[9].duration > duration) return;
    t.pop();
  }

  t.push({duration: duration, query: query});
  t.sort(compareLRQ);
}


let pg_c = config.getValue("postgres",{mustexist:true});

should.exist(pg_c.username);
should.exist(pg_c.database);
should.exist(pg_c.password);
should.exist(pg_c.server);
should.exist(pg_c.port);
var logger    = require("../config.js").logger;

if (pg_c.connectStr && pg_c.connectStr !== "") {
  logger.error("Database connectStr is deprecated, please remove from config");
  process.exit(1);
}


// create a config to configure both pooling behavior
// and client options
// note: all config is optional and the environment variables
// will be read if the config is not present
var pg_config = {
  user: pg_c.username,
  database: pg_c.database,
  password: pg_c.password,
  host: pg_c.server,
  port: pg_c.port,
  max: 10,
  idleTimeoutMillis: 30000
};

//this initializes a connection pool
//it will keep idle connections open for 30 seconds
//and set a limit of maximum 10 idle clients
let pool = new pg.Pool(pg_config);

let query=pool.query("select count(*) from usert");

query.catch(function(err){
  logger.error(err);
  process.exit(1);
}).then(function() {});

pool.on('error', function (err) {
  // if an error is encountered by a client while it sits idle in the pool
  // the pool itself will emit an error event with both the error and
  // the client which emitted the original error
  // this is a rare occurrence but can happen if there is a network partition
  // between your application and the database, the database restarts, etc.
  // and so you might want to handle it and at least log it out
  console.error('idle client error', err.message, err.stack);
});

//export the query method for passing queries to the pool
module.exports.query = function (text, values, callback) {
  if (typeof values === "function") {
    callback = values;
    values = undefined;
  }
  should.exist(callback);

  var startTime = new Date().getTime();
  pool.query(text, values, function(err,result) {
    var endTime = new Date().getTime();
    if(err) {
      sqldebug("SQL: [" + (endTime - startTime) / 1000 + "]( Result: ERROR)" + text);
      return callback(err);
    }
    sqldebug("SQL: [" + (endTime - startTime) / 1000 + "](" + result.rows.length + " rows)" + text);
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
  let pool = new pg.Pool(pg_config);
  return pool;
};
