"use strict";

/* jshint ignore:start */


const nock  = require("nock");
const should = require("should");
const request = require("request");
const rp = require("request-promise-native");
const HttpStatus = require("http-status-codes");

var config = require("../config");
var initialise = require("../util/initialise.js");




var testutil = require("../test/testutil.js");
var logModule = require("../model/logModule.js");
var mockdate = require("mockdate");

var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();



const changeid = "9"; // this has to be fix, as current test structure expects fix urls.


describe("routes/changes", function() {
  this.timeout(this.timeout() * 2);
  let jar = {};
  function checkUrlWithJar(options) {
    return async function() {
      should.exist(options.user);
      should.exist(jar[options.user]);
      should.exist(options.url);
      should.exist(options.expectedMessage);
      should.exist(options.expectedStatusCode);
      let response = await rp.get({url: options.url, jar: jar[options.user], simple: false, resolveWithFullResponse: true});
      response.body.should.containEql(options.expectedMessage);
      should(response.statusCode).eql(options.expectedStatusCode);
    };
  }



  before(async function () {
    await initialise.initialiseModules();
    testutil.startServerSync();
    jar.testUser = await testutil.getUserJar("TestUser");
    jar.testUserDenied = await testutil.getUserJar("TestUserDenied");
    jar.hallo = await testutil.getUserJar("Hallo");
    jar.testUserNonExisting = await testutil.getUserJar("TestUserNonExisting");
  });

  after(function (bddone) {
    nock.cleanAll();
    testutil.stopServer();
    mockdate.reset();
    bddone();
  });

  afterEach(function(bddone) {
    return bddone();
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
          should(changeid).eql(log[0].id);

          bddone();
        });
      });
  });
  describe("route GET /:change_id", function() {
    let url =  baseLink + "/changes/" + changeid;
    it("should display one change id", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<td>2016-01-26T21:31:59.879Z (4 months ago)</td>");
      body.should.containEql("<td>WN333</td>");
      body.should.containEql("<td>TestUser</td>");
    });

    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"}));
  });
  describe("route GET /log", function() {
    let url = baseLink + "/changes/log";
    it("should show list", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql('<td><a href="/changes/2"><i class="fa fa-info-circle"></i></a></td>');
    });

    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing user",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"}));
  });
});


/* jshint ignore:end */
