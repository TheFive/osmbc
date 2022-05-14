"use strict";

const async   = require("async");
const should  = require("should");
const pg      = require("pg");
const program = require("commander");



const config        = require("../config.js");
const pgMap         = require("../model/pgMap.js");
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


  var diff = jsdiff.diffWords(one, other);

  diff.forEach(function (part) {
    // green for additions, red for deletions
    // grey for common parts
    var color = part.added ? "green" :
      part.removed ? "red" : "grey";
    process.stderr.write(part.value[color]);
  });
  console.info();
}

program
  .option("--dropTable [table]","Drop specific table before creation","")
  .option("--dropTables","Drop Tables before Creation","")
  .option("--dropIndex","Drop Index before Creation","")
  .option("--dropView","Drop View before Creation","")
  .option("--createTables","Create all tables")
  .option("--createTable [table]","Create a specific table")
  .option("--createView","Create all Views","")
  .option("--createIndex","Create all Index","")
  .option("--verbose","verbose option","")
  .option("--dd","display table definition from database server","")
  .option("--updateIndex","bring Indexes updtodate (keep existing)","")
  .option("--addUser [user]","add user with full access to database","")
  .parse(process.argv);

if (program.verbose) {
  console.info("Using NODE_ENV " + config.env);
}


config.initialise();

if (program.dropTable && process.env.NODE_ENV === "production") {
  console.error("You are going to delete production tables, please do that manual in postgres");
  process.exit();
}

var pgOptions = {
  dropTables:program.dropTables,
  dropTable:program.dropTable,
  dropIndex:program.dropIndex,
  dropView:program.dropView,
  createTable:program.createTable,
  createTables:program.createTables,
  createView:program.createView,
  createIndex:program.createIndex,
  verbose:program.verbose,
  dd:program.dd,
  updateIndex:program.updateIndex
};


function analyseTable(pgObject, pgOptions,callback) {
  
  // first copy all expected indexes
  var expected = {};
  var foundOK = {};
  var foundNOK = {};
  var foundUnnecessary = {};
  var database = {};
  for (var k in pgObject.indexDefinition) {
    expected[k] = pgObject.indexDefinition[k];
  }
  pg.connect(config.pgstring,function(err,client,pgdone){
    var sql = "select indexname,indexdef from pg_indexes where tablename ='" + pgObject.table + "' and indexname not in (select conname from pg_constraint);";
    var query = client.query(sql);
    query.on("err",function(err){
      pgdone();
      return callback(err);
    });
    query.on("row",function(row){
      var index = row.indexname;
      var indexdef = row.indexdef;
      database[index] = indexdef;

      if (expected[index]) {
        var diff = jsdiff.diffWords(expected[index],indexdef);
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
    });
    query.on("end",function(){
      pgdone();
      var k;
      if (pgOptions.verbose) {
        console.info("");
        console.info("");
        console.info("Checking Table",pgObject.table);
        console.info(" Found indexes OK");
        for (k in foundOK) {
          console.info("  " + k);
        }
        console.info(" Found indexes Need Update");
        for (k in foundNOK) {

          console.info("  " + k + " Difference:");
          coloredDiffLog(foundNOK[k],database[k]);
        }
        console.info(" Missing indexes");
        for (k in expected) {
          console.info("  " + k);
          coloredDiffLog(expected[k],"");
        }
        console.info(" Unnecessary indexes");
        for (k in foundUnnecessary) {
          console.info("  " + k);
          coloredDiffLog("",foundUnnecessary[k]);
        }
      }
      var result = {
        foundOK:foundOK,
        foundNOK:foundNOK,
        foundUnnecessary:foundUnnecessary,
        expected:expected
      };

      return callback(null,result);
    });
  });
}



function clearDB(options,callback) {
  function ct(pgObject,pgOptions,done) {
    async.waterfall([
      function analyse(done) {analyseTable(pgObject,pgOptions,done);},
      function create(anaylse,done) {pgMap.createTables(pgObject,pgOptions,anaylse,done);}
    ],function finalFunction(err) {return done(err);});
  }

  var pgOptions = options;
  async.series([
    function(done) {config.initialise(done);},
    function(done) {ct(blogModule.pg,pgOptions,done);},
    function(done) {ct(articleModule.pg,pgOptions,done);},
    function(done) {ct(logModule.pg,pgOptions,done);},
    function(done) {ct(userModule.pg,pgOptions,done);},
    function(done) {ct(configModule.pg,pgOptions,done);},
    function(done) {ct(session.pg,pgOptions,done);},

  ],function(err) {
    if (err) console.dir(err);
    callback();
  });
}

clearDB(pgOptions,function(){
  if (program.addUser) {
    userModule.createNewUser({OSMUser: program.addUser, access: "full"}, function (err, result) {
      if (err) return console.error(err);
      result.save(function () {
        console.info("User " + program.addUser + " created. Ready.");
      });
    });
  } else {
    console.info("Ready...");
    process.exit(1);
  }
});

