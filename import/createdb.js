var config = require('../config.js');

var testutil = require('../test/testutil.js');

var program = require('commander');

program
  .option('--dropTable','Drop Table before Creation','')
  .option('--dropIndex','Drop Index before Creation','')
  .option('--dropView','Drop View before Creation','')
  .option('--createTable','Create all tables','')
  .option('--createView','Create all Views','')
  .option('--createIndex','Create all Index','')
  .option('--verbose','verbose option','')
  .parse(process.argv);

if (program.verbose) {
  console.log("Using NODE_ENV "+process.env.NODE_ENV);
}


config.initialise();

if (program.dropTable && process.env.NODE_ENV="production") {
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
  verbose:program.verbose
}

function clearDB(options,done) {

  var pgOptions = options;
  async.series([
    function(done) {config.initialise(done);},
    function(done) {pgMap.createTables(blogModule.pg,pgOptions,done);},
    function(done) {pgMap.createTables(articleModule.pg,pgOptions,done);},
    function(done) {pgMap.createTables(logModule.pg,pgOptions,done);},
    function(done) {pgMap.createTables(userModule.pg,pgOptions,done);},
    function(done) {pgMap.createTables(session.pg,pgOptions,done);},

  ],function(err) {
    if (err) console.dir(err);
    done();
  });
};

clearDB(option);
