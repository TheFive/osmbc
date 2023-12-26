import should from "should";
import nock from "nock";
import config from "../config.js";
import HttpStatus from "http-status-codes";
import userModule from "../model/user.js";
import testutil from "./testutil.js";
import initialiseModules from "../util/initialise.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();

describe("router/user", function() {
  this.timeout(10000);





  before(async function () {
    await initialiseModules();
    testutil.startServerSync();
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
        user: [{ OSMUser: "TestUser", access: "full", version: "1", id: 1, lastAccess: "20160102" },
          { OSMUser: "TestUserDenied", access: "denied" },
          { OSMUser: "Hallo", access: "full" }
        ],
        clear: true
      }, bddone);
  });
  describe("routes GET /inbox", function() {
    const url = baseLink + "/usert/inbox";
    it("should show the users inbox", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);
      body.data.should.containEql("<h2>Inbox Direct Mention:</h2>");
    });
    it("should deny denied access user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserDenied",
        password: "TestUserDenied",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserDenied< has no access rights"
      }));
    it("should give direct mentions for  non existing / guest user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<h2>Inbox Direct Mention:</h2>"
      }));
  });
  describe("routes GET /list", function() {
    const url = baseLink + "/usert/list";
    it("should show list of users", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);
      body.data.should.containEql("<td><a href=\"/usert/1\">TestUser</a>");
      body.data.should.containEql("<td><a href=\"/usert/2\">TestUserDenied</a>");
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
  describe("routes GET /create", function() {
    const url = baseLink + "/usert/create";
    it("should create a new user", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);
      should(body.status).eql(302);

      // New user has id 4, as there are 3 in test data.
      should(body.data).eql("Found. Redirecting to /usert/4?edit=true");
      const user = await userModule.findById(4);

      should.exist(user);
      should(user).eql({
        id: "4",
        version: 1,
        mailAllComment: "false",
        mailBlogLanguageStatusChange: [],
        mailComment: [],
        mailNewCollection: "false"
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
    it("should deny non existing / guest user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNonExisting",
        password: "TestUserNonExisting",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNonExisting< has not enough access rights"
      }));
  });
  describe("routes GET /createApiKey", function() {
    const url = baseLink + "/usert/createApiKey";
    it("should create a new Api Key", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);
      should(body.status).eql(302);
      should(body.data).eql("Found. Redirecting to /osmbc");
      const user = await userModule.findById(1);
      should.exist(user.apiKey);
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
  describe("routes GET /:user_id", function() {
    const url = baseLink + "/usert/1";
    it("should show user dafta by id", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(url);

      body.data.should.containEql('<input class="col-5 form-control" name="OSMUser" id="OSMUser" value="TestUser" readonly="readonly"/>');
      body.data.should.containEql("<h1>TestUser Heatmap</h1>");
    });
    it("should show user data by SELF", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/usert/self");
      should(body.status).eql(302);
      should(body.data).eql("Found. Redirecting to /usert/1");
    });
    it("should show user data by NAME", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.get(baseLink + "/usert/TestUserDenied");
      body.data.should.containEql("<h1>TestUserDenied Heatmap</h1>");
    });
    it("should show user data for fresh created guest user", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUserNewGuest", password: "TestUserNewGuest" });
      const body = await client.get(baseLink + "/usert/TestUserNewGuest");

      body.data.should.containEql("<h1>TestUserNewGuest Heatmap</h1>");
    });
    it("should not show user data of other user for fresh created guest user", async function() {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUserNewGuest", password: "TestUserNewGuest" });
      const body = await client.get(baseLink + "/usert/TestUserDenied");

      should(body.status).eql(HttpStatus.FORBIDDEN);
      body.data.should.containEql("Not allowed for guests.");
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
        expectedMessage: "Not allowed for guests."
      }));
  });
  describe("routes POST /:user_id", function() {
    const url = baseLink + "/usert/2";
    it("should change user data", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = await client.post(url, { color: "red", language: "ES" });

      should(body.status).eql(302);
      const user = await userModule.findById(2);

      should(user).eql({
        id: "2",
        OSMUser: "TestUserDenied",
        access: "denied",
        version: 2,
        mailComment: [],
        color: "red",
        language: "ES",
        languageCount: "two",
        translationServices: [],
        translationServicesMany: [],
        mailBlogLanguageStatusChange: []
      });
    });
    it("should deny denied access user", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUserDenied", password: "TestUserDenied" });
      const body = await client.post(url, { color: "red", language: "ES" });

      should(body.status).eql(HttpStatus.FORBIDDEN);
      body.data.should.containEql("OSM User >TestUserDenied< has no access rights");
    });
    it("should deny non existing user", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUserNonExisting", password: "TestUserNonExisting" });
      const body = await client.post(url, { color: "red", language: "ES" });
      should(body.status).eql(HttpStatus.FORBIDDEN);
      body.data.should.containEql("Not Allowed To Post this user");
    });
  });
});


