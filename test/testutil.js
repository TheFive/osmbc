var pg     = require('pg');
var should = require('should');
var async  = require('async');
var path   = require('path');
var fs     = require('fs');
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

// Import Test Data from File
// Expected Fileformat
// {table1:[{jsom objects},...],table2:[{jsom objects},...]}
// in Callback Postgres Error and the JSON Data Object
// e.g. to store Test Results, is returned

exports.importData = function importData(data,callback) {
  debug('importData');

  async.series([
    function importAllUsers(cb) {
      debug('importAllUsers');
      // to be implmeneted
      cb();
    },
    function importAllBlogs(cb) {
      debug('importAllBlogs');
      if (typeof(data.blog)!='undefined') {  
        async.each(data.blog,function importOneBlog(d,cb){
          blogModule.createNewBlog(d,cb);
        },cb)
      } 
    },
    function importAllArticles(cb) {
      debug('importAllArticles');
      if (typeof(data.article)!='undefined') {  
        async.each(data.article,function importOneArticle(d,cb){
          articleModule.createNewArticle(d,cb);
        },cb)
      } 
    }

    ],function(err) {callback(err,data)})
}