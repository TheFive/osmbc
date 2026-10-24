import should from "should";
import nock from "nock";
import sinon from "sinon";
import initialiseModules from "../util/initialise.js";
import testutil from "./testutil.js";

import firstDraft from "../model/firstDraft.js";


const page = "<html><head><title>Mapping Party</title></head><body><article>" +
  "<h1>Mapping Party in Bonn</h1>" +
  "<p>The local OpenStreetMap group in Bonn met last Saturday and mapped all benches in the city park. " +
  "More than forty people joined, many of them for the first time.</p>" +
  "<p>The next meeting is planned for June, the group wants to map the playgrounds then.</p>" +
  "</article></body></html>";

function claudeAnswer(text, stopReason) {
  return {
    stop_reason: stopReason ?? "end_turn",
    content: [{ type: "text", text: text }]
  };
}


describe("model/firstDraft", function() {
  let create;
  before(async function() {
    await testutil.clearDB();
    await initialiseModules();
  });
  beforeEach(function() {
    create = sinon.stub();
    firstDraft.fortestonly.setClient({ beta: { messages: { create: create } } });
  });
  afterEach(function() {
    nock.cleanAll();
    sinon.restore();
  });

  describe("isVisibleFor", function() {
    it("should allow users from FirstDraftConfig.visibleFor", function() {
      should(firstDraft.isVisibleFor({ OSMUser: "TestUser", access: "full" })).be.true();
    });
    it("should deny other users", function() {
      should(firstDraft.isVisibleFor({ OSMUser: "Hallo", access: "full" })).be.false();
      should(firstDraft.isVisibleFor(null)).be.false();
    });
  });

  describe("createDraft", function() {
    it("should send prompt, url and page text to Claude and return the text", async function() {
      nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html; charset=utf-8" });
      create.resolves(claudeAnswer("The Bonn group [mapped](https://news.example.org/party) all benches.\n"));

      const result = await firstDraft.createDraft({ lang: "EN", url: "https://news.example.org/party" });

      should(result).eql("The Bonn group [mapped](https://news.example.org/party) all benches.");
      should(create.calledOnce).be.true();
      const params = create.firstCall.args[0];
      should(params.model).eql("claude-opus-5-5");
      should(params.fallbacks).eql("default");
      should(params.system).containEql("weekly OpenStreetMap news");
      const message = params.messages[0].content;
      should(message).containEql("Target language: EN");
      should(message).containEql("URL: https://news.example.org/party");
      should(message).containEql("mapped all benches in the city park");
    });
    it("should name the language if the config has a long name", async function() {
      nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
      create.resolves(claudeAnswer("Die Gruppe in Bonn ..."));

      await firstDraft.createDraft({ lang: "DE", url: "https://news.example.org/party" });

      should(create.firstCall.args[0].messages[0].content).containEql("Target language: DE (German)");
    });
    it("should ask for a title with a JSON schema and return markdown and title", async function() {
      nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
      create.resolves(claudeAnswer(JSON.stringify({ markdown: "The Bonn group mapped all benches.\n", title: " Bench mapping in Bonn " })));

      const draft = await firstDraft.createDraft({ lang: "EN", url: "https://news.example.org/party", withTitle: true });

      should(draft).eql({ markdown: "The Bonn group mapped all benches.", title: "Bench mapping in Bonn" });
      const params = create.firstCall.args[0];
      should(params.output_config.format.type).eql("json_schema");
      should(params.output_config.format.schema.required).eql(["markdown", "title"]);
      should(params.output_config.effort).eql("medium");
      should(params.messages[0].content).containEql("compact working title");
    });
    it("should not ask for a title without withTitle", async function() {
      nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
      create.resolves(claudeAnswer("Text"));

      await firstDraft.createDraft({ lang: "EN", url: "https://news.example.org/party" });

      const params = create.firstCall.args[0];
      should(params.output_config.format).be.undefined();
      should(params.messages[0].content).not.containEql("working title");
    });
    it("should fail if the page can not be loaded", async function() {
      nock("https://news.example.org").get("/missing").reply(404, "not found");

      await should(firstDraft.createDraft({ lang: "EN", url: "https://news.example.org/missing" })).be.rejected();
      should(create.called).be.false();
    });
    it("should reject non http urls", async function() {
      await should(firstDraft.createDraft({ lang: "EN", url: "file:///etc/passwd" })).be.rejectedWith(/Not a valid url/);
      should(create.called).be.false();
    });
    it("should fail when Claude declines", async function() {
      nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
      create.resolves({ stop_reason: "refusal", content: [] });

      await should(firstDraft.createDraft({ lang: "EN", url: "https://news.example.org/party" })).be.rejectedWith(/declined/);
    });
  });
});
