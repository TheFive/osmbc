"use strict";

/* jshint ignore:start */


const should = require("should");
const async  = require("async");
const nock   = require("nock");
const config = require("../config.js");
const rp = require("request-promise-native");
const request = require("request");
const HttpStatus = require("http-status-codes");const userModule = require("../model/user.js");
const testutil = require("./testutil.js");
const initialise = require("../util/initialise.js");

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();

describe("router/user", function() {
  this.timeout(10000);
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
    jar.testUserNewGuest = await testutil.getUserJar("TestUserNewGuest");
  });

  after(function (bddone) {
    nock.cleanAll();
    testutil.stopServer();
    bddone();
  });

  beforeEach(function(bddone) {
    config.initialise();
    testutil.importData(
      {
        user: [{OSMUser: "TestUser", access: "full",version:"1",id:1,lastAccess:"20160102"},
          {OSMUser: "TestUserDenied", access: "denied"},
          { "OSMUser": "Hallo", access: "full"}
        ],
        clear:true
      },bddone);
  });
  describe("routes GET /inbox", function(){
    let url = baseLink + "/usert/inbox";
    it("should show the users inbox", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<h2>Inbox Direct Mention:</h2>");
    });
    it("should deny denied access user",
      checkUrlWithJar({
        url: url,
        user: "testUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"}));
    it("should give direct mentions for  non existing / guest user",
      checkUrlWithJar({
        url: url,
        user: "testUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<h2>Inbox Direct Mention:</h2>"}));
  });
  describe("routes GET /list", function(){
    let url = baseLink + "/usert/list";
    it("should show list of users", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql("<td><a href=\"/usert/1\">TestUser</a>");
      body.should.containEql("<td><a href=\"/usert/2\">TestUserDenied</a>");
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
  describe("routes GET /create", function(){
    let url = baseLink + "/usert/create";
    it("should create a new user", async function () {
      let response = await rp.get({url: url, jar: jar.testUser, followRedirect: false, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(302);

      // New user has id 4, as there are 3 in test data.
      should(response.body).eql("Found. Redirecting to /usert/4?edit=true");
      let user = await userModule.findById(4);

      should.exist(user);
      should(user).eql({
        "id": "4",
        "version": 1,
        "mailAllComment": "false",
        "mailBlogLanguageStatusChange": [],
        "mailComment": [],
        "mailNewCollection": "false"
      });
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
  describe("routes GET /createApiKey", function(){
    let url = baseLink + "/usert/createApiKey";
    it("should create a new Api Key", async function () {
      let response = await rp.get({
        url: url, followRedirect: false,
        jar: jar.testUser, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(302);
      should(response.body).eql("Found. Redirecting to /");
      let user = await userModule.findById(1);
      should.exist(user.apiKey);
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
  describe("routes GET /:user_id", function(){
    let url = baseLink + "/usert/1";
    it("should show user dafta by id", async function () {
      let body = await rp.get({url: url, jar: jar.testUser});
      body.should.containEql('<input class="form-control" name="OSMUser" id="OSMUser" value="TestUser" readonly="readonly"/>');
      body.should.containEql("<h1>TestUser Heatmap</h1>");
    });
    it("should show user data by SELF", async function () {
      let response = await rp.get({url: baseLink + "/usert/self",
        jar: jar.testUser, followRedirect: false, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(302);
      should(response.body).eql("Found. Redirecting to /usert/1");
    });
    it("should show user data by NAME", async function () {
      let body = await rp.get({url: baseLink + "/usert/TestUserDenied", jar: jar.testUser});
      body.should.containEql('<h1>TestUserDenied Heatmap</h1>');
    });
    it("should show user data for fresh created guest user", async function () {
      let body = await rp.get({
        url: baseLink + "/usert/TestUserNewGuest",
        jar: jar.testUserNewGuest, followRedirect: false});
      body.should.containEql('<h1>TestUserNewGuest Heatmap</h1>');
    });
    it("should not show user data of other user for fresh created guest user", async function() {
      let response = await rp.get({
        url: baseLink + "/usert/TestUserDenied",
        followRedirect: false, simple: false, resolveWithFullResponse: true, jar: jar.testUserNewGuest});

      should(response.statusCode).eql(HttpStatus.FORBIDDEN);
      response.body.should.containEql("Not allowed for guests.");
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
        expectedMessage: "Not allowed for guests."}));
  });
  describe("routes POST /:user_id", function(){
    let url = baseLink + "/usert/2";
    it("should change user data", async function () {
      let response = await rp.post({
        url: url, form: {color:"red",language:"ES"},
        jar: jar.testUser, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(302);
      let user = await userModule.findById(2);

      should(user).eql({
        id: '2',
        OSMUser: 'TestUserDenied',
        access: 'denied',
        version: 2,
        mailComment:  [],
        color: 'red',
        language: 'ES',
        languageCount: 'two',
        mailBlogLanguageStatusChange:  []
      });
    });
    it("should deny denied access user", async function () {
      let response = await rp.post({
        url: url, form: {color:"red",language:"ES"},
        jar: jar.testUserDenied, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(HttpStatus.FORBIDDEN);
      response.body.should.containEql("OSM User >TestUserDenied< has no access rights");
    });
    it("should deny non existing user", async function () {
      let response = await rp.post({
        url: url, form: {color:"red",language:"ES"},
        jar: jar.testUserNonExisting, simple: false, resolveWithFullResponse: true});
      should(response.statusCode).eql(HttpStatus.FORBIDDEN);
      response.body.should.containEql("Not Allowed To Post this user");
    });
  });
});


/* jshint ignore:end */
