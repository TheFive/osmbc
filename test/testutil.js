"use strict";

var pg     = require('pg');
var should = require('should');
var async  = require('async');
var path   = require('path');
var fs     = require('fs');
var compare = require('dom-compare').compare;
var groupingreporter = require('dom-compare').GroupingReporter;
var jsdom = require('node-jsdom');

var debug  = require('debug')('OSMBC:test:testutil');
var passportStub = require("./passport-stub.js");
// use zombie.js as headless browser
var Browser = require('zombie');
var http = require('http');

var config = require('../config.js');

var app = require('../app.js');

var blogModule    = require('../model/blog.js');
var articleModule = require('../model/article.js');
var logModule     = require('../model/logModule.js');
var userModule     = require('../model/user.js');

var mailReceiver   = require('../notification/mailReceiver.js');



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
    });
    query.on('end',function() {
      pgdone();
      cb(null,result);
      return;
    });
  });
};

// This function is used to clean up the tables in the test module
// and create them new
// the order of the creatTable is important (as views are created)
// with the tables, and assuming some tables to exist
// the function requires the test environment

exports.clearDB = function clearDB(done) {
  should(config.env).equal("test");
  mailReceiver.initialise([]);
  async.series([
    function(done) {config.initialise(done);},
    function(done) {blogModule.dropTable(done);},
    function(done) {blogModule.createTable(done);},
    function(done) {articleModule.dropTable(done);},
    function(done) {articleModule.createTable(done);},
    function(done) {logModule.dropTable(done);},
    function(done) {logModule.createTable(done);},
    function(done) {userModule.dropTable(done);},
    function(done) {userModule.createTable(done);}
  ],function(err) {
    if (err) console.dir(err);
    should.not.exist(err);
    done();
  });  
};

// Import Test Data from File
// Expected Fileformat
// {table1:[{jsom objects},...],table2:[{jsom objects},...]}
// in Callback Postgres Error and the JSON Data Object
// e.g. to store Test Results, is returned

exports.importData = function importData(data,callback) {
  debug('importData');

  async.series([
    function clearDB(cb0) {
      debug('clearDB');
      if (data.clear) {  
        exports.clearDB(cb0);
      } else cb0();
    },
    function importAllUsers(cb1) {
      debug('importAllUsers');
      if (typeof(data.user)!='undefined') {  
        async.eachSeries(data.user,function importOneUser(d,cb){
          userModule.createNewUser(d,function up(err,user){
            if (err) return cb(err);
            mailReceiver.updateUser(user);
            return cb();
          });
        },cb1);
      } else cb1();
    },
    function importAllBlogs(cb2) {
      debug('importAllBlogs');
      if (typeof(data.blog)!='undefined') {  
        async.eachSeries(data.blog,function importOneBlog(d,cb){
          blogModule.createNewBlog({displayName:"test"},d,cb,true);
        },cb2);
      } else cb2();
    },
    function importAllArticles(cb3) {
      debug('importAllArticles');
      if (typeof(data.article)!='undefined') {  
        async.eachSeries(data.article,function importOneArticle(d,cb){
          articleModule.createNewArticle(d,cb);
        },cb3);
      } else cb3();
    },
    function importAllChanges(cb4) {
      debug('importAllChanges');
      if (typeof(data.change)!='undefined') {  
        async.eachSeries(data.change,function importOneChange(d,cb){
          logModule.log(d,function waitShort() {setTimeout(cb,10);});
        },cb4);
      } else cb4();
    }

    ],function(err) {
      debug("importData->final");
      callback(err,data);});
};

exports.checkData = function checkData(data,callback) {
  debug('checkData');

  async.series([
    function checkAllUsers(cb1) {
      debug('checkAllUsers');
      if (typeof(data.user)!='undefined') { 
        userModule.find({},function(err,result){
          should.not.exist(err);
          should(result.length).eql(data.user.length);
          should(result).containDeep(data.user);
          cb1();
        }); 
      } else cb1();
    },
    function checkAllBlogs(cb2) {
      debug('checkAllBlogs');
      if (typeof(data.blog)!='undefined') {  
        async.each(data.blog,function checkOneBlog(d,cb){
          blogModule.findOne(d,function(err,result){
            should.not.exist(err);
            should.exist(result,"NOT Found: "+JSON.stringify(d));
            cb();
          });
        },function(err) {
          should.not.exist(err);
          blogModule.find({},function(err,result){
            should.not.exist(err);
            should.exist(result);
            should(result.length).eql(data.blog.length);
            cb2();
          });
        });
      } else cb2();
    },
    function importAllArticles(cb3) {
      debug('importAllArticles');
      if (typeof(data.article)!='undefined') {  
        should(false).be.True(); 
        cb3();
      } else cb3();
    },
    function importAllChanges(cb4) {
      debug('importAllChanges');
      if (typeof(data.change)!='undefined') {  
        should(false).be.True(); 
      } else cb4();
    }

    ],function(err) {callback(err,data);});
};

// Comparing 2 HTML Trees with JSDOM and DomCompare
// the result gives getResult()=true, if the trees are equal
// result.getDifferences() is an array with the differences
// dom-compare offers an GroupingReporter to display the differences
// in more detail.
exports.domcompare = function domcompare(actualHTML,expectedHTML) {

  var expectedDOM = jsdom.jsdom(expectedHTML);
  var actualDOM = jsdom.jsdom(actualHTML);
  var result = compare(expectedDOM, actualDOM);

  if (result.getDifferences().length>0) {
    console.log("Actual HTML-----");
    console.log(actualHTML);
    console.log("Expected HTML------");
    console.log(expectedHTML);
    console.log("Error Message-----");
    console.log(groupingreporter.report(result));
  }

  return result;

};


// This function reads the data directory (as a subdirectory of test directory)
// and for every file, that fits the fileregex calls the createTestFunction
// callback with the filename to create one or several it() tests for it.
exports.generateTests = function generateTests(datadir,fileregex,createTestFunction) {
  debug('generateTests');
  var testdir = path.resolve(__dirname, datadir);
  var fileList=fs.readdirSync(testdir);
  for (var i =0;i<fileList.length;i++){
    var filenameLong=path.resolve(testdir,fileList[i]);
    if (fs.statSync(filenameLong).isDirectory()) continue;
    if (!((fileList[i]).match(fileregex) )) continue;
    createTestFunction(fileList[i]);
  }
 };

var browser = null;
var server;
exports.startBrowser = function startBrowser(callback) {
  debug('startBrowser');
  if (browser) return callback(null,browser);
  server = http.createServer(app).listen(config.getServerPort());
    // initialize the browser using the same port as the test application
  browser = new Browser({ site: 'http://localhost:'+config.getServerPort() });
  passportStub.install(app);
  passportStub.login({displayName:"TheFive"});
  callback(null,browser); 
 };


 exports.doATest = function doATest(dataBefore,test,dataAfter,callback) {
  async.series([
    exports.clearDB,
    exports.importData.bind(this,dataBefore),
    test,
    exports.checkData.bind(this,dataAfter)
    ],function final(err){
    should.not.exist(err);
    callback();
  });

 };




