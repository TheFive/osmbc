import should from "should";
import nock from "nock";
import sinon from "sinon";
import config from "../config.js";
import HttpStatus from "http-status-codes";
import initialiseModules from "../util/initialise.js";

import firstDraft from "../model/firstDraft.js";
import articleModule from "../model/article.js";
import logModule from "../model/logModule.js";

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

    function pageWithParty() {
      nock("https://news.example.org").get("/party")
        .reply(200, "<html><body><article><p>The Bonn group mapped all benches in the city park, forty people joined.</p></article></body></html>",
          { "Content-Type": "text/html" });
      create.resolves({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ markdown: "The Bonn group mapped all benches.", title: "Bench mapping", category: "Mapping" }) }] });
    }
    async function loggedIn() {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      return client;
    }
    async function markdownChanges(title) {
      const articles = await articleModule.find({ title: title });
      should(articles.length).eql(1);
      const changes = await logModule.find({ table: "article", oid: articles[0].id, property: "markdownEN" }, { column: "id" });
      return { article: articles[0], changes: changes.map((c) => [c.user, c.to]) };
    }

    it("should return markdown, title and category as JSON and send the chosen blog", async function () {
      pageWithParty();
      const client = await loggedIn();
      const response = await client.post(url, { url: form.url, blog: "BLOG" });

      should(response.status).eql(HttpStatus.OK);
      should(response.data).eql({ markdown: "The Bonn group mapped all benches.", title: "Bench mapping", category: "Mapping" });
      should(create.firstCall.args[0].messages[0].content).containEql("<current_issue>");
    });
    it("should save the draft as ClaudeAI and then the edited text when the article is created", async function () {
      pageWithParty();
      const client = await loggedIn();
      await client.post(url, { url: form.url, blog: "BLOG" });
      const response = await client.post(baseLink + "/article/create",
        { blog: "BLOG", categoryEN: "Mapping", title: "Bench mapping", collection: form.url, markdownEN: "The Bonn group mapped benches." });

      should(response.status).eql(HttpStatus.OK);
      const result = await markdownChanges("Bench mapping");
      should(result.article.markdownEN).eql("The Bonn group mapped benches.");
      should(result.changes).eql([["ClaudeAI", "The Bonn group mapped all benches."], ["TestUser", "The Bonn group mapped benches."]]);
    });
    it("should save and remove the draft for \"Save link only\"", async function () {
      pageWithParty();
      const client = await loggedIn();
      await client.post(url, { url: form.url, blog: "BLOG" });
      await client.post(baseLink + "/article/create", { blog: "BLOG", categoryEN: "Mapping", title: "Bench mapping", collection: form.url });

      const result = await markdownChanges("Bench mapping");
      should(result.article.markdownEN ?? "").eql("");
      should(result.changes).eql([["ClaudeAI", "The Bonn group mapped all benches."], ["TestUser", ""]]);
    });
    it("should not use the draft for an article with another link", async function () {
      pageWithParty();
      const client = await loggedIn();
      await client.post(url, { url: form.url, blog: "BLOG" });
      await client.post(baseLink + "/article/create",
        { blog: "BLOG", categoryEN: "Mapping", title: "Other", collection: "https://other.example.org/", markdownEN: "Own text" });

      const result = await markdownChanges("Other");
      should(result.changes).eql([["TestUser", "Own text"]]);
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
    // guests (created on login) pass the role check, visibleFor decides
    it("should deny a guest user outside the group",
      testutil.checkPostUrlWithUser({
        url: url,
        form: form,
        username: "GuestUser",
        password: "GuestUser",
        expectedStatusCode: HttpStatus.FORBIDDEN,
        expectedMessage: "First Draft is not enabled for GuestUser"
      }));
  });

  describe("route POST /article/:article_id/firstdraft/:lang", function() {
    const form = { url: "https://news.example.org/party", old: "" };
    let articleUrl;
    beforeEach(async function() {
      const articles = await articleModule.find({ title: "Party" });
      articleUrl = baseLink + "/article/" + articles[0].id + "/firstdraft/EN";
    });

    it("should save the draft as ClaudeAI and answer with it", async function () {
      nock("https://news.example.org").get("/party")
        .reply(200, "<html><body><article><p>The Bonn group mapped all benches in the city park, forty people joined.</p></article></body></html>",
          { "Content-Type": "text/html" });
      create.resolves({ stop_reason: "end_turn", content: [{ type: "text", text: "The Bonn group [mapped](https://news.example.org/party) all benches." }] });

      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const response = await client.post(articleUrl, form);

      should(response.status).eql(HttpStatus.OK);
      should(response.data).eql("The Bonn group [mapped](https://news.example.org/party) all benches.");
      const article = (await articleModule.find({ title: "Party" }))[0];
      should(article.markdownEN).eql(response.data);
      const changes = await logModule.find({ table: "article", oid: article.id, property: "markdownEN" });
      should(changes.map((c) => c.user)).eql(["ClaudeAI"]);
    });
    it("should refuse a url that is not in the collection", async function () {
      const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
      await client.post(baseLink + "/login", { username: "TestUser", password: "TestUser" });
      const response = await client.post(articleUrl, { url: "https://other.example.org/", old: "" });

      should(response.status).eql(HttpStatus.BAD_REQUEST);
      should(response.data).eql("The url is not in the collection of the article");
      should(create.called).be.false();
    });
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
