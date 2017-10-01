"use strict";

var should  = require("should");
var sinon   = require("sinon");
var async   = require("async");
var config  = require("../config.js");
var request = require("request");
var testutil = require("./testutil.js");

var baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");


describe("routes/index", function() {
  before(function(bddone) {
    config.initialise();
    testutil.importData(
      {
        user: [{"OSMUser": "TestUser", access: "full"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"}
        ],
        clear:true
      },bddone);
  });
  describe.skip("route GET /",function(){
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
  describe.skip("route GET /osmbc.html",function(){
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
  describe.skip("route GET /osmbc",function(){
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
  describe("route GET /osmbc/sql/longRunningQueries",function(){});
  describe("route GET /help/:title",function(){});
  describe("route GET /changelog",function(){});
  describe("route GET /language",function(){});
  describe("route GET /userconfig",function(){});
  describe("route GET /createblog",function(){});
});
