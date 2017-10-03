"use strict";

var should  = require("should");
var async   = require("async");
var config  = require("../config.js");
var request = require("request");
var testutil = require("./testutil.js");
var userModule = require("../model/user.js");

var baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");


describe("routes/tool", function() {
  before(function(bddone){
    testutil.clearDB(bddone);
  });
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
  describe("route GET  /tool/calendar2markdown",function(){
    let url = baseLink + "/tool/calendar2markdown";
    it("should show calendar", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<h1>Current OSM Wiki Calendar as Markdown</h1>")).not.equal(-1);
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
  describe("route POST /tool/calendar2markdown",function(){
    it("should redirect to /",function(bddone){
      testutil.startServer("TestUser", function () {
        request.post({url: baseLink + "/tool/calendar2markdown",form:{},followRedirect:false}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /tool/calendar2markdown");
          // this function is changing the session, don't know how to test it from here
          bddone();
        });
      });
    });
  });
  describe("route GET  /tool/calendarAllLang",function(){
    let url = baseLink + "/tool/calendarAllLang";
    it("should show calendar", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf(" <h1>New Calendar Tool</h1>")).not.equal(-1);
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
  describe("route GET  /tool/picturetool",function(){
    let url = baseLink + "/tool/picturetool";
    it("should show picture tool", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<h1>Generate OSMBC Picture Markdown</h1>")).not.equal(-1);
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
  describe("route POST /tool/picturetool",function(){
    let url = baseLink + "/tool/picturetool";
    it("should call picture tool", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.post({url: url, form: {}}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(302);
          should(body).eql("Found. Redirecting to /tool/picturetool");
          return bddone();
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
  describe("route GET public /calendar/preview",function(){
    let url = baseLink + "/calendar/preview";
    it("should show calendar for OSMBC Users", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf(" <title>OSMBC Calendar Preview</title>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should show calendar for denied users", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf(" <title>OSMBC Calendar Preview</title>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should show calendar for non existing users", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf(" <title>OSMBC Calendar Preview</title>")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET public /calendar/json",function(){
    let url = baseLink + "/calendar/json";
    it("should deny access without email", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("<h1>Please add your email to query. Thanks TheFive. undefined looks invalid.</h1>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should give json with email adress", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url+"?email=mail@server.domain"}, function (err, response, body) {
          should.not.exist(err);
          body = JSON.parse(body);
          should(body.generator).eql("TheFive Wiki Calendar Parser")
          should(response.statusCode).eql(200);
          bddone();
        });
      });
    });
  });
});


