"use strict";

/* jshint ignore:start */


const should  = require("should");
const config  = require("../config.js");

const HttpStatus = require("http-status-codes");

const nock = require("nock");
const testutil = require("./testutil.js");
const initialise = require("../util/initialise.js");
const userModule = require("../model/user.js");
const mockdate = require("mockdate");




const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


describe("routes/index", function() {
  let client;





  before(async function () {
    await initialise.initialiseModules();
    testutil.startServerSync();
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

    client = testutil.getWrappedAxiosClient();
    testutil.importData(
      {
        user: [{ OSMUser: "TestUser", access: "full", version: "1" },
          { OSMUser: "TestUserDenied", access: "denied" },
          { OSMUser: "Hallo", access: "full" }
        ],
        clear: true
      }, bddone);
  });
  afterEach(function(bddone) {
    return bddone();
  });

  describe("route GET /", function() {
    const url = baseLink + "/";
    it("should show home page", async function () {
      let body = await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      body = await client.get(url);
      body.data.should.containEql("<title>TESTBC</title>");
      body.data.should.containEql('<h2 class="d-none d-sm-block">Welcome to OSM BC</h2>');
      body.data.should.containEql("Full Access Index Page");
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should show Guest Homepage",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "You are logged in as guest. Please refer to "
      }));
  });
  describe("route GET /osmbc.html", function() {
    it("should redirect to /", async function() {
      let body = await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      body = await client.get(baseLink + "/osmbc.html");
      should(body.status).eql(302);

      should(body.data).eql("Found. Redirecting to /");
    });
  });
  describe("route GET /osmbc", function() {
    it("should redirect to /", async function() {
      let body = await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      body = await client.get(baseLink + "/osmbc");

      should(body.status).eql(302);
      should(body.data).eql("Found. Redirecting to /");
    });
  });
  describe("route GET /changelog", function() {
    const url = baseLink + "/changelog";
    it("should show changelog of software", async function () {
      let body = await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      body = await client.get(url);
      body.data.should.containEql("<h1>Changelog</h1>");
      const user = await userModule.findById(1);
      should(user).eql({
        id: "1",
        OSMUser: "TestUser",
        access: "full",
        version: 2,
        lastAccess: "2016-05-25T20:00:00.000Z",
        lastChangeLogView: "T.V.S"
      });
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should show changelog of software to guest",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<h1>Changelog</h1>"
      }));
  });
  describe("route POST /language", function() {
    const url = baseLink + "/language";

    async function requestLanguageSetter(client, whichLang, lang) {
      const form = {};
      form[whichLang] = lang;
      try {
        await client.post(baseLink + "/language?", form);
      } finally { }
    }

    it("should change language for full access", async function () {
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });


      await requestLanguageSetter(client, "lang", "ES");
      await requestLanguageSetter(client, "lang3", "EN");
      await requestLanguageSetter(client, "lang4", "EN");

      const user = await userModule.findById(1);
      should(user).eql({
        id: "1",
        OSMUser: "TestUser",
        access: "full",
        version: 4,
        mainLang: "ES",
        secondLang: "EN",
        lang3: null,
        lang4: null,
        langArray: ["ES", "EN"]
      });
    });

    it("should change language with complex changes", async function () {
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });

      await requestLanguageSetter(client, "lang", "ES");
      await requestLanguageSetter(client, "lang2", "PT-PT");
      await requestLanguageSetter(client, "lang3", "EN");
      await requestLanguageSetter(client, "lang4", "DE");
      // remove 3rd language after setting it to EN by setting it to none
      await requestLanguageSetter(client, "lang3", "none");


      const user = await userModule.findById(1);

      should(user).eql({
        id: "1",
        OSMUser: "TestUser",
        access: "full",
        version: 6,
        mainLang: "ES",
        secondLang: "PT-PT",
        lang3: "DE",
        lang4: null,
        langArray: ["ES", "PT-PT", "DE"]
      });
    });


    it("should change language for guest access", async function () {
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });

      await requestLanguageSetter(client, "lang", "ES");
      await requestLanguageSetter(client, "lang3", "EN");
      await requestLanguageSetter(client, "lang4", "EN");

      const user = await userModule.findOne({ OSMUser: "TestUserNonExisting" });
      should(user).eql({
        id: "4",
        OSMUser: "TestUserNonExisting",
        access: "guest",
        version: 4,
        mainLang: "ES",
        secondLang: "EN",
        mdWeeklyAuthor: "anonymous",
        lang3: null,
        lang4: null,
        langArray: ["ES", "EN"]
      });
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
  });
  describe("route POST /setuserconfig", function() {
    const url = baseLink + "/setuserconfig";
    const form = { view: "v1", option: "o1", value: "v2" };
    it("should set options for a view (full user)", async function () {
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });

      const body = await client.post(url, form);
      should(body.data).eql("OK");
      const user = await userModule.findById(1);
      should(user).eql({
        id: "1",
        OSMUser: "TestUser",
        access: "full",
        version: 2,
        option: { v1: { o1: "v2" } }
      });
    });
    it("should throw an error on missing option",
      testutil.checkPostUrlWithUser({
        url: url,
        username: "TestUser",
        password: "TestUser",
        form: { view: "v1", option: "o1" },
        expectedStatusCode: HttpStatus.BAD_REQUEST,
        expectedMessage: '<h1 id="errorTitle">missing value in option</h1>'
      }));

    it("should throw an error on missing view",
      testutil.checkPostUrlWithUser({
        url: url,
        username: "TestUser",
        password: "TestUser",
        form: {},
        expectedStatusCode: HttpStatus.BAD_REQUEST,
        expectedMessage: '<h1 id="errorTitle">missing view in option</h1>'
      }));
    it("should throw an error on missing value",
      testutil.checkPostUrlWithUser({
        url: url,
        form: { view: "V1" },
        username: "TestUser",
        password: "TestUser",
        expectedStatusCode: HttpStatus.BAD_REQUEST,
        expectedMessage: '<h1 id="errorTitle">missing option in option</h1>'
      }));
    it("should deny denied access user",
      testutil.checkPostUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        form: {},
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should set options for a view (guest user)", async function () {
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });

      const body = await client.post(url, form);
      should(body.data).eql("OK");
      const user = await userModule.findById(4);
      should(user).eql({
        id: "4",
        OSMUser: "TestUserNonExisting",
        access: "guest",
        mdWeeklyAuthor: "anonymous",
        version: 2,
        option: { v1: { o1: "v2" } }
      });
    });
  });
  describe("route GET /createblog", function() {
    const url = baseLink + "/createblog";
    it("should show changelog of software", async function () {
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });

      const body = await client.get(url);
      body.data.should.containEql("<h2>Create Blog Page</h2>");
      body.data.should.containEql(" onclick=\"location.href='/blog/create'\"");
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should deny non existing / guest user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
});

/* jshint ignore:end */
