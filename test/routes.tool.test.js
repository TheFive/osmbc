"use strict";

var should  = require("should");
var async   = require("async");
var config  = require("../config.js");
var request = require("request");
var testutil = require("./testutil.js");
var initialise = require("../util/initialise.js");


var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


describe("routes/tool", function() {
  before(function(bddone){
    async.series([
      initialise.initialiseModules,
      testutil.clearDB],bddone);
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
          body.should.containEql("<h1>Current OSM Wiki Calendar as Markdown</h1>");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
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
          body.should.containEql(" <h1>Calendar Tool (OSMBC)</h1>");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
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
          body.should.containEql("<h1>Generate OSMBC Picture Markdown</h1>");
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
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
          body.should.containEql("OSM User &gt;TestUserDenied&lt; has no access rights");
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          body.should.containEql("OSM User &gt;TestUserNonExisting&lt; has not enough access rights");
          bddone();
        });
      });
    });
  });
});


