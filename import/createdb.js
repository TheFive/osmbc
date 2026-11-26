import async from "async";
import { program } from "commander";

import config from "../config.js";
import pgMap from "../model/pgMap.js";
import blogModule from "../model/blog.js";
import articleModule from "../model/article.js";
import logModule from "../model/logModule.js";
import userModule from "../model/user.js";
import configModule from "../model/config.js";
import session from "../model/session.js";
import linkModule from "../model/link.js";




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
  pgMap.analyseIndexes(pgObject, function(err, result) {
    if (err) return callback(err);
    if (pgOptions.verbose) {
      console.info("");
      console.info("Checking Table", pgObject.table);
      if (result.tableMissing) console.info(" Table missing (--updateIndex creates it)");
      const groups = { "Found indexes OK": result.foundOK, "Found indexes Need Update": result.foundNOK, "Missing indexes": result.expected, "Missing primary key": result.missingPrimaryKey,"Unnecessary indexes (kept)": result.foundUnnecessary };
      for (const title in groups) {
        console.info(" " + title);
        for (const k in groups[title]) console.info("  " + k + ": " + groups[title][k]);
      }
    }
    return callback(null, result);
  });
}



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
    function(done) { ct(session.pg, pgOptions, done); },
    function(done) { ct(linkModule.pg, pgOptions, done); }

  ], function(err) {
    if (err) {
      console.error("Error in Clear DB (createDB.js)");
      console.error(err);
    }
    callback(err);
  });
}

clearDB(pgOptions, function(err) {
  if (err) process.exit(1);
  if (!pgOptions.addUser) {
    console.info("Ready...");
    process.exit(0);
  }
  userModule.createNewUser({ OSMUser: pgOptions.addUser, access: "full" }, function (err, result) {
    if (err) {
      console.error("Error creating user (in createDB.js)");
      console.error(err);
      process.exit(1);
    }
    result.save(function (err) {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.info("User " + pgOptions.addUser + " created. Ready.");
      process.exit(0);
    });
  });
});
