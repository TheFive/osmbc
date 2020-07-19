"use strict";

/* jshint ignore:start */


const should  = require("should");
const async   = require("async");
const config  = require("../config.js");
const rp = require("request-promise-native");
const request = require("request");
const HttpStatus = require("http-status-codes");

var nock = require("nock");
var testutil = require("./testutil.js");
var initialise = require("../util/initialise.js");
var userModule = require("../model/user.js");
var mockdate = require("mockdate");

var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


describe("routes/index", function() {

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

  beforeEach(function(bddone) {
    config.initialise();
    mockdate.set(new Date("2016-05-25T20:00:00Z"));
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
  beforeEach(function(bddone){
    return bddone();
  });
  afterEach(function(bddone){
    return bddone();
  });

  describe("route GET /", function() {
    let url = baseLink + "/";
    it("should show home page", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<title>TESTBC</title>");
      body.should.containEql("<h2 class=\"hidden-xs\">Welcome to OSM BC</h2>");
      body.should.containEql("Full Access Index Page");
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
    it("should show Guest Homepage",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "You are logged in as guest. Please refer to "}));
  });
  describe("route GET /osmbc.html", function() {
    it("should redirect to /", async function() {
      let response = await rp.get({
        url: baseLink + "/osmbc.html",
        followRedirect: false,
        jar: jar.testUser, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(302);
      should(response.body).eql("Found. Redirecting to /");
    });
  });
  describe("route GET /osmbc", function() {
    it("should redirect to /", async function() {
      let response = await rp.get({
        url: baseLink + "/osmbc",
        followRedirect: false,
        jar: jar.testUser, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(302);
      should(response.body).eql("Found. Redirecting to /");
    });
  });
  describe("route GET /changelog", function() {
    let url = baseLink + "/changelog";
    it("should show changelog of software", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h1>Changelog</h1>");
      let user = await userModule.findById(1);
      should(user).eql({
        id: "1",
        OSMUser: "TestUser",
        access: "full",
        version: 2,
        lastAccess: "2016-05-25T20:00:00.000Z",
        lastChangeLogView: "1.8.4"
      });
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
    it("should show changelog of software to guest",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<h1>Changelog</h1>"}));
  });
  describe("route GET /language", function() {
    let url = baseLink + "/language?lang=DE";

    function requestLanguageSetter(user,whichLang, lang) {
      function _requestLanguageSetter(whichlang, lang, cb) {
        request.get({url: baseLink + "/language?" + whichlang + "=" + lang, jar: jar[user]}, function (err, response) {
          should.not.exist(err);
          should(response.statusCode).eql(200);
          return cb();
        });
      }
      return new Promise((resolve,reject) => _requestLanguageSetter(whichLang,lang,(err) => (err)? reject(err):resolve()));
    }

    it("should change language for full access", async function () {

      await requestLanguageSetter("testUser","lang", "ES");
      await requestLanguageSetter("testUser","lang3", "EN");
      await requestLanguageSetter("testUser","lang4", "EN");

      let user = await userModule.findById(1);
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
    });
    it("should change language for guest access", async function () {

      await requestLanguageSetter("testUserNonExisting", "lang", "ES");
      await requestLanguageSetter("testUserNonExisting", "lang3", "EN");
      await requestLanguageSetter("testUserNonExisting", "lang4", "EN");

      let user = await userModule.findOne({OSMUser:"TestUserNonExisting"});
      should(user).eql({
        id: "4",
        OSMUser: "TestUserNonExisting",
        access: "guest",
        version: 4,
        lastAccess: "2016-05-25T20:00:00.000Z",
        mainLang: "ES",
        secondLang: "EN",
        mdWeeklyAuthor: "anonymous",
        lang3: null,
        lang4: null
      });
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
  });
  describe("route GET /userconfig", function() {
    let url = baseLink + "/userconfig?view=v1&option=o1&value=v2";
    it("should set options for a view (full user)", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      should(body).eql("changed");
      let user = await userModule.findById(1);
      should(user).eql({
        id: "1",
        OSMUser: "TestUser",
        access: "full",
        lastAccess: "2016-05-25T20:00:00.000Z",
        version: 2,
        option: { v1: { o1: "v2" } }
      });
    });
    it("should throw an error on missing option",
      checkUrlWithJar({
        url: baseLink + "/userconfig?view=v1&option=o1",
        user: "testUser",
        expectedStatusCode: HttpStatus.BAD_REQUEST,
        expectedMessage: "<h1>missing value in option</h1>"}));

    it("should throw an error on missing view",
      checkUrlWithJar({
        url: baseLink + "/userconfig",
        user: "testUser",
        expectedStatusCode: HttpStatus.BAD_REQUEST,
        expectedMessage: "<h1>missing view in option</h1>"}));
    it("should throw an error on missing value",
      checkUrlWithJar({
        url: baseLink + "/userconfig?view=V1",
        user: "testUser",
        expectedStatusCode: HttpStatus.BAD_REQUEST,
        expectedMessage: "<h1>missing option in option</h1>"}));
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
    it("should set options for a view (guest user)", async function () {
      let body = await rp.get({url: url, jar: jar.testUserNonExisting});
      should(body).eql("changed");
      let user = await userModule.findById(4);
      should(user).eql({
        id: "4",
        OSMUser: "TestUserNonExisting",
        access: "guest",
        lastAccess: "2016-05-25T20:00:00.000Z",
        mdWeeklyAuthor: "anonymous",
        version: 2,
        option: { v1: { o1: "v2" } }
      });
    });
  });
  describe("route GET /createblog", function() {
    let url = baseLink + "/createblog";
    it("should show changelog of software", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h2>Create Blog Page</h2>");
      body.should.containEql(" onclick=\"location.href='/blog/create'\"");
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
    it("should deny non existing / guest user",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"}));
  });
});

/* jshint ignore:end */
