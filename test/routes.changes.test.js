"use strict";


var nock  = require("nock");
var should = require("should");
var request = require("request");
var config = require("../config");



var testutil = require("../test/testutil.js");
var logModule = require("../model/logModule.js");
var mockdate = require("mockdate");

var baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");





describe("routes/changes", function() {
  this.timeout(3000);
  let changeid;

  after(function (bddone) {
    nock.cleanAll();
    bddone();
    mockdate.reset();
  });

  beforeEach(function (bddone) {
    // Clear DB Contents for each test
    mockdate.set(new Date("2016-05-25T20:00"));
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.importData(
      {
        blog: [{name: "WN333", status: "edit"},
          {name: "secondblog", status: "edit", reviewCommentDE: [{text: "first review", user: "TestUser"}]}],
        user: [{"OSMUser": "TestUser", access: "full"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"}
        ],
        change: [{"oid": "321",
          "blog": "WN333",
          "user": "TestUser",
          "table": "blog",
          "property": "status",
          "from": "open",
          "to": "trash",
          "timestamp": "2016-01-26T21:31:59.879Z"}],
        article: [
          {"blog": "WN333", "markdownDE": "* Dies ist ein kleiner Testartikel.", "category": "Mapping"},
          {"blog": "BLOG", "title": "BLOG", "markdownDE": "* Dies ist ein grosser Testartikel.", "category": "Keine", commentList: [{user: "Hallo", text: "comment"}]}],
        clear: true}, function(err) {
        if (err) bddone(err);
        logModule.find({timestamp: "2016-01-26T21:31:59.879Z"}, function(err, log) {
          changeid = log[0].id;
          bddone();
        });
      });
  });
  describe("route GET /:change_id", function() {
    it("should display one change id", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: baseLink + "/changes/" + changeid}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<td>2016-01-26T21:31:59.879Z (4 months ago)</td>")).not.equal(-1);
          should(body.indexOf("<td>WN333</td>")).not.equal(-1);
          should(body.indexOf("<td>TestUser</td>")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny denied access user", function (bddone) {
      testutil.startServer("TestUserDenied", function () {
        request.get({url: baseLink + "/changes/" + changeid}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserDenied&lt; has no access rights")).not.equal(-1);
          bddone();
        });
      });
    });
    it("should deny non existing user", function (bddone) {
      testutil.startServer("TestUserNonExisting", function () {
        request.get({url: baseLink + "/changes/" + changeid}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(500);
          should(body.indexOf("OSM User &gt;TestUserNonExisting&lt; is not an OSMBC user.")).not.equal(-1);
          bddone();
        });
      });
    });
  });
  describe("route GET /log", function() {
    let url = baseLink + "/changes/log";
    it("should show list", function (bddone) {
      testutil.startServer("TestUser", function () {
        request.get({url: url}, function (err, response, body) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          should(body.indexOf("<td><a href=\"/changes/2\"><span class=\"glyphicon glyphicon-info-sign\"></span></a></td>")).not.equal(-1);
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




