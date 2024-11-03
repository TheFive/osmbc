import async from "async";
import { program } from "commander";

import config from "../config.js";
import pgMap from "../model/pgMap.js";
import db from "../model/db.js";
import blogModule from "../model/blog.js";
import articleModule from "../model/article.js";
import logModule from "../model/logModule.js";
import userModule from "../model/user.js";
import configModule from "../model/config.js";
import session from "../model/session.js";




program
  .option("--dropTable [table]", "Drop specific table before creation", "")
  .option("--dropTables", "Drop Tables before Creation", "")
  .option("--dropIndex", "Drop Index before Creation", "")
  .option("--dropView", "Drop View before Creation", "")
  .option("--createTables", "Create all tables")
  .option("--createTable [table]", "Create a specific table")
  .option("--createView", "Create all Views", "")
  .option("--createIndex", "Create all Index", "")
  .option("--verbose", "verbose option", "")
  .option("--dd", "display table definition from database server", "")
  .option("--updateIndex", "bring Indexes updtodate (keep existing)", "")
  .option("--addUser [user]", "add user with full access to database", "")
  .parse(process.argv);

const options = program.opts();

if (options.verbose) {
  console.info("Using NODE_ENV " + config.env);
}


config.initialise();

if (options.dropTable && process.env.NODE_ENV === "production") {
  console.error("You are going to delete production tables, please do that manual in postgres");
  process.exit();
}

const pgOptions = {
  dropTables: options.dropTables,
  dropTable: options.dropTable,
  dropIndex: options.dropIndex,
  dropView: options.dropView,
  createTable: options.createTable,
  createTables: options.createTables,
  createView: options.createView,
  createIndex: options.createIndex,
  verbose: options.verbose,
  dd: options.dd,
  updateIndex: options.updateIndex,
  addUser: options.addUser
};


function analyseTable(pgObject, pgOptions, callback) {
  // first copy all expected indexes
  const expected = {};
  for (const k in pgObject.indexDefinition) {
    expected[k] = pgObject.indexDefinition[k];
  }

  const pool = db.getPool();
  pool.connect(function(err, client, pgdone) {
    if (err) {
      console.error("Can not connect to DB. " + err);
      process.exit(1);
    }
    // const query = client.query(new pg.Query(sql));
  });
};



function clearDB(options, callback) {
  function ct(pgObject, pgOptions, done) {
    async.waterfall([
      function analyse(done) { analyseTable(pgObject, pgOptions, done); },
      function create(anaylse, done) { pgMap.createTables(pgObject, pgOptions, anaylse, done); }
    ], function finalFunction(err) { return done(err); });
  }

  const pgOptions = options;
  async.series([
    function(done) { config.initialise(done); },
    function(done) { ct(blogModule.pg, pgOptions, done); },
    function(done) { ct(articleModule.pg, pgOptions, done); },
    function(done) { ct(logModule.pg, pgOptions, done); },
    function(done) { ct(userModule.pg, pgOptions, done); },
    function(done) { ct(configModule.pg, pgOptions, done); },
    function(done) { ct(session.pg, pgOptions, done); }

  ], function(err) {
    if (err) {
      console.error("Error in Clear DB (createDB.js)");
      console.error(err);
    }
    callback();
  });
}

clearDB(pgOptions, function() {
  if (pgOptions.addUser) {
    userModule.createNewUser({ OSMUser: pgOptions.addUser, access: "full" }, function (err, result) {
      if (err) {
        console.error("Error Clearing Database (in createDB.js)");
        console.error(err);
        return (err);
      }
      result.save(function () {
        console.info("User " + pgOptions.addUser + " created. Ready.");
      });
    });
  } else {
    console.info("Ready...");
    process.exit(1);
  }
});

