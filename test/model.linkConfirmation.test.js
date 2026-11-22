import should from "should";
import nock from "nock";
import { promisify } from "util";

import testutil from "./testutil.js";
import linkConfirmation from "../model/linkConfirmation.js";
import logModule from "../model/logModule.js";
import linkCheck from "../util/linkCheck.js";

const confirm = promisify(linkConfirmation.confirm);
const revoke = promisify(linkConfirmation.revoke);
const applyConfirmations = promisify(linkConfirmation.applyConfirmations);
const findAll = promisify(linkConfirmation.findAll);

const editor = { OSMUser: "Editor", access: "full" };
const guest = { OSMUser: "Guest", access: "guest" };
const blockedUrl = "https://www.reuters.example/world/news-2026-11-13/";

function blocked() {
  nock("https://www.reuters.example").head("/world/news-2026-11-13/").reply(401, "", { "x-datadome": "protected" });
}

async function rejects(promise, status) {
  const err = await promise.then(() => null, (e) => e);
  should.exist(err);
  should(err.status).eql(status);
}

describe("model/linkConfirmation", function() {
  beforeEach(async function() {
    await testutil.clearDB();
    linkCheck.cacheFlushAll();
    nock.cleanAll();
  });
  afterEach(function() {
    nock.cleanAll();
  });

  describe("confirm", function() {
    it("should store who confirmed a blocked link and log it", async function() {
      blocked();
      const result = await confirm(editor, blockedUrl, true);
      should(result.state).eql("confirmed");
      should(result.status).eql(401);
      should(result.user).eql("Editor");
      const entries = await findAll();
      should(entries.length).eql(1);
      should(entries[0].url).eql(blockedUrl);
      should(entries[0].status).eql(401);
      const log = await logModule.find({ table: "linkconfirmation" });
      should(log.length).eql(1);
      should(log[0]).containDeep({ user: "Editor", property: "exists", from: null, to: true, url: blockedUrl });
    });

    it("should renew an existing confirmation instead of adding a second one", async function() {
      blocked();
      await confirm(editor, blockedUrl, true);
      blocked();
      await confirm({ OSMUser: "Other", access: "full" }, blockedUrl, false);
      const entries = await findAll();
      should(entries.length).eql(1);
      should(entries[0].user).eql("Other");
      should(entries[0].exists).be.false();
    });

    it("should refuse an answer that is not true or false", async function() {
      await rejects(confirm(editor, blockedUrl, "yes"), 400);
    });

    it("should refuse guests", async function() {
      await rejects(confirm(guest, blockedUrl, true), 403);
    });

    it("should refuse something that is no http(s) url", async function() {
      await rejects(confirm(editor, "javascript:alert(1)", true), 400);
      await rejects(confirm(editor, undefined, true), 400);
    });

    it("should refuse a link that does not exist (404)", async function() {
      nock("https://site.example").head("/gone").reply(404);
      await rejects(confirm(editor, "https://site.example/gone", false), 409);
      should((await findAll()).length).eql(0);
    });

    it("should refuse a link the check can verify", async function() {
      nock("https://site.example").head("/fine").reply(200);
      await rejects(confirm(editor, "https://site.example/fine", true), 409);
    });
  });

  describe("applyConfirmations", function() {
    it("should turn a blocked result into confirmed", async function() {
      blocked();
      await confirm(editor, blockedUrl, true);
      const results = { [blockedUrl]: { state: "blocked", status: 401 }, "https://other.example/": { state: "blocked", status: 403 } };
      await applyConfirmations(results);
      should(results[blockedUrl]).containDeep({ state: "confirmed", exists: true, status: 401, user: "Editor" });
      should.exist(results[blockedUrl].validUntil);
      should(results["https://other.example/"]).eql({ state: "blocked", status: 403 });
    });

    it("should pass on a link marked missing", async function() {
      blocked();
      await confirm(editor, blockedUrl, false);
      const results = { [blockedUrl]: { state: "blocked", status: 401 } };
      await applyConfirmations(results);
      should(results[blockedUrl]).containDeep({ state: "confirmed", exists: false, user: "Editor" });
    });

    it("should show a confirmed link that now answers 404 as broken", async function() {
      blocked();
      await confirm(editor, blockedUrl, true);
      const results = { [blockedUrl]: 404 };
      await applyConfirmations(results);
      should(results[blockedUrl]).eql(404);
    });

    it("should ignore an expired confirmation", async function() {
      const old = linkConfirmation.create({ url: blockedUrl, user: "Editor", status: 401, timestamp: "2020-01-01T00:00:00.000Z" });
      await old.save();
      const results = { [blockedUrl]: { state: "blocked", status: 401 } };
      await applyConfirmations(results);
      should(results[blockedUrl]).eql({ state: "blocked", status: 401 });
    });

    it("should be valid for 6 months", function() {
      const entry = linkConfirmation.create({ url: blockedUrl, timestamp: "2026-01-15T10:00:00.000Z" });
      should(entry.validUntil().toISOString()).eql("2026-07-15T10:00:00.000Z");
      should(entry.isValid(new Date("2026-07-15T09:59:00.000Z"))).be.true();
      should(entry.isValid(new Date("2026-07-15T10:01:00.000Z"))).be.false();
    });

    it("should handle a url with % like any other", async function() {
      const url = "https://www.reuters.example/a%20b";
      const entry = linkConfirmation.create({ url: url, user: "Editor", status: 401, timestamp: new Date().toISOString() });
      await entry.save();
      const results = { [url]: { state: "blocked", status: 401 }, "https://www.reuters.example/aXXb": { state: "blocked", status: 401 } };
      await applyConfirmations(results);
      should(results[url].state).eql("confirmed");
      should(results["https://www.reuters.example/aXXb"].state).eql("blocked");
    });
  });

  describe("search", function() {
    const search = promisify(linkConfirmation.search);
    beforeEach(async function() {
      const now = new Date().toISOString();
      await linkConfirmation.create({ url: "https://a.example/one", exists: true, user: "Alice", status: 401, timestamp: now }).save();
      await linkConfirmation.create({ url: "https://b.example/two", exists: false, user: "Bob", status: 403, timestamp: now }).save();
      await linkConfirmation.create({ url: "https://c.example/old", exists: true, user: "Alice", status: 401, timestamp: "2020-01-01T00:00:00.000Z" }).save();
    });
    function urls(list) { return list.map(e => e.url).sort(); }

    it("should filter by answer", async function() {
      should(urls(await search({}))).eql(["https://a.example/one", "https://b.example/two", "https://c.example/old"]);
      should(urls(await search({ answer: "exists" }))).eql(["https://a.example/one"]);
      should(urls(await search({ answer: "missing" }))).eql(["https://b.example/two"]);
      should(urls(await search({ answer: "expired" }))).eql(["https://c.example/old"]);
    });
    it("should search url and user, case ignored", async function() {
      should(urls(await search({ text: "ALICE" }))).eql(["https://a.example/one", "https://c.example/old"]);
      should(urls(await search({ text: "b.example", answer: "missing" }))).eql(["https://b.example/two"]);
    });
    it("should refuse an unknown filter", async function() {
      await rejects(search({ answer: "constructor" }), 400);
    });
  });

  describe("revoke", function() {
    it("should remove the confirmation and log it", async function() {
      blocked();
      await confirm(editor, blockedUrl, true);
      await revoke({ OSMUser: "Other", access: "full" }, blockedUrl);
      should((await findAll()).length).eql(0);
      const log = await logModule.find({ table: "linkconfirmation", user: "Other" });
      should(log.length).eql(1);
      should(log[0]).containDeep({ property: "exists", from: true, to: null, url: blockedUrl });
    });

    it("should refuse guests", async function() {
      await rejects(revoke(guest, blockedUrl), 403);
    });

    it("should answer 404 for a link that is not confirmed", async function() {
      await rejects(revoke(editor, blockedUrl), 404);
    });
  });
});
