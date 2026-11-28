import should from "should";
import sinon from "sinon";
import nock from "nock";
import config from "../config.js";
import HttpStatus from "http-status-codes";
import userModule from "../model/user.js";
import testutil from "./testutil.js";
import logModule from "../model/logModule.js";
import initialiseModules from "../util/initialise.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();

describe("router/user", function() {
  this.timeout(10000);





  before(async function () {
    await testutil.clearDB();
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
  describe("routes GET /list with pages", function() {
    const url = baseLink + "/usert/list";
    beforeEach(function(bddone) {
      const user = [{ OSMUser: "TestUser", access: "full", id: 1 }];
      for (let i = 0; i < 204; i++) user.push({ OSMUser: "User" + String(i).padStart(3, "0"), access: "guest" });
      testutil.importData({ user: user, clear: true }, bddone);
    });
    async function listPage(query) {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      return (await client.get(url + query)).data;
    }
    it("should show the first 100 users and a link to the next page", async function () {
      const body = await listPage("");
      should(body).containEql("Page 1 of 3 (205 users)");
      should(body).containEql(">TestUser</a>");
      should(body).containEql(">User098</a>");
      should(body).not.containEql(">User099</a>");
      should(body).containEql('id="nextPage" href="/usert/list?page=2"');
      should(body).not.containEql('id="previousPage"');
    });
    it("should show the last page and keep filter and sort in the links", async function () {
      const body = await listPage("?access=guest&sort=OSMUser&page=3");
      should(body).containEql("Page 3 of 3 (204 users)");
      should(body).containEql(">User203</a>");
      should(body).not.containEql(">User199</a>");
      should(body).containEql('id="previousPage" href="/usert/list?access=guest&amp;sort=OSMUser&amp;page=2"');
      should(body).not.containEql('id="nextPage"');
    });
    it("should show the last page for a page number that is too high or invalid", async function () {
      should(await listPage("?page=99")).containEql("Page 3 of 3");
      should(await listPage("?page=abc")).containEql("Page 1 of 3");
    });
    it("should sort by number of changes over all users, not only the shown page", async function () {
      await logModule.log({ table: "article", user: "User150", oid: "1", property: "markdownDE" });
      const body = await listPage("?sort=OSMBC-changes");
      should(body.indexOf(">User150</a>")).be.above(-1);
      should(body.indexOf(">User150</a>")).be.below(body.indexOf(">TestUser</a>"));
    });
  });
  describe("routes GET /list with search", function() {
    const url = baseLink + "/usert/list";
    beforeEach(function(bddone) {
      const user = [{ OSMUser: "TestUser", access: "full", id: 1 },
        { OSMUser: "FreshGuest", access: "guest", SlackUser: "fresh-mm" },
        { OSMUser: "OtherGuest", access: "guest" }];
      for (let i = 0; i < 120; i++) user.push({ OSMUser: "Mapper" + String(i).padStart(3, "0"), access: "guest" });
      testutil.importData({ user: user, clear: true }, bddone);
    });
    async function listPage(query) {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      return client.get(url + query);
    }
    it("should show only the users that match and say how many", async function () {
      const body = (await listPage("?access=guest&search=fresh")).data;
      should(body).containEql(">FreshGuest</a>");
      should(body).not.containEql(">OtherGuest</a>");
      should(body).containEql('<p id="userSearchCount">1 user found</p>');
      should(body).containEql('value="fresh"');
    });
    it("should find the Mattermost name", async function () {
      should((await listPage("?search=FRESH-MM")).data).containEql(">FreshGuest</a>");
    });
    it("should keep the search in the page and sort links and the filter in the form", async function () {
      const body = (await listPage("?access=guest&search=mapper&page=2")).data;
      should(body).containEql("Page 2 of 2 (120 users)");
      should(body).containEql('id="previousPage" href="/usert/list?access=guest&amp;search=mapper&amp;page=1"');
      should(body).containEql('id="sortWeeklyAuthor" href="/usert/list?access=guest&amp;search=mapper&amp;sort=mdWeeklyAuthor"');
      should(body).containEql('<input type="hidden" name="access" value="guest">');
      should(body).not.containEql('name="page"');
    });
    it("should answer 400 for a search that is not a text", async function () {
      const response = await listPage("?search=a&search=b");
      should(response.status).eql(HttpStatus.BAD_REQUEST);
    });
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
        notifyNewCollection: "off",
        notifyCollectionChange: "off",
        notifyGuestTextChange: "false"
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

      body.data.should.containEql('<input class="form-control" name="OSMUser" id="OSMUser" value="TestUser" readonly="readonly"/>');
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
  describe("article notification settings (#1170)", function() {
    afterEach(function() { sinon.restore(); });
    async function userPage() {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      return { client: client, body: (await client.get(baseLink + "/usert/1")).data };
    }
    it("should show the old mailNewCollection as all for both new settings", async function () {
      const user = await userModule.findById(1);
      user.mailNewCollection = "true";
      await new Promise((resolve, reject) => user.save(err => err ? reject(err) : resolve()));
      const { body } = await userPage();
      body.should.match(/<select class="form-control" id="notifyNewCollection" name="notifyNewCollection"><option value="all" selected/);
      body.should.match(/<select class="form-control" id="notifyCollectionChange" name="notifyCollectionChange"><option value="all" selected/);
      body.should.containEql('id="notifyGuestTextChange"');
      // without MattermostUserNotification in the config: mail only
      body.should.not.containEql('id="notifyVia"');
    });
    it("should offer Mattermost when it is configured", async function () {
      const getValue = config.getValue;
      sinon.stub(config, "getValue").callsFake(function(key, ...rest) {
        if (key === "MattermostUserNotification") return { team: "theweeklyosm" };
        return getValue.call(config, key, ...rest);
      });
      const { body } = await userPage();
      body.should.containEql('id="notifyVia"');
      body.should.containEql('<option value="mattermost">Mattermost direct message</option>');
    });
    it("should save the new settings", async function () {
      const { client } = await userPage();
      const result = await client.post(baseLink + "/usert/1", {
        // the form always sends the name, a logged in user can't rename
        OSMUser: "TestUser",
        notifyNewCollection: "guest",
        notifyCollectionChange: "off",
        notifyGuestTextChange: "true",
        notifyVia: "both"
      });
      should(result.status).eql(302);
      const user = await userModule.findById(1);
      should(user.notifyNewCollection).eql("guest");
      should(user.notifyCollectionChange).eql("off");
      should(user.notifyGuestTextChange).eql("true");
      should(user.notifyVia).eql("both");
    });
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


