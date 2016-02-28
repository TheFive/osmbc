"use strict";

var config = require('../config.js');
var async  = require('async');


var pg = require('pg');
var pgMap = require('../model/pgMap.js');

var blogModule = require('../model/blog.js');
var articleModule = require('../model/article.js');
var logModule = require('../model/logModule.js');
var userModule = require('../model/user.js');
var session = require('../model/session.js');
var should = require('should');

var program = require('commander');

require('colors')
var jsdiff = require('diff');

function coloredDiffLog(one,other) {
  should(typeof(one)=="string");
  should(typeof(other)=="string");


  var diff = jsdiff.diffWords(one, other);

  diff.forEach(function (part) {
    // green for additions, red for deletions
    // grey for common parts
    var color = part.added ? 'green' :
      part.removed ? 'red' : 'grey';
    process.stderr.write(part.value[color]);
  });
  console.log()
}

program
  .option('--dropTable','Drop Table before Creation','')
  .option('--dropIndex','Drop Index before Creation','')
  .option('--dropView','Drop View before Creation','')
  .option('--createTable','Create all tables','')
  .option('--createView','Create all Views','')
  .option('--createIndex','Create all Index','')
  .option('--verbose','verbose option','')
  .option('--dd','display table definition from database server','')
  .option('--updateIndex','bring Indexes updtodate (keep existing)','')
  .parse(process.argv);

if (program.verbose) {
  console.log("Using NODE_ENV "+config.env);
}


config.initialise();

if (program.dropTable && process.env.NODE_ENV==="production") {
  console.log("You are going to delete production tables, please do that manual in postgres");
  process.exit();
}

var pgOptions = {
  dropTable:program.dropTable,
  dropIndex:program.dropIndex,
  dropView:program.dropView,
  createTable:program.createTable,
  createView:program.createView,
  createIndex:program.createIndex,
  verbose:program.verbose,
  dd:program.dd,
  updateIndex:program.updateIndex
};

function analyseTable(pgObject,pgOptions,callback) {
  // first copy all expected indexes
  var expected = {};
  var foundOK = {};
  var foundNOK = {};
  var foundUnnecessary = {};
  var database = {}
  for (var k in pgObject.indexDefinition) {
    expected[k]=pgObject.indexDefinition[k];
  }
  pg.connect(config.pgstring,function(err,client,pgdone){
    var sql = "select indexname,indexdef from pg_indexes where tablename ='"+pgObject.table+"';";
    var query = client.query(sql);
    query.on("err",function(err){
      pgdone();
      return callback(err);
    });
    query.on("row",function(row){
      var index = row.indexname;
      var indexdef = row.indexdef;
      database[index]= indexdef;

      if (expected[index]) {
        var diff = jsdiff.diffWords(expected[index],indexdef);
        if (diff.length==1 && !diff[0].added && !diff[0].removed) {
          // index is the same in DB than expected
          foundOK[index]=expected[index];
          delete expected[index];
        } else {
          foundNOK[index]=expected[index];
          delete expected[index];
        }
      } else {
        foundUnnecessary[index]= indexdef;
      }
    });
    query.on("end",function(){
      pgdone();
      if (pgOptions.verbose) {
        console.log("");
        console.log("");
        console.log("Checking Table",pgObject.table);
        console.log(" Found indexes OK");
        for (var k in foundOK) {
          console.log("  "+k);
        }
        console.log(" Found indexes Need Update");
        for (var k in foundNOK) {

          console.log("  "+k+" Difference:")
          coloredDiffLog(foundNOK[k],database[k]);
        }
        console.log(" Missing indexes");
        for (var k in expected) {
          console.log("  "+k);
          coloredDiffLog(expected[k],"");
        }
        console.log(" Unnecessary indexes");
        for (var k in foundUnnecessary) {
          console.log("  "+k);
          coloredDiffLog("",foundUnnecessary[k]);
        }
      }
      var result ={
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
    function(done) {ct(session.pg,pgOptions,done);},

  ],function(err) {
    if (err) console.dir(err);
    callback();
  });
}

clearDB(pgOptions,function(){
  console.log("Ready...");
  process.exit(1);
});
