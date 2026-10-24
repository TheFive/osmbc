import should from "should";
import nock from "nock";
import sinon from "sinon";
import config from "../config.js";
import HttpStatus from "http-status-codes";
import initialiseModules from "../util/initialise.js";

import firstDraft from "../model/firstDraft.js";

import testutil from "./testutil.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();


describe("router/firstDraft", function() {
  this.timeout(this.timeout() * 10);
  let create;

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
    create = sinon.stub();
    firstDraft.fortestonly.setClient({ beta: { messages: { create: create } } });
    testutil.importData(
      {
        blog: [{ name: "BLOG", status: "edit" }],
        user: [{ OSMUser: "TestUser", access: "full" },
          { OSMUser: "Hallo", access: "full" }],
        article: [{ blog: "BLOG", title: "Party", collection: "https://news.example.org/party", markdownDE: "" }],
        clear: true
      }, bddone);
  });
  afterEach(function () {
    nock.cleanAll();
    sinon.restore();
  });

  describe("route POST /article/firstdraft/:lang", function() {
    const url = baseLink + "/article/firstdraft/EN";
    const form = { url: "https://news.example.org/party" };

    it("should return the draft for a user of the group", async function () {
      nock("https://news.example.org").get("/party")
        .reply(200, "<html><body><article><p>The Bonn group mapped all benches in the city park, forty people joined.</p></article></body></html>",
          { "Content-Type": "text/html" });
      create.resolves({ stop_reason: "end_turn", content: [{ type: "text", text: "The Bonn group [mapped](https://news.example.org/party) all benches." }] });

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const response = await client.post(url, form);

      should(response.status).eql(HttpStatus.OK);
      should(response.data).eql("The Bonn group [mapped](https://news.example.org/party) all benches.");
    });
    it("should return markdown and title as JSON with withTitle", async function () {
      nock("https://news.example.org").get("/party")
        .reply(200, "<html><body><article><p>The Bonn group mapped all benches in the city park, forty people joined.</p></article></body></html>",
          { "Content-Type": "text/html" });
      create.resolves({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ markdown: "The Bonn group mapped all benches.", title: "Bench mapping" }) }] });

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const response = await client.post(url, { url: form.url, withTitle: "true" });

      should(response.status).eql(HttpStatus.OK);
      should(response.data).eql({ markdown: "The Bonn group mapped all benches.", title: "Bench mapping" });
    });
    it("should report a failure with an error status", async function () {
      nock("https://news.example.org").get("/party").reply(500, "broken");

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const response = await client.post(url, form);

      should(response.status).eql(HttpStatus.BAD_GATEWAY);
      should(create.called).be.false();
    });
    it("should deny a full user outside the group",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "Hallo",
        password: "Hallo",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "First Draft is not enabled for Hallo"
      }));
  });

  describe("route GET /config/firstdraftprompt", function() {
    const url = baseLink + "/config/firstdraftprompt";
    it("should show the prompt to a user of the group",
      testutil.checkUrlWithUser({
        url: url,
        username: "TestUser",
        password: "TestUser",
        expectedStatusCode: HttpStatus.OK,
        expectedMessage: "weekly OpenStreetMap news"
      }));
    it("should deny a full user outside the group",
      testutil.checkUrlWithUser({
        url: url,
        username: "Hallo",
        password: "Hallo",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "First Draft is not enabled for Hallo"
      }));
    it("should deny saving the prompt for a user outside the group",
      testutil.checkPostUrlWithUser({
        url: url,
        form: { text: "new prompt" },
        username: "Hallo",
        password: "Hallo",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "First Draft is not enabled for Hallo"
      }));
  });

  describe("route GET /article/:id", function() {
    it("should show the First Draft menu to a user of the group", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const response = await client.get(baseLink + "/article/1");

      should(response.status).eql(HttpStatus.OK);
      should(response.data).containEql("articleFirstDraftMenu");
      should(response.data).containEql("data-url=\"https://news.example.org/party\"");
    });
    it("should hide the First Draft menu for a user outside the group", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "Hallo", password: "Hallo" });
      const response = await client.get(baseLink + "/article/1");

      should(response.status).eql(HttpStatus.OK);
      should(response.data).not.containEql("articleFirstDraftMenu");
    });
  });
});
