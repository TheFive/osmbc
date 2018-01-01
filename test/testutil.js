"use strict";

var should = require("should");
var async  = require("async");
var path   = require("path");
var nock   = require("nock");
var fs     = require("fs");

var debug  = require("debug")("OSMBC:test:testutil");
// use zombie.js as headless browser
var Browser = require("zombie");
var http = require("http");
var request = require("request");

var config = require("../config.js");

var app = require("../app.js");

var pgMap = require("../model/pgMap.js");
var db  = require("../model/db.js");
var blogModule    = require("../model/blog.js");
var articleModule = require("../model/article.js");
var logModule     = require("../model/logModule.js");
var userModule    = require("../model/user.js");
var session       = require("../model/session.js");
var configModule  = require("../model/config.js");

var mailReceiver   = require("../notification/mailReceiver.js");
var messageCenter  = require("../notification/messageCenter.js");
var passport = require("passport");


// set Test Standard to ignore prototypes for should
should.config.checkProtoEql = false;

// getJsonWithID can be used to select a id,data structure from postgres
// without using the model source, and is intended to used in
// mocha tests.
// in table there has to be a row with id, otherwise the function
// will throw an error
exports.getJsonWithId = function getJsonWithId(table, id, cb) {
  debug("getJsonWithId");
  let result = null;
  db.query("select data from " + table + " where id = $1", [id], function(err, pgResult) {
    if (err) return cb(err);
    if (pgResult.rows.length == 1) {
      result = pgResult.rows[0].data;
    }
    return cb(null, result);
  });
};

