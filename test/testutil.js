

import _debug from "debug";


import should from "should";
import async from "async";
import path from "path";
import nock from "nock";
import fs from "fs";
import pretty from "pretty";

import http from "http";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

import LoginPage from "../test/PageObjectModel/loginPage.js";
import LoginChooserPage from "../test/PageObjectModel/loginChooserPage.js";

import { Builder, Browser } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
// import safari from "selenium-webdriver/safari.js";

import util from "../util/util.js";

import config from "../config.js";

import app from "../app.js";

import pgMap from "../model/pgMap.js";
import db from "../model/db.js";
import blogModule from "../model/blog.js";
import articleModule from "../model/article.js";
import logModule from "../model/logModule.js";
import userModule from "../model/user.js";
import session from "../model/session.js";
import configModule from "../model/config.js";

import { initialiseMailReceiver, mailReceiverUpdateUser } from "../notification/mailReceiver.js";
import messageCenter from "../notification/messageCenter.js";
const osmbcLink = util.osmbcLink;
const debug = _debug("OSMBC:test:testutil");


// set Test Standard to ignore prototypes for should
should.config.checkProtoEql = false;

// getJsonWithID can be used to select a id,data structure from postgres
// without using the model source, and is intended to used in
// mocha tests.
// in table there has to be a row with id, otherwise the function
// will throw an error
function getJsonWithId(table, id, cb) {
  debug("getJsonWithId");
  let result = null;
  db.query("select data from " + table + " where id = $1", [id], function(err, pgResult) {
    if (err) return cb(err);
    if (pgResult.rows.length === 1) {
      result = pgResult.rows[0].data;
    }
    return cb(null, result);
  });
};

// findJson can be used to select a id,data structure from postgres
// without using the model source, and is intended to used in
// mocha tests.
function internCreate() { return {}; }

function findJSON(table, obj, cb) {
  function _findJSON(table, obj, cb) {
    debug("findJSON");
    pgMap.findOne({ table: table, create: internCreate }, obj, cb);
  }
  if (cb) {
    return _findJSON(table, obj, cb);
  }

  return new Promise((resolve, reject) => {
    _findJSON(table, obj, (err, result) => (err) ? reject(err) : resolve(result));
  });
};

// This function is used to clean up the tables in the test module
// and create them new
// the order of the creatTable is important (as views are created)
// with the tables, and assuming some tables to exist
// the function requires the test environment

function clearDB(done) {
  function _clearDB(done) {
    if (config.env !== "test") {
      console.error("Running Tests with but environment is: ", config.env);
      console.error("Stopping to rescue database");
      process.exit(1);
    }
    messageCenter.initialise();
    should.exist(messageCenter.global);

    initialiseMailReceiver([]);

    const pgOptions = { dropTables: true, createTables: true, dropIndex: true, createIndex: true, dropView: true, createView: true };
    async.series([
      function(done) { config.initialise(done); },
      function(done) { pgMap.createTables(blogModule.pg, pgOptions, done); },
      function(done) { pgMap.createTables(articleModule.pg, pgOptions, done); },
      function(done) { pgMap.createTables(logModule.pg, pgOptions, done); },
      function(done) { pgMap.createTables(userModule.pg, pgOptions, done); },
      function(done) { pgMap.createTables(session.pg, pgOptions, done); },
      function(done) { pgMap.createTables(configModule.pg, pgOptions, done); }

    ], function(err) {
      if (err) {
        return done(err);
      }
      configModule.initialiseConfigMap();
      return configModule.initialise(done);
    });
  }
  if (done) {
    return _clearDB(done);
  }
  return new Promise((resolve, reject) => {
    _clearDB((err) => (err) ? reject(err) : resolve());
  });
};

// Import Test Data from File
// Expected Fileformat
// {table1:[{jsom objects},...],table2:[{jsom objects},...]}
// in Callback Postgres Error and the JSON Data Object
// e.g. to store Test Results, is returned


