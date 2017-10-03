"use strict";

var should  = require("should");
var async   = require("async");
var config  = require("../config.js");
var request = require("request");
var testutil = require("./testutil.js");
var userModule = require("../model/user.js");

var baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");


describe("routes/index", function() {
  beforeEach(function(bddone) {
    config.initialise();
    testutil.importData(
      {
        user: [{"OSMUser": "TestUser", access: "full",version:"1"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"}
        ],
        clear:true
      },bddone);
  });
  describe("route GET /",function(){
    let url = baseLink + "/";
    it("should show home page", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<title>TESTBC</title>")).not.equal(-1);
          should(body.indexOf("<h2 class=\"hidden-xs\">Welcome to OSM BC</h2>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /osmbc.html",function(){
    it("should redirect to /",function(bddone){
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/osmbc.html",followRedirect:false}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          bddone();
        });
      });
    });
  });
  describe("route GET /osmbc",function(){
    it("should redirect to /",function(bddone){
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/osmbc",followRedirect:false}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /");
          bddone();
        });
      });
    });
  });
  describe("route GET /changelog",function(){
    let url = baseLink + "/changelog";
    it("should show changelog of software", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<h1>Change Log</h1>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /language",function(){
    let url = baseLink + "/language?lang=DE";
    it("should change language", function (bddone) {
      function requestLanguageSetter(whichlang, lang,cb) {
        request.get({url: baseLink + "/language?" + whichlang + "=" + lang}, function (err, response) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          return cb();
        });
      }

      async.series([
        testutil.startServer.bind(null, "TestUser"),
        requestLanguageSetter.bind(null, "lang", "ES"),
        requestLanguageSetter.bind(null, "lang3", "EN"),
        requestLanguageSetter.bind(null, "lang4", "EN")

      ], function (err) {
        should.not.exist(err);
        userModule.findById(1, function (err, user) {
          should(user).eql({
            id: '1',
            OSMUser: 'TestUser',
            access: 'full',
            version: 4,
            displayName: 'TestUser',
            mainLang: 'ES',
            secondLang: 'EN',
            lang3: null,
            lang4: null
          });
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /userconfig",function(){
    let url = baseLink + "/userconfig?view=v1&option=o1&value=v2";
    it("should show changelog of software", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body).eql("changed");
          userModule.findById(1,function(err,user){
            should(user).eql({
              id: '1',
              OSMUser: 'TestUser',
              access: 'full',
              version: 2,
              displayName: 'TestUser',
              option:  { v1:  { o1: 'v2' } }
          });
            bddone();
          });
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /createblog",function(){
    let url = baseLink + "/createblog";
    it("should show changelog of software", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<h2>Create Blog Page</h2>")).not.equal(-1);
          should(body.indexOf(" onclick=\"location.href='/blog/create'\"")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
});
