"use strict";

var should  = require("should");
var async   = require("async");
var config  = require("../config.js");
var request = require("request");
var nock = require("nock");
var testutil = require("./testutil.js");
var initialise = require("../util/initialise.js");
var userModule = require("../model/user.js");
var mockdate = require("mockdate");

var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


describe("routes/index", function() {
  let jar = null;
  before(initialise.initialiseModules);
  beforeEach(function(bddone) {
    config.initialise();
    mockdate.set(new Date("2016-05-25T20:00:00Z"));
    jar = request.jar();
    testutil.importData(
      {
        user: [{"OSMUser": "TestUser", access: "full", version: "1"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"}
        ],
        clear: true
      }, bddone);
  });
  after(function() {
    mockdate.reset();
  });
  let nockLoginPage;
  beforeEach(function(bddone){
    nockLoginPage = testutil.nockLoginPage();
    return bddone();
  });
  afterEach(function(bddone){
    nock.removeInterceptor(nockLoginPage);
    return bddone();
  });

  describe("route GET /", function() {
    let url = baseLink + "/";
    it("should show home page", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<title>TESTBC</title>");
          body.should.containEql("<h2 class=\"hidden-xs\">Welcome to OSM BC</h2>");
          body.should.containEql("Full Access Index Page");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.not.containEql("Full Access Index Page");
          bddone();
        });
      });
    });
  });
  describe("route GET /osmbc.html", function() {
    it("should redirect to /", function(bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.get({url: baseLink + "/osmbc.html", followRedirect: false, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          bddone();
        });
      });
    });
  });
  describe("route GET /osmbc", function() {
    it("should redirect to /", function(bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.get({url: baseLink + "/osmbc", followRedirect: false, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          bddone();
        });
      });
    });
  });
  describe("route GET /changelog", function() {
    let url = baseLink + "/changelog";
    it("should show changelog of software", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h1>Change Log</h1>");
          userModule.findById(1, function(err, user) {
            should(user).eql({
              id: "1",
              OSMUser: "TestUser",
              access: "full",
              version: 2,
              lastAccess: "2016-05-25T20:00:00.000Z",
              lastChangeLogView: "1.8.4"
            });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h1>Change Log</h1>");
          bddone();
        });
      });
    });
  });
  describe("route GET /language", function() {
    let url = baseLink + "/language?lang=DE";
    function requestLanguageSetter(whichlang, lang, cb) {
      request.get({url: baseLink + "/language?" + whichlang + "=" + lang, jar: jar}, function (err, response) {
        should.not.exist(err);
        should(response.statusCode).eql(200);
        return cb();
      });
    }
    it("should change language", function (bddone) {
      async.series([
        testutil.startServerWithLogin.bind(null, "TestUser", jar),
        requestLanguageSetter.bind(null, "lang", "ES"),
        requestLanguageSetter.bind(null, "lang3", "EN"),
        requestLanguageSetter.bind(null, "lang4", "EN")

      ], function (err) {
        should.not.exist(err);
        userModule.findById(1, function (err, user) {
          should(user).eql({
            id: "1",
            OSMUser: "TestUser",
            access: "full",
            version: 4,
            lastAccess: "2016-05-25T20:00:00.000Z",
            mainLang: "ES",
            secondLang: "EN",
            lang3: null,
            lang4: null
          });
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should work for non existing / guest user", function (bddone) {
      async.series([
        testutil.startServerWithLogin.bind(null, "TestUserNonExisting", jar),
        requestLanguageSetter.bind(null, "lang", "ES"),
        requestLanguageSetter.bind(null, "lang3", "EN"),
        requestLanguageSetter.bind(null, "lang4", "EN")

      ], function (err) {
        should.not.exist(err);
        userModule.find({OSMUser:"TestUserNonExisting"}, function (err, user) {
          should(user[0]).eql({
            id: "4",
            OSMUser: "TestUserNonExisting",
            access: "guest",
            version: 4,
            lastAccess: "2016-05-25T20:00:00.000Z",
            mainLang: "ES",
            secondLang: "EN",
            lang3: null,
            lang4: null
          });
          bddone();
        });
      });
    });
  });
  describe("route GET /userconfig", function() {
    let url = baseLink + "/userconfig?view=v1&option=o1&value=v2";
    it("should set options for a view", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body).eql("changed");
          userModule.findById(1, function(err, user) {
            should(user).eql({
              id: "1",
              OSMUser: "TestUser",
              access: "full",
              lastAccess: "2016-05-25T20:00:00.000Z",
              version: 2,
              option: { v1: { o1: "v2" } }
            });
            bddone();
          });
        });
      });
    });
    it("should throw an error on missing option", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/userconfig?view=v1&option=o1", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("<h1>missing value in option</h1>");
          bddone();
        });
      });
    });
    it("should throw an error on missing view", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/userconfig", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("<h1>missing view in option</h1>");
          bddone();
        });
      });
    });
    it("should throw an error on missing value", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/userconfig?view=V1", jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("<h1>missing option in option</h1>");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServerWithLogin("TestUser", jar, function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("changed");
          bddone();
        });
      });
    });
  });
  describe("route GET /createblog", function() {
    let url = baseLink + "/createblog";
    it("should show changelog of software", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          body.should.containEql("<h2>Create Blog Page</h2>");
          body.should.containEql(" onclick=\"location.href='/blog/create'\"");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url, jar: jar}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
});