function importData(data, callback) {
  debug("importData");
  if (typeof data === "string") {
    data = JSON.parse(fs.readFileSync(path.resolve(config.getDirName(), "test", data), "UTF8"));
  }
  const idReference = { blog: {}, article: {}, user: {} };

  function _importData(data, callback) {
    async.series([
      function initialiseDB(cb0) {
        debug("initialiseDB");
        if (data.initialise) {
          clearDB(cb0);
        } else cb0();
      },
      function clearDB(cb0a) {
        debug("clearDB");
        if (data.clear) {
          async.series([
            db.query.bind(null, "delete from usert;"),
            db.query.bind(null, "delete from blog;"),
            db.query.bind(null, "delete from article;"),
            db.query.bind(null, "delete from changes;"),
            db.query.bind(null, "delete from config;"),
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
            const id = d.id;
            delete d.id;
            userModule.createNewUser(d, function up(err, user) {
              if (err) return cb(err);
              if (typeof (id) !== "undefined") idReference.user[id] = user.id;
              // eslint-disable-next-line new-cap
              mailReceiverUpdateUser(user);
              return cb();
            });
          }, cb1);
        } else cb1();
      },
      function importAllBlogs(cb2) {
        debug("importAllBlogs");
        if (typeof (data.blog) !== "undefined") {
          async.eachSeries(data.blog, function importOneBlog(d, cb) {
            const id = d.id;
            delete d.id;
            blogModule.createNewBlog({ OSMUser: "test" }, d, true, function(err, blog) {
              if (err) return cb(err);
              if (typeof (id) !== "undefined") idReference.blog[id] = blog.id;
              cb();
            });
          }, cb2);
        } else cb2();
      },
      function importAllArticles(cb3) {
        debug("importAllArticles");
        if (typeof (data.article) !== "undefined") {
          async.eachSeries(data.article, function importOneArticle(d, cb) {
            const id = d.id;
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
  }
  if (callback) {
    return _importData(data, callback);
  }
  return new Promise((resolve, reject) => {
    _importData(data, (err) => (err) ? reject(err) : resolve());
  });
};

function checkData(data, callback) {
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
          const commentList = d.commentList;
          const commentRead = d.commentRead;
          const votes = d.votes;
          const tags = d.tags;
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




// This function reads the data directory (as a subdirectory of test directory)
// and for every file, that fits the fileregex calls the createTestFunction
// callback with the filename to create one or several it() tests for it.
function generateTests(datadir, fileregex, createTestFunction) {
  debug("generateTests");
  const testdir = path.resolve(config.getDirName(), datadir);
  const fileList = fs.readdirSync(testdir);
  for (let i = 0; i < fileList.length; i++) {
    const filenameLong = path.resolve(testdir, fileList[i]);
    if (fs.statSync(filenameLong).isDirectory()) continue;
    if (!((fileList[i]).match(fileregex))) continue;
    createTestFunction(fileList[i]);
  }
};

let server = null;



function startServerSync() {
  debug("startServer");
  if (server) stopServer();
  server = http.createServer(app).listen(config.getServerPort());
};




function stopServer(callback) {
  debug("stopServer");
  should.exist(server, "Server was not started, could not stop.");
  server.close();
  server = null;
  if (callback) return callback();
};





function doATest(dataBefore, test, dataAfter, callback) {
  async.series([
    clearDB,
    importData.bind(this, dataBefore),
    test,
    checkData.bind(this, dataAfter)
  ], function final(err) {
    should.not.exist(err);
    callback();
  });
};

function nockHtmlPages() {
  debug("nockHtmlPages");
  const file =  path.resolve(config.getDirName(), "test", "NockedPages", "NockedPages.json");
  const nocks =  JSON.parse(fs.readFileSync(file));
  for (const site in nocks) {
    for (const page in nocks[site]) {
      nock(site)
        .get(page)
        .replyWithFile(200, path.resolve(config.getDirName(), "test", "NockedPages", nocks[site][page]));
    }
  }
};

function nockHtmlPagesClear() {
  nock.cleanAll();
};


async function expectHtml(driver, errorList, givenPath, name) {
  const source = pretty(await driver.getPageSource());
  let stopOnError = false;
  if (!Array.isArray(errorList)) {
    stopOnError = true;
    name = givenPath;
    givenPath = errorList;
    errorList = undefined;
  }
  let expected = "not read yet";
  const expectedFile = path.join(config.getDirName(), "test", givenPath, name + ".html");
  const actualFile   = path.join(config.getDirName(), "test", givenPath, name + "_actual.html");
  try {
    expected = fs.readFileSync(expectedFile, "UTF8");
    const expectedPretty = pretty(expected);
    if (expectedPretty !== expected) {
      if (process.env.TEST_HTML_PRETTY === "TRUE") {
        fs.writeFileSync(expectedFile, expectedPretty, "UTF8");
        expected = expectedPretty;
      } else {
        console.info(expectedFile + " in not pretty. Use TEST_HTML_PRETTY=TRUE to change while testing");
      }
    }
  } catch (err) {
    console.error(err);
  }
  if (source === expected) {
    // everything is fine, delete any existing actual file
    try {
      fs.unlinkSync(actualFile);
    } catch (err) {}

    return;
  }

  // there is a difference, so create the actual data as file
  // do easier fix the test.
  fs.writeFileSync(actualFile, source, "UTF8");
  if (stopOnError) {
    should(false).eql(true, "HTML File " + name + " is different.");
  } else {
    if (source !== expected) {
      errorList.push("HTML File " + name + " is different.");
    }
  }
};




process.on("unhandledRejection", (reason, p) => {
  console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
  console.error(reason.stack);
  // application specific logging, throwing an error, or other logic here
});




function checkUrlWithUser(options) {
  const client = getWrappedAxiosClient();
  return async function() {
    should.exist(options.username);
    should.exist(options.password);
    should.exist(options.url);
    should.exist(options.expectedMessage);
    should.exist(options.expectedStatusCode);
    try {
      await client.post(osmbcLink("/login"), { username: options.username, password: options.password });
      const body = await client.get(options.url);


      body.data.should.containEql(options.expectedMessage);
      should(body.status).eql(options.expectedStatusCode);
    // eslint-disable-next-line no-empty
    } finally {}
  };
}

function checkPostUrlWithUser(options) {
  const client = getWrappedAxiosClient();
  return async function() {
    should.exist(options.username);
    should.exist(options.password);
    should.exist(options.url);
    should.exist(options.expectedMessage);
    should.exist(options.expectedStatusCode);
    should.exist(options.form);
    try {
      await client.post(osmbcLink("/login"), { username: options.username, password: options.password });
      const body = await client.post(options.url, options.form);
      body.data.should.containEql(options.expectedMessage);
      should(body.status).eql(options.expectedStatusCode);
    // eslint-disable-next-line no-empty
    } finally {}
  };
}

function getWrappedAxiosClient(options) {
  if (!options) options = {};
  const jar = new CookieJar();
  return wrapper(axios.create({ jar, validateStatus: () => true, maxRedirects: (options.maxRedirects) ?? 0 }));
}

async function getNewDriver(username) {
  const chromeOptions = new chrome.Options();
  if (process.env.TEST_HEADLESS === "TRUE") chromeOptions.addArguments("headless");
  chromeOptions.addArguments("window-size=1920,1080");
  chromeOptions.addArguments("disable-search-engine-choice-screen");

  // try to disable passwort Manager Popup
  // https://stackoverflow.com/questions/69799196/chrome-arguments-to-disable-save-password-prompt
  chromeOptions.addArguments("guest");
  // End try disable passwort Manager Popup



  const driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(chromeOptions).build();
  // const driver = await new Builder().forBrowser(Browser.SAFARI).setChromeOptions(chromeOptions).build();
  const loginPage = new LoginPage(driver);
  const loginChooserPage = new LoginChooserPage(driver);
  await driver.manage().setTimeouts({ implicit: 700, script: 700 });
  try {
    await driver.get(osmbcLink("/osmbc"));
    await loginChooserPage.clickHtAccessLogin();



    await loginPage.assertPage();
    await loginPage.typeUsername(username);
    await loginPage.typePassword(username);
    await loginPage.clickOK();
  } catch (err) {
    console.error(err);
  // eslint-disable-next-line no-empty
  } finally {};
  return driver;
}


const testutil = {
  getNewDriver: getNewDriver,
  checkUrlWithUser: checkUrlWithUser,
  checkPostUrlWithUser: checkPostUrlWithUser,
  getWrappedAxiosClient: getWrappedAxiosClient,
  getJsonWithId: getJsonWithId,
  findJSON: findJSON,
  clearDB: clearDB,
  importData: importData,
  checkData: checkData,
  generateTests: generateTests,
  startServerSync: startServerSync,
  stopServer: stopServer,
  doATest: doATest,
  nockHtmlPages: nockHtmlPages,
  nockHtmlPagesClear: nockHtmlPagesClear,
  expectHtml: expectHtml
};

export default testutil;
