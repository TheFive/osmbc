"use strict";

var async    = require("async");
var testutil = require("./testutil.js");
var should   = require("should");
var nock = require("nock");
var userModule = require("../model/user.js");




var maxTimer = 50000;


describe("views/config", function() {
  this.timeout(maxTimer);
  var browser;
  let nockLoginPage;
  beforeEach(function(bddone) {
    nockLoginPage = testutil.nockLoginPage();
    async.series([
      testutil.clearDB,
      function createUser(cb) { userModule.createNewUser({OSMUser: "TheFive", access: "full", "language": "DE"}, cb); },
      testutil.startServer.bind(null, "TheFive")
    ], function(err) {
      browser = testutil.getBrowser();
      bddone(err);
    });
  });
  afterEach(function(bddone) {
    nock.removeInterceptor(nockLoginPage);
    testutil.stopServer(bddone);
  });


  it("should open and not save wrong yaml", function(bddone) {
    async.series([
      function visitTranslation (cb) {
        browser.visit("/config/calendartranslation", cb);
      },
      function waitALittle(cb) {
        browser.wait(10, cb);
      },
      function checkFirstValues(cb) {
        browser.assert.text("table#resulttable", "Wo Was Wann Land Munich OpenStreetMap Default Meeting 2015-12-15 Germany");
        cb();
      },
      function saveValue(cb) {
        browser
          .fill("yaml", '"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n  "country":\n  "DE": "LL"')
          .pressButton("OK");
        cb();
      },
      function waitALittle(cb) {
        browser.wait(1000, cb);
      }
    ], function(err) {
      should.exist(err);
      browser.assert.status(500);

      bddone();
    });
  });
  it("should open and save calendartranslation", function(bddone) {
    async.series([
      function visitTranslation (cb) {
        browser.visit("/config/calendartranslation", cb);
      },
      function waitALittle(cb) {
        browser.wait(10, cb);
      },
      function checkFirstValues(cb) {
        browser.assert.text("table#resulttable", "Wo Was Wann Land Munich OpenStreetMap Default Meeting 2015-12-15 Germany");
        cb();
      },
      function saveValue(cb) {
        browser
          .fill("yaml", '"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n"country":\n  "DE": "LL"')
          .pressButton("OK");
        cb();
      },
      function waitALittle(cb) {
        browser.wait(1000, cb);
      }
    ], function(err) {
      browser.assert.success();
      should.not.exist(err);
      browser.assert.text("table#resulttable", "WW WA WNN LL Munich OpenStreetMap Default Meeting 2015-12-15 Germany");

      bddone();
    });
  });
});
