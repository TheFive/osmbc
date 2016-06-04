"use strict";

var pg     = require('pg');
var should = require('should');
var async  = require('async');
var path   = require('path');
var nock   = require('nock');
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

var pgMap = require('../model/pgMap.js');
var blogModule    = require('../model/blog.js');
var articleModule = require('../model/article.js');
var logModule     = require('../model/logModule.js');
var userModule    = require('../model/user.js');
var session       = require('../model/session.js');
var configModule  = require('../model/config.js');

var mailReceiver   = require('../notification/mailReceiver.js');
var messageCenter  = require('../notification/messageCenter.js');



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

// findJson can be used to select a id,data structure from postgres
// without using the model source, and is intended to used in
// mocha tests.
function internCreate() {return {};}
exports.findJSON = function findJSON(table,obj,cb) {
  debug('findJSON');
  pgMap.findOne({table:table,create:internCreate},obj,cb);
};

// This function is used to clean up the tables in the test module
// and create them new
// the order of the creatTable is important (as views are created)
// with the tables, and assuming some tables to exist
// the function requires the test environment

exports.clearDB = function clearDB(done) {
  should(config.env).equal("test");
  messageCenter.initialise();
  should.exist(messageCenter.global);

  mailReceiver.initialise([]);
  var pgOptions = {dropTables:true,createTables:true,dropIndex:true,createIndex:true,dropView:true,createView:true};
  async.series([
    function(done) {config.initialise(done);},
    function(done) {pgMap.createTables(blogModule.pg,pgOptions,done);},
    function(done) {pgMap.createTables(articleModule.pg,pgOptions,done);},
    function(done) {pgMap.createTables(logModule.pg,pgOptions,done);},
    function(done) {pgMap.createTables(userModule.pg,pgOptions,done);},
    function(done) {pgMap.createTables(session.pg,pgOptions,done);},
    function(done) {pgMap.createTables(configModule.pg,pgOptions,done);},

  ],function(err) {
    if (err) console.dir(err);
    should.not.exist(err);
    configModule.initialiseConfigMap();
    configModule.initialise(done);
  });  
};

// Import Test Data from File
// Expected Fileformat
// {table1:[{jsom objects},...],table2:[{jsom objects},...]}
// in Callback Postgres Error and the JSON Data Object
// e.g. to store Test Results, is returned


exports.importData = function importData(data,callback) {
  debug('importData');
  var idReference = {blog:{},article:{},user:{}};

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
          let id = d.id;
          delete d.id;
          userModule.createNewUser(d,function up(err,user){
            if (err) return cb(err);
            if (typeof(id)!=="undefined") idReference.user[id]=user.id;
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
          let id = d.id;
          delete d.id;
          blogModule.createNewBlog({displayName:"test"},d,function(err,blog){
            if (err) return cb(err);
            if (typeof(id)!=="undefined") idReference.blog[id]=blog.id;
            cb();
          },true);
        },cb2);
      } else cb2();
    },
    function importAllArticles(cb3) {
      debug('importAllArticles');
      if (typeof(data.article)!='undefined') {

        async.eachSeries(data.article,function importOneArticle(d,cb){
          let id = d.id;
          delete d.id;
          articleModule.createNewArticle(d,function(err,article){
            if (err) return cb(err);
            if (typeof(id)!=="undefined") idReference.article[id]=article.id;
            cb();
          });
        },cb3);
      } else cb3();
    },
    function importAllChanges(cb4) {
      debug('importAllChanges');
      if (typeof(data.change)!='undefined') {  
        async.eachSeries(data.change,function importOneChange(d,cb){
          let id;
          if (d.table == "article") id = idReference.article[d.oid];
          if (d.table == "blog") id = idReference.blog[d.oid];
          if (d.table == "user") id = idReference.user[d.oid];
          d.oid = id;
          logModule.log(d,function waitShort() {setTimeout(cb,1);});
        },cb4);
      } else cb4();
    }

    ],function(err) {
      debug("importData->final");
      callback(err,data);
  });
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
    function checkAllArticles(cb3) {
      debug('checkAllArticles');
      if (typeof(data.article)!='undefined') {  
        async.each(data.article,function checkOneArticle(d,cb){
          var commentList = d.commentList;
          var commentRead = d.commentRead;
          delete d.commentList;
          delete d.commentRead;
          articleModule.findOne(d,function(err,result){
            should.not.exist(err);
            should.exist(result,"NOT Found: "+JSON.stringify(d));
            should(result.commentList).eql(commentList);
            should(result.commentRead).eql(commentRead);
            cb();
          });
        },function(err) {
          should.not.exist(err);
          articleModule.find({},function(err,result){
            should.not.exist(err);
            should.exist(result);
            should(result.length).eql(data.article.length);
            cb3();
          });
        });
      } else cb3();
    },
    function checkAllChanges(cb4) {
      debug('checkAllChanges');
      if (typeof(data.change)!='undefined') {
        async.each(data.change,function checkOneChange(d,cb){
          logModule.find(d,function(err,result){
            should.not.exist(err);
            should( result && result.length>0).be.True();
            cb();
          });
        },function(err) {
          should.not.exist(err);
          logModule.find({},function(err,result){
            should.not.exist(err);
            should.exist(result);
            should(result.length).eql(data.change.length);
            cb4();
          });
        });
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
var server = null;


exports.startServer = function startServer(userString,callback) {
  debug('startServer');
  should.not.exist(server,"Server is allready started.");
  server = http.createServer(app).listen(config.getServerPort());
  if (userString === null) {
    if (callback) return callback();
    return;
  }
  userModule.findOne({OSMUser:userString},function(err,user){
    if (err) return callback(err);
    if (user === null) user = {};
    user.displayName = userString;
    // initialize the browser using the same port as the test application
    passportStub.install(app);
    passportStub.login(user);
    callback();
  });
};

exports.stopServer = function stopServer() {
  debug('stopServer');
  should.exist(server,"Server was not started, could not stop.");
  server.close();
  server = null;
};

exports.getBrowser = function getBrowser() {
  if (!browser)  browser = new Browser({ site: 'http://localhost:'+config.getServerPort() });
  return browser;
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

exports.nockHtmlPages = function nockHtmlPages() {
  debug('nockHtmlPages');
  var file =  path.resolve(__dirname,'NockedPages', "NockedPages.json");
  var nocks =  JSON.parse(fs.readFileSync(file));
  for (let site in nocks) {
    for (let page in nocks[site]) {
      nock(site)
        .get(page)
        .replyWithFile(200, path.resolve(__dirname,"NockedPages",nocks[site][page]));
    }
  }
};
exports.nockHtmlPagesClear = function nockHtmlPagesClear() {
  nock.cleanAll();
};


// extend the Browser Assert API


Browser.Assert.prototype.expectHtml = function expectHtml(name,cb) {
  let expected = "not read yet";
  let expectedFile = path.join(__dirname,"screens",name);
  let actualFile   = path.join(__dirname,"screens","actual_"+name);
  let string = this.html();
  try {
    expected = fs.readFileSync(expectedFile,"UTF8");
  } catch(err) {
    console.log(err);
  }
  if (string === expected) {
    // everything is fine, delete any existing actual file
    try {
      fs.unlinkSync(actualFile);
    } catch (err){}

    return cb();
  }
  // there is a difference, so create the actual data as file
  // do easier fix the test.
  fs.writeFileSync(actualFile,string,"UTF8");
  should(string).eql(expected,"HTML File "+ name +" is different.");
  return cb();
};