// findJson can be used to select a id,data structure from postgres
// without using the model source, and is intended to used in
// mocha tests.
function internCreate() { return {}; }
exports.findJSON = function findJSON(table, obj, cb) {
  debug("findJSON");
  pgMap.findOne({table: table, create: internCreate}, obj, cb);
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
  var pgOptions = {dropTables: true, createTables: true, dropIndex: true, createIndex: true, dropView: true, createView: true};
  async.series([
    function(done) { config.initialise(done); },
    function(done) { pgMap.createTables(blogModule.pg, pgOptions, done); },
    function(done) { pgMap.createTables(articleModule.pg, pgOptions, done); },
    function(done) { pgMap.createTables(logModule.pg, pgOptions, done); },
    function(done) { pgMap.createTables(userModule.pg, pgOptions, done); },
    function(done) { pgMap.createTables(session.pg, pgOptions, done); },
    function(done) { pgMap.createTables(configModule.pg, pgOptions, done); }

  ], function(err) {
    if (err) console.error(err);
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


exports.importData = function importData(data, callback) {
  debug("importData");
  var idReference = {blog: {}, article: {}, user: {}};

  async.series([
    function initialiseDB(cb0) {
      debug("initialiseDB");
      if (data.initialise) {
        articleModule.removeOpenBlogCache();
        exports.clearDB(cb0);
      } else cb0();
    },
    function clearDB(cb0a) {
      debug("clearDB");
      if (data.clear) {
        articleModule.removeOpenBlogCache();
        async.series([
          db.query.bind(null, "delete from usert;"),
          db.query.bind(null, "delete from blog;"),
          db.query.bind(null, "delete from article;"),
          db.query.bind(null, "delete from changes;"),
          db.query.bind(null, "ALTER SEQUENCE usert_id_seq RESTART WITH 1;"),
          db.query.bind(null, "ALTER SEQUENCE blog_id_seq RESTART WITH 1;"),
          db.query.bind(null, "ALTER SEQUENCE article_id_seq RESTART WITH 1;"),
          db.query.bind(null, "ALTER SEQUENCE changes_id_seq RESTART WITH 1;")
        ], cb0a);
      } else return cb0a();
    },
    function importAllUsers(cb1) {
      debug("importAllUsers");
      if (typeof (data.user) !== "undefined") {
        async.eachSeries(data.user, function importOneUser(d, cb) {
          let id = d.id;
          delete d.id;
          userModule.createNewUser(d, function up(err, user) {
            if (err) return cb(err);
            if (typeof (id) !== "undefined") idReference.user[id] = user.id;
            mailReceiver.updateUser(user);
            return cb();
          });
        }, cb1);
      } else cb1();
    },
    function importAllBlogs(cb2) {
      debug("importAllBlogs");
      if (typeof (data.blog) !== "undefined") {
        async.eachSeries(data.blog, function importOneBlog(d, cb) {
          let id = d.id;
          delete d.id;
          blogModule.createNewBlog({displayName: "test"}, d, function(err, blog) {
            if (err) return cb(err);
            if (typeof (id) !== "undefined") idReference.blog[id] = blog.id;
            cb();
          }, true);
        }, cb2);
      } else cb2();
    },
    function importAllArticles(cb3) {
      debug("importAllArticles");
      if (typeof (data.article) !== "undefined") {
        async.eachSeries(data.article, function importOneArticle(d, cb) {
          let id = d.id;
          delete d.id;
          articleModule.createNewArticle(d, function(err, article) {
            if (err) return cb(err);
            if (typeof (id) !== "undefined") idReference.article[id] = article.id;
            cb();
          });
        }, cb3);
      } else cb3();
    },
    function importAllChanges(cb4) {
      debug("importAllChanges");
      if (typeof (data.change) !== "undefined") {
        async.eachSeries(data.change, function importOneChange(d, cb) {
          let id;
          if (d.table === "article") id = idReference.article[d.oid];
          if (d.table === "blog") id = idReference.blog[d.oid];
          if (d.table === "user") id = idReference.user[d.oid];
          d.oid = id;
          if (d._oid) {
            d.oid = d._oid;
            delete d._oid;
          }
          logModule.log(d, function waitShort() { setTimeout(cb, 1); });
        }, cb4);
      } else cb4();
    }

  ], function(err) {
    debug("importData->final");
    callback(err, data);
  });
};

exports.checkData = function checkData(data, callback) {
  debug("checkData");

  async.series([
    function checkAllUsers(cb1) {
      debug("checkAllUsers");
      if (typeof (data.user) !== "undefined") {
        userModule.find({}, function(err, result) {
          should.not.exist(err);
          should(result.length).eql(data.user.length);
          should(result).containDeep(data.user);
          cb1();
        });
      } else cb1();
    },
    function checkAllBlogs(cb2) {
      debug("checkAllBlogs");
      if (typeof (data.blog) !== "undefined") {
        async.each(data.blog, function checkOneBlog(d, cb) {
          blogModule.findOne(d, function(err, result) {
            should.not.exist(err);
            should.exist(result, "NOT Found: " + JSON.stringify(d));
            cb();
          });
        }, function(err) {
          should.not.exist(err);
          blogModule.find({}, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            should(result.length).eql(data.blog.length);
            cb2();
          });
        });
      } else cb2();
    },
    function checkAllArticles(cb3) {
      debug("checkAllArticles");
      if (typeof (data.article) !== "undefined") {
        async.each(data.article, function checkOneArticle(d, cb) {
          var commentList = d.commentList;
          var commentRead = d.commentRead;
          var votes = d.votes;
          var tags = d.tags;
          delete d.commentList;
          delete d.commentRead;
          delete d.votes;
          delete d.tags;
          articleModule.findOne(d, function(err, result) {
            should.not.exist(err);
            should.exist(result, "NOT Found: " + JSON.stringify(d));
            should(result.commentList).eql(commentList);
            should(result.commentRead).eql(commentRead);
            should(result.votes).eql(votes);
            should(result.tags).eql(tags);
            cb();
          });
        }, function(err) {
          should.not.exist(err);
          articleModule.find({}, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            should(result.length).eql(data.article.length);
            cb3();
          });
        });
      } else cb3();
    },
    function checkAllChanges(cb4) {
      debug("checkAllChanges");
      if (typeof (data.change) !== "undefined") {
        async.each(data.change, function checkOneChange(d, cb) {
          logModule.find(d, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            should(result.length > 0).be.True();
            cb();
          });
        }, function(err) {
          should.not.exist(err);
          logModule.find({}, function(err, result) {
            should.not.exist(err);
            should.exist(result);
            should(result.length).eql(data.change.length);
            cb4();
          });
        });
      } else cb4();
    }

  ], function(err) { callback(err, data); });
};

// Comparing 2 HTML Trees with JSDOM and DomCompare
// the result gives getResult()=true, if the trees are equal
// result.getDifferences() is an array with the differences
// dom-compare offers an GroupingReporter to display the differences
// in more detail.

var HtmlDiffer = require("html-differ").HtmlDiffer,
  htmlDiffer = new HtmlDiffer({});

