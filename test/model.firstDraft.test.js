import should from "should";
import nock from "nock";
import sinon from "sinon";
import initialiseModules from "../util/initialise.js";
import testutil from "./testutil.js";

import firstDraft from "../model/firstDraft.js";
import userModule from "../model/user.js";
import articleModule from "../model/article.js";
import logModule from "../model/logModule.js";


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
    describe("values of visibleFor", function() {
      const visible = firstDraft.fortestonly.isVisibleForValue;
      const full = { OSMUser: "Full", access: "full" };
      const guest = { OSMUser: "Guest", access: "guest" };
      const denied = { OSMUser: "Denied", access: "denied" };
      it("should allow only the users of a list", function() {
        should(visible(["Full", "Guest"], full)).be.true();
        should(visible(["Full", "Guest"], guest)).be.true();
        should(visible(["Other"], full)).be.false();
        should(visible([], full)).be.false();
      });
      it("should allow nobody if missing or empty", function() {
        for (const value of [undefined, null, "", "  ", {}, 1, "nobody"]) {
          should(visible(value, full)).be.false(JSON.stringify(value));
        }
      });
      it("should allow all full users with full", function() {
        for (const value of ["full", "FULL", " Full "]) {
          should(visible(value, full)).be.true(value);
          should(visible(value, guest)).be.false(value);
        }
      });
      it("should allow full and guest users with guest", function() {
        for (const value of ["guest", "GUEST", "Guest"]) {
          should(visible(value, full)).be.true(value);
          should(visible(value, guest)).be.true(value);
          should(visible(value, denied)).be.false(value);
        }
      });
    });
  });

  describe("categoryChoice", function() {
    it("should offer the categories with a description, without internal ones", function() {
      const choice = firstDraft.fortestonly.categoryChoice();
      should(choice.fallback).eql("-- no category yet --");
      const names = choice.offered.map((c) => c.name);
      should(names).containEql("Mapping");
      should(names).containEql("Other “geo” things");
      for (const name of ["-- no category yet --", "Picture", "About us", "Weekly exercise:", "Upcoming Events", "Releases", "--unpublished--"]) {
        should(names).not.containEql(name);
      }
      should(choice.offered.find((c) => c.name === "Imports").description).eql("discussions, announcements about imports");
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
    it("should ask for title and category with a JSON schema and return them with the markdown", async function() {
      nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
      create.resolves(claudeAnswer(JSON.stringify({ markdown: "The Bonn group mapped all benches.\n", title: " Bench mapping in Bonn ", category: "Community" })));

      const draft = await firstDraft.createDraft({ lang: "EN", url: "https://news.example.org/party", withTitle: true });

      should(draft).eql({ markdown: "The Bonn group mapped all benches.", title: "Bench mapping in Bonn", category: "Community" });
      const params = create.firstCall.args[0];
      should(params.output_config.format.type).eql("json_schema");
      const schema = params.output_config.format.schema;
      should(schema.required).eql(["markdown", "title", "category"]);
      should(schema.properties.category.enum[0]).eql("-- no category yet --");
      should(schema.properties.category.enum).containEql("Mapping");
      should(params.output_config.effort).eql("medium");
      const message = params.messages[0].content;
      should(message).containEql("compact working title");
      should(message).containEql("- Mapping: Quality assurance, editors");
      should(message).containEql("use \"-- no category yet --\"");
    });
    it("should fall back to no category for an unknown category", async function() {
      nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
      create.resolves(claudeAnswer(JSON.stringify({ markdown: "Text", title: "Title", category: "Picture" })));

      const draft = await firstDraft.createDraft({ lang: "EN", url: "https://news.example.org/party", withTitle: true });

      should(draft.category).eql("-- no category yet --");
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

  describe("with the current issue (#1185)", function() {
    const partyUrl = "https://news.example.org/party";
    const full = userModule.create({ OSMUser: "Full", access: "full" });
    const guest = userModule.create({ OSMUser: "Guest", access: "guest" });
    let current;

    function importIssue(done) {
      testutil.importData({
        clear: true,
        blog: [{ name: "WN1", status: "edit" }],
        article: [
          { blog: "WN1", categoryEN: "Mapping", title: "Written", markdownEN: "Alice has developed a map of benches." },
          { blog: "WN1", categoryEN: "Mapping", title: "Open item", markdownEN: "" },
          { blog: "WN1", categoryEN: "Picture", title: "Picture", markdownEN: "Text of the picture" },
          { blog: "WN1", categoryEN: "Upcoming Events", title: "Events", markdownEN: "Text of the events" },
          { blog: "WN1", categoryEN: "Mapping", title: "Party", collection: "Look at " + partyUrl, markdownEN: "" }
        ]
      }, done);
    }
    function loadParty() {
      return new Promise((resolve, reject) => articleModule.findOne({ title: "Party" }, null, (err, a) => (err) ? reject(err) : resolve(a)));
    }
    function changesOf(article) {
      return logModule.find({ table: "article", oid: article.id, property: "markdownEN" }, { column: "id" });
    }

    beforeEach(async function() {
      await new Promise((resolve, reject) => importIssue((err) => (err) ? reject(err) : resolve()));
      current = await loadParty();
    });

    describe("issueContext", function() {
      it("should render the issue with marker and placeholders, without picture and events", async function() {
        const context = await firstDraft.fortestonly.issueContext(full, "EN", "WN1", current.id);

        should(context.markerPlaced).be.true();
        should(context.text).containEql("## Mapping");
        should(context.text).containEql("* Alice has developed a map of benches.");
        should(context.text).containEql("* [[ITEM STILL TO COME: Open item]]");
        should(context.text).containEql("* [[YOUR ITEM GOES HERE]]");
        should(context.text).not.containEql("Text of the picture");
        should(context.text).not.containEql("Text of the events");
      });
      it("should not place the marker for a new article", async function() {
        const context = await firstDraft.fortestonly.issueContext(full, "EN", "WN1", null);

        should(context.markerPlaced).be.false();
        should(context.text).not.containEql("YOUR ITEM GOES HERE");
        should(context.text).containEql("[[ITEM STILL TO COME: Party]]");
      });
      it("should give guests no context, they may not see blogs", async function() {
        should(await firstDraft.fortestonly.issueContext(guest, "EN", "WN1", current.id)).be.null();
      });
      it("should give no context for an unknown blog", async function() {
        should(await firstDraft.fortestonly.issueContext(full, "EN", "Future", null)).be.null();
      });
    });

    describe("draftIntoArticle", function() {
      it("should send the issue and save the draft as ClaudeAI", async function() {
        nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
        create.resolves(claudeAnswer("The Bonn group [mapped](https://news.example.org/party) all benches."));

        const markdown = await firstDraft.draftIntoArticle(full, current, { lang: "EN", url: partyUrl, old: "" });

        should(markdown).eql("The Bonn group [mapped](https://news.example.org/party) all benches.");
        const message = create.firstCall.args[0].messages[0].content;
        should(message).containEql("<current_issue>");
        should(message).containEql("Your item goes where [[YOUR ITEM GOES HERE]] stands.");
        should(message).containEql("Alice has developed a map of benches.");
        should((await loadParty()).markdownEN).eql(markdown);
        const changes = await changesOf(current);
        should(changes.map((c) => [c.user, c.to])).eql([["ClaudeAI", markdown]]);
      });
      it("should not send the issue for a guest", async function() {
        nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
        create.resolves(claudeAnswer("Draft"));

        await firstDraft.draftIntoArticle(guest, current, { lang: "EN", url: partyUrl, old: "" });

        should(create.firstCall.args[0].messages[0].content).not.containEql("<current_issue>");
      });
      it("should reject a url that is not in the collection", async function() {
        await should(firstDraft.draftIntoArticle(full, current, { lang: "EN", url: "https://other.example.org/", old: "" }))
          .be.rejectedWith({ status: 400 });
        should(create.called).be.false();
      });
      it("should reject an unknown language", async function() {
        await should(firstDraft.draftIntoArticle(full, current, { lang: "XX", url: partyUrl, old: "" }))
          .be.rejectedWith({ status: 400 });
        should(create.called).be.false();
      });
      it("should not overwrite a text changed in the meantime", async function() {
        await new Promise((resolve, reject) => current.setAndSave(full, { markdownEN: "Typed by Bob", old: { markdownEN: "" } }, (err) => (err) ? reject(err) : resolve()));
        nock("https://news.example.org").get("/party").reply(200, page, { "Content-Type": "text/html" });
        create.resolves(claudeAnswer("Draft"));

        await should(firstDraft.draftIntoArticle(full, await loadParty(), { lang: "EN", url: partyUrl, old: "" }))
          .be.rejectedWith({ status: 409 });
        should((await loadParty()).markdownEN).eql("Typed by Bob");
      });
    });

    describe("saveCollectedDraft", function() {
      it("should save the draft as ClaudeAI, then the edited text as the user", async function() {
        await firstDraft.saveCollectedDraft(full, current, { lang: "EN", markdown: "Claude's draft" }, "Edited draft\r\nsecond line");

        should((await loadParty()).markdownEN).eql("Edited draft\nsecond line");
        const changes = await changesOf(current);
        should(changes.map((c) => [c.user, c.to])).eql([["ClaudeAI", "Claude's draft"], ["Full", "Edited draft\nsecond line"]]);
      });
      it("should keep an unchanged draft with one change", async function() {
        await firstDraft.saveCollectedDraft(full, current, { lang: "EN", markdown: "Claude's draft" }, "Claude's draft");

        const changes = await changesOf(current);
        should(changes.map((c) => c.user)).eql(["ClaudeAI"]);
      });
      it("should remove the draft for \"Save link only\", so the history shows it as not usable", async function() {
        await firstDraft.saveCollectedDraft(full, current, { lang: "EN", markdown: "Claude's draft" }, undefined);

        should((await loadParty()).markdownEN ?? "").eql("");
        const changes = await changesOf(current);
        should(changes.map((c) => [c.user, c.to])).eql([["ClaudeAI", "Claude's draft"], ["Full", ""]]);
      });
    });
  });
});
