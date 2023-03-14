"use strict";

const async   = require("async");
const should  = require("should");
const program = require("commander");



const config        = require("../config.js");
const pgMap         = require("../model/pgMap.js");
const db            = require("../model/db.js");
const blogModule    = require("../model/blog.js");
const articleModule = require("../model/article.js");
const logModule     = require("../model/logModule.js");
const userModule    = require("../model/user.js");
const configModule  = require("../model/config.js");
const session       = require("../model/session.js");


const jsdiff = require("diff");

function coloredDiffLog(one, other) {
  should(typeof (one) === "string");
  should(typeof (other) === "string");


  const diff = jsdiff.diffWords(one, other);

  diff.forEach(function (part) {
    // green for additions, red for deletions
    // grey for common parts
    const color = part.added
      ? "green"
      : part.removed ? "red" : "grey";
    console.info(part.value[color]);
  });
  console.info();
}

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
  const foundOK = {};
  const foundNOK = {};
  const foundUnnecessary = {};
  const database = {};
  for (const k in pgObject.indexDefinition) {
    expected[k] = pgObject.indexDefinition[k];
  }

  const pool = db.getPool();
  pool.connect(function(err, client, pgdone) {
    if (err) {
      console.error("Can not connect to DB. " + err);
      process.exit(1);
    }
    const sql = "select indexname,indexdef from pg_indexes where tablename ='" + pgObject.table + "' and indexname not in (select conname from pg_constraint);";
    // const query = client.query(new pg.Query(sql));
    const query = client.query(sql, function (err, res) {
    if (err) {
      pgdone();
      return callback(err);
    };
    for (var row of res.rows) {
      const index = row.indexname;
      const indexdef = row.indexdef;
      database[index] = indexdef;

      if (expected[index]) {
        const diff = jsdiff.diffWords(expected[index], indexdef);
        if (diff.length == 1 && !diff[0].added && !diff[0].removed) {
          // index is the same in DB than expected
          foundOK[index] = expected[index];
          delete expected[index];
        } else {
          foundNOK[index] = expected[index];
          delete expected[index];
        }
      } else {
        foundUnnecessary[index] = indexdef;
      }
    };
    pgdone();
    let k;
    if (pgOptions.verbose) {
      console.info("");
      console.info("");
      console.info("Checking Table", pgObject.table);
      console.info(" Found indexes OK");
      for (k in foundOK) {
        console.info("  " + k);
      }
      console.info(" Found indexes Need Update");
      for (k in foundNOK) {
        console.info("  " + k + " Difference:");
        coloredDiffLog(foundNOK[k], database[k]);
      }
      console.info(" Missing indexes");
      for (k in expected) {
        console.info("  " + k);
        coloredDiffLog(expected[k], "");
      }
      console.info(" Unnecessary indexes");
      for (k in foundUnnecessary) {
        console.info("  " + k);
        coloredDiffLog("", foundUnnecessary[k]);
      }
    }
    const result = {
      foundOK: foundOK,
      foundNOK: foundNOK,
      foundUnnecessary: foundUnnecessary,
      expected: expected
    };
    return callback(null, result);
  });
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
        return(err);
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

