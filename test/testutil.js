var pg = require('pg');
var should = require('should');
var async  = require('async');
var debug  = require('debug')('OSMBC:test:testutil');

var config = require('../config.js');

var blogModule    = require('../model/blog.js');
var articleModule = require('../model/article.js');
var logModule     = require('../model/logModule.js');



// getJsonWithID can be used to select a id,data structure from postgres
// without using the model source, and is intended to used in 
// mocha tests.
// in table there has to be a row with id, otherwise the function
// will throw an error
exports.getJsonWithId = function getJsonWithId(table,id,cb) {
  debug('getJsonWithId');
  pg.connect(config.pgstring, function(err, client, pgdone) {
    should.not.exist(err);
    var query = client.query('select data from '+table+' where id = $1',[id]);
    var result;
    query.on('row',function(row) {
      result = row.data;
    })
    query.on('end',function(err,r) {
      pgdone();
      cb(null,result);
      return;
    })
  })
}

// This function is used to clean up the tables in the test module
// and create them new
// the order of the creatTable is important (as views are created)
// with the tables, and assuming some tables to exist
// the function requires the test environment

exports.clearDB = function clearDB(done) {
  should(config.env).equal("test");
  async.series([
    function(done) {config.initialise(done)},
    function(done) {blogModule.dropTable(done)},
    function(done) {blogModule.createTable(done)},
    function(done) {articleModule.dropTable(done)},
    function(done) {articleModule.createTable(done)},
    function(done) {logModule.dropTable(done)},
    function(done) {logModule.createTable(done)}
  ],function(err) {
    if (err) console.dir(err);
    should.not.exist(err);
    done();
  });  
}