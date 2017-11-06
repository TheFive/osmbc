"use strict";

var async = require("async");
var testutil = require("./testutil.js");
var should  = require("should");
var nock = require("nock");

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");
var blogModule = require("../model/blog.js");

var mockdate = require("mockdate");






describe("views/index", function() {
  this.timeout(12000);
  describe("Known User", function() {
    var browser;
    before(function(bddone) {
      mockdate.set(new Date("2016-05-25T20:00"));
      nock("https://hooks.slack.com/")
        .post(/\/services\/.*/)
        .times(999)
        .reply(200, "ok");
      async.series([
        testutil.clearDB,
        function createUser(cb) { userModule.createNewUser({OSMUser: "TheFive", access: "full"}, cb); },
        function createUser(cb) { userModule.createNewUser({OSMUser: "OldUser", access: "full",lastAccess:"2016-02-25T20:00"}, cb); },
        function createUser(cb) { userModule.createNewUser({OSMUser: "OldUserAway", access: "denied",lastAccess:"2016-02-25T20:00"}, cb); },
        testutil.startServer.bind(null, "TheFive"),
        function createArticle(cb) {
          articleModule.createNewArticle({blog: "blog", collection: "test", markdownEN: "test"}, function(err) {
            cb(err);
          });
        },
        function createBlog(cb) {
          blogModule.createNewBlog({blog: "blog", status: "edit"}, function(err) {
            cb(err);
          });
        }
      ], function(err) {
        browser = testutil.getBrowser();
        bddone(err);
      });
    });
    after(function(bddone) {
      mockdate.reset();
      testutil.stopServer(bddone);
    });


    describe("Homepage", function() {
      it("should find welcome text on Homepage", function(bddone) {

        browser.visit("/osmbc", function(err) {
          should.not.exist(err);
          browser.assert.success();
          browser.assert.text("h2", "Welcome to OSM BCOSM BC");
          bddone();
        });
      });
      it("should have bootstrap.js loaded", function(bddone) {
        this.timeout(6000);
        browser.visit("/osmbc", function(err) {
          should.not.exist(err);
          // test wether bootstrap.js is loaded or not
          // see http://stackoverflow.com/questions/13933000/how-to-check-if-twitter-bootstrap-is-loaded
          should(browser.evaluate("(typeof $().modal == 'function'); ")).be.True();
          bddone();
        });
      });
    });
    describe("Admin Homepage", function() {
      it("should show it", function(bddone) {
        async.series([
          browser.visit.bind(browser, "/osmbc/admin"),
          browser.assert.expectHtml.bind(browser, "admin_home.html")
        ], bddone);
      });
    });
    describe("Not Defined Page", function() {
      it("should throw an error message", function(bddone) {
        browser.visit("/notdefined.html", function(err) {
          should.exist(err);
          browser.assert.status(404);
          browser.assert.text("h1", "Not Found");
          bddone();
        });
      });
    });
    describe("LanguageSetter", function() {
      it("should set the language", function(bddone) {
        browser.referer = "/osmbc";
        browser.visit("/language?lang=EN", function(err) {
          should.not.exist(err);
          browser.reload(function(err) {
            should.not.exist(err);
            browser.assert.success();
            var html = browser.html();
            var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbcbadge-lang">EN');
            should(found >= 0).be.True();
            bddone();
          });
        });
      });
      it("should set the second language", function(bddone) {
        this.timeout(12000);
        browser.referer = "/osmbc";
        browser.visit("/language?lang2=ES", function(err) {
          should.not.exist(err);
          should.not.exist(err);
          browser.reload(function(err) {
            should.not.exist(err);
            browser.assert.success();
            var html = browser.html();
            var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbcbadge-lang2">ES');
            should(found >= 0).be.True();
            bddone();
          });
        });
      });
      it("should set the second language to -- if both equal", function(bddone) {
        browser.referer = "/osmbc";
        browser.visit("/language?lang=ES", function(err) {
          should.not.exist(err);
          browser.visit("/language?lang2=ES", function (err) {
            should.not.exist(err);
            browser.reload(function(err) {
              should.not.exist(err);
              browser.assert.success();
              var html = browser.html();
              var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbcbadge-lang2">--');
              should(found >= 0).be.True();
              bddone();
            });
          });
        });
      });
    });
  });
  describe("Unkown User", function() {
    before(function(bddone) {
      nock("https://hooks.slack.com/")
        .post(/\/services\/.*/)
        .times(999)
        .reply(200, "ok");
      bddone();
    });
    it("should throw an error if user not exits", function(bddone) {
      let browser = testutil.getBrowser();

      async.series([
        testutil.clearDB,
        function createUser(cb) { userModule.createNewUser({OSMUser: "TheFive", access: "full"}, cb); },
        testutil.startServer.bind(null, "TheFiveNotExist"),
        browser.visit.bind(browser, "/osmbc")
      ], function() {
        testutil.stopServer();
        browser.assert.status(200);
        browser.html().should.containEql("You are logged in as guest");

        bddone();
      });
    });
    it("should throw an error if user has no access rights", function(bddone) {
      let browser = testutil.getBrowser();

      async.series([
        testutil.clearDB,
        function createUser1(cb) { userModule.createNewUser({OSMUser: "TheFive", access: "none"}, cb); },
        testutil.startServer.bind(null, "TheFive"),
        browser.visit.bind(browser, "/osmbc")
      ], function(err) {
        testutil.stopServer();
        should.exist(err);
        browser.assert.status(500);
        browser.assert.text("h1", "OSM User >TheFive< has no access rights");

        bddone();
      });
    });
  });
});
