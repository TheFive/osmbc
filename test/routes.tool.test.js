"use strict";

var should  = require("should");
var async   = require("async");
var nock    = require("nock");
var request = require("request");
const rp = require("request-promise-native");
const HttpStatus = require("http-status-codes");


var config  = require("../config.js");
var testutil = require("./testutil.js");
var initialise = require("../util/initialise.js");


var baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


describe("routes/tool", function() {
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
    bddone();
  });


  afterEach(function(bddone){
    return bddone();
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
  describe("route GET  /tool/calendarAllLang",function(){
    before(function(bddone){
      nock('http://localhost:33333')
        .get('/fakeCalendar')
        .reply(200,{events:[]});
      bddone();
    });
    let url = baseLink + "/tool/calendarAllLang/fakeCalendar";
    it("should show calendar", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h1>Calendar Tool (fakeCalendar)</h1>");
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
  describe("route GET  /tool/picturetool",function(){
    let url = baseLink + "/tool/picturetool";
    it("should show picture tool", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h1>Generate OSMBC Picture Markdown</h1>");
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
  describe("route POST /tool/picturetool",function(){
    let url = baseLink + "/tool/picturetool";
    it("should call picture tool", async function () {
      let response = await rp.post({
        url: url,
        form: {},
        jar: jar.testUser, simple: false, resolveWithFullResponse: true
      });
      should(response.statusCode).eql(302);
      should(response.body).eql("Found. Redirecting to /tool/picturetool");
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


