import should from "should";
import sinon from "sinon";
import nock from "nock";
import fs from "fs";
import path from "path";
import config from "../config.js";
import HttpStatus from "http-status-codes";
import initialiseModules from "../util/initialise.js";
import help from "../routes/help.js";
import testutil from "./testutil.js";
import configModule from "../model/config.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();

// docs/admin-config.md describes every config of the admin page; each
// config page shows its own section as help.
describe("router/admin config help", function() {
  this.timeout(this.timeout() * 10);
  before(async function () {
    await testutil.clearDB();
    await initialiseModules();
    testutil.startServerSync();
  });
  after(function () {
    nock.cleanAll();
    testutil.stopServer();
  });
  beforeEach(function (bddone) {
    testutil.importData({
      user: [{ OSMUser: "TestUser", access: "full" }],
      clear: true
    }, bddone);
  });

  describe("docs/admin-config.md", function() {
    it("should have a section for every admin config", function () {
      // the configs created at start, see model/config.js initialise
      const source = fs.readFileSync(path.resolve(config.getDirName(), "model", "config.js"), "UTF8");
      const names = [...source.matchAll(/initConfigElement\.bind\(null, "([^"]+)"\)/g)].map(m => m[1]);
      should(names).containEql("slacknotification");
      // the First Draft prompt is not documented for all editors yet
      const missing = names.filter(n => n !== "firstdraftprompt" && help.getDocSection("admin-config.md", n) === null);
      should(missing).eql([]);
    });
    it("should return only the section of one config", function () {
      const votes = help.getDocSection("admin-config.md", "votes");
      votes.should.containEql("displayAtTop");
      votes.should.not.containEql("notifyNewCollection");
      should(help.getDocSection("admin-config.md", "noSuchConfig")).be.null();
    });
    it("should point links to other docs to the repository", function () {
      const section = help.getDocSection("admin-config.md", "slacknotification");
      section.should.containEql('href="https://github.com/TheFive/osmbc/blob/master/docs/config.md#notifications"');
    });
  });

  describe("route GET /config/:name", function() {
    it("should show the help for the config", async function () {
      const client = testutil.getWrappedAxiosClient();
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const body = (await client.get(baseLink + "/config/slacknotification")).data;
      body.should.containEql('<details class="mb-3" id="configHelp"><summary>Help for this configuration</summary>');
      body.should.containEql("<code>notifyGuestTextChange</code>");
      body.should.containEql('href="/help/admin-config"');
    });
  });

  describe("help menu entry", function() {
    afterEach(function () { sinon.restore(); });
    async function menuOf(username) {
      const getConfig = configModule.getConfig;
      sinon.stub(configModule, "getConfig").callsFake(function(name) {
        if (name === "helpmenu") return [["OSMBC", "header"], ["Changelog", "https://example.com/changelog"], ["Admin configurations", "~/help/admin-config"]];
        return getConfig(name);
      });
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: username, password: username });
      return (await client.get(baseLink + "/osmbc.html")).data;
    }
    it("should show the admin configuration help to full users", async function () {
      (await menuOf("TestUser")).should.containEql('<a class="dropdown-item" href="/help/admin-config">Admin configurations</a>');
    });
    it("should hide it from guests", async function () {
      const body = await menuOf("TestUserNewGuest");
      body.should.containEql('<a class="dropdown-item" href="https://example.com/changelog">Changelog</a>');
      body.should.not.containEql("/help/admin-config");
    });
  });

  describe("route GET /help/admin-config", function() {
    const url = baseLink + "/help/admin-config";
    it("should show the whole document to a full user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUser",
        password: "TestUser",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "<h1>Admin configurations</h1>"
      }));
    it("should deny a guest user",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUserNewGuest",
        password: "TestUserNewGuest",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "OSM User >TestUserNewGuest< has not enough access rights"
      }));
  });
});