exports.equalHtml = function equalHtml(actualHTML, expectedHTML) {
  let diff = (htmlDiffer.diffHtml(actualHTML, expectedHTML));

  if (diff.length == 1) return true;

  let colors = require("colors/safe");
  colors.enabled = true;

  diff.forEach(function(part) {
    // green for additions, red for deletions
    // grey for common parts
    if (part.added) {
      console.info(colors.green(part.value));
    } else if (part.removed) {
      console.info(colors.red(part.value));
    } else console.info(colors.grey(part.value));
  });
  return false;
};


// This function reads the data directory (as a subdirectory of test directory)
// and for every file, that fits the fileregex calls the createTestFunction
// callback with the filename to create one or several it() tests for it.
exports.generateTests = function generateTests(datadir, fileregex, createTestFunction) {
  debug("generateTests");
  var testdir = path.resolve(__dirname, datadir);
  var fileList = fs.readdirSync(testdir);
  for (var i = 0; i < fileList.length; i++) {
    var filenameLong = path.resolve(testdir, fileList[i]);
    if (fs.statSync(filenameLong).isDirectory()) continue;
    if (!((fileList[i]).match(fileregex))) continue;
    createTestFunction(fileList[i]);
  }
};

var browser = null;
var server = null;


exports.startServer = function startServer(userString, callback) {
  debug("startServer");
  if (typeof (userString) === "function") {
    callback = userString;
    userString = null;
  }
  if (server) exports.stopServer();
  server = http.createServer(app).listen(config.getServerPort());

  if (userString === null) {
    if (callback) return callback();
    return;
  }

  passport._strategies.openstreetmap._token_response = {
    access_token: 'at-1234',
    expires_in: 3600
  };

  passport._strategies.openstreetmap._profile = {
    displayName: userString
  };
  return callback();
};

var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();

exports.startServerWithLogin = function(userString,jar,callback) {
  debug("startServerWithLogin");
  exports.startServer(userString,function(err){
    if (err) return callback(err);
    request.get({url:baseLink + "/osmbc",jar:jar},function(err){
      return callback(err);
    });
  });
};

exports.stopServer = function stopServer(callback) {
  debug("stopServer");
  should.exist(server, "Server was not started, could not stop.");
  server.close();
  server = null;
  if (callback) return callback();
};

exports.getBrowser = function getBrowser() {
  if (!browser) browser = new Browser({ site: "http://localhost:" + config.getServerPort() });
  return browser;
};



exports.doATest = function doATest(dataBefore, test, dataAfter, callback) {
  async.series([
    exports.clearDB,
    exports.importData.bind(this, dataBefore),
    test,
    exports.checkData.bind(this, dataAfter)
  ], function final(err) {
    should.not.exist(err);
    callback();
  });
};

exports.nockHtmlPages = function nockHtmlPages() {
  debug("nockHtmlPages");
  var file =  path.resolve(__dirname, "NockedPages", "NockedPages.json");
  var nocks =  JSON.parse(fs.readFileSync(file));
  for (let site in nocks) {
    for (let page in nocks[site]) {
      nock(site)
        .get(page)
        .replyWithFile(200, path.resolve(__dirname, "NockedPages", nocks[site][page]));
    }
  }
};
exports.nockHtmlPagesClear = function nockHtmlPagesClear() {
  nock.cleanAll();
};


// extend the Browser Assert API


Browser.Assert.prototype.expectHtml = function expectHtml(givenPath,name, cb) {
  if (typeof name === "function") {
    cb = name;
    name = givenPath;
    givenPath = "screens";
  }
  let expected = "not read yet";
  let expectedFile = path.join(__dirname, givenPath, name);
  let actualFile   = path.join(__dirname, givenPath, "actual_" + name);
  let string = this.html();
  try {
    expected = fs.readFileSync(expectedFile, "UTF8");
  } catch (err) {
    console.error(err);
  }
  if (string === expected) {
    // everything is fine, delete any existing actual file
    try {
      fs.unlinkSync(actualFile);
    } catch (err) {}

    return cb();
  }
  // there is a difference, so create the actual data as file
  // do easier fix the test.
  fs.writeFileSync(actualFile, string, "UTF8");
  should(string).eql(expected, "HTML File " + name + " is different.");
  return cb();
};


process.on("unhandledRejection", (reason, p) => {
  console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
  console.error(reason.stack);
  // application specific logging, throwing an error, or other logic here
});
