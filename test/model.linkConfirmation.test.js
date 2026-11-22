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
      const result = await confirm(editor, blockedUrl);
      should(result.state).eql("confirmed");
      should(result.status).eql(401);
      should(result.user).eql("Editor");
      const entries = await findAll();
      should(entries.length).eql(1);
      should(entries[0].url).eql(blockedUrl);
      should(entries[0].status).eql(401);
      const log = await logModule.find({ table: "linkconfirmation" });
      should(log.length).eql(1);
      should(log[0]).containDeep({ user: "Editor", property: "confirm", to: blockedUrl });
    });

    it("should renew an existing confirmation instead of adding a second one", async function() {
      blocked();
      await confirm(editor, blockedUrl);
      blocked();
      await confirm({ OSMUser: "Other", access: "full" }, blockedUrl);
      const entries = await findAll();
      should(entries.length).eql(1);
      should(entries[0].user).eql("Other");
    });

    it("should refuse guests", async function() {
      await rejects(confirm(guest, blockedUrl), 403);
    });

    it("should refuse something that is no http(s) url", async function() {
      await rejects(confirm(editor, "javascript:alert(1)"), 400);
      await rejects(confirm(editor, undefined), 400);
    });

    it("should refuse a link that does not exist (404)", async function() {
      nock("https://site.example").head("/gone").reply(404);
      await rejects(confirm(editor, "https://site.example/gone"), 409);
      should((await findAll()).length).eql(0);
    });

    it("should refuse a link the check can verify", async function() {
      nock("https://site.example").head("/fine").reply(200);
      await rejects(confirm(editor, "https://site.example/fine"), 409);
    });
  });

  describe("applyConfirmations", function() {
    it("should turn a blocked result into confirmed", async function() {
      blocked();
      await confirm(editor, blockedUrl);
      const results = { [blockedUrl]: { state: "blocked", status: 401 }, "https://other.example/": { state: "blocked", status: 403 } };
      await applyConfirmations(results);
      should(results[blockedUrl]).containDeep({ state: "confirmed", status: 401, user: "Editor" });
      should.exist(results[blockedUrl].validUntil);
      should(results["https://other.example/"]).eql({ state: "blocked", status: 403 });
    });

    it("should show a confirmed link that now answers 404 as broken", async function() {
      blocked();
      await confirm(editor, blockedUrl);
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

  describe("revoke", function() {
    it("should remove the confirmation and log it", async function() {
      blocked();
      await confirm(editor, blockedUrl);
      await revoke({ OSMUser: "Other", access: "full" }, blockedUrl);
      should((await findAll()).length).eql(0);
      const log = await logModule.find({ table: "linkconfirmation", property: "revoke" });
      should(log.length).eql(1);
      should(log[0]).containDeep({ user: "Other", from: blockedUrl });
    });

    it("should refuse guests", async function() {
      await rejects(revoke(guest, blockedUrl), 403);
    });

    it("should answer 404 for a link that is not confirmed", async function() {
      await rejects(revoke(editor, blockedUrl), 404);
    });
  });
});
