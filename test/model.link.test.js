import should from "should";
import nock from "nock";
import { promisify } from "util";

import testutil from "./testutil.js";
import db from "../model/db.js";
import linkModule from "../model/link.js";
import logModule from "../model/logModule.js";

const checkUrls = promisify(linkModule.checkUrls);
const knownResults = promisify(linkModule.knownResults);
const knownResultsForArticles = promisify(linkModule.knownResultsForArticles);
const answer = promisify(linkModule.answer);
const revoke = promisify(linkModule.revoke);
const search = promisify(linkModule.search);
const cleanup = promisify(linkModule.cleanup);

const editor = { OSMUser: "Editor", access: "full" };
const guest = { OSMUser: "Guest", access: "guest" };
const blockedUrl = "https://www.reuters.example/world/news/";
const goneUrl = "https://site.example/gone";
const fineUrl = "https://site.example/fine";

const DAY = 24 * 60 * 60 * 1000;
function daysAgo(n) { return new Date(Date.now() - n * DAY).toISOString(); }

function query(sql, params) {
  return new Promise((resolve, reject) => db.query(sql, params, (err, r) => err ? reject(err) : resolve(r)));
}
// a stored row as it would be after earlier checks and answers
function storeRow(data) {
  return query("INSERT INTO link (data) VALUES ($1)", [data]);
}

async function rejects(promise, status) {
  const err = await promise.then(() => null, (e) => e);
  should.exist(err);
  should(err.status).eql(status);
}

describe("model/link", function() {
  beforeEach(async function() {
    await testutil.clearDB();
    nock.cleanAll();
  });
  afterEach(function() {
    nock.cleanAll();
  });

  describe("checkUrls", function() {
    it("should check unknown urls, store the result and answer for the state", async function() {
      nock("https://www.reuters.example").head("/world/news/").reply(401, "", { "x-datadome": "protected" });
      nock("https://site.example").head("/gone").reply(404).head("/fine").reply(200);
      const results = await checkUrls([blockedUrl, goneUrl, fineUrl]);
      should(results[blockedUrl]).eql({ state: "blocked", status: 401, exists: null });
      should(results[goneUrl]).eql({ state: "broken", status: 404, exists: false, by: "auto" });
      should(results[fineUrl]).eql({ state: "ok", status: "OK", exists: true, by: "auto" });
      const rows = await query("SELECT data FROM link", []);
      should(rows.rows.length).eql(3);
      should(rows.rows.find(r => r.data.url === goneUrl).data.check).containDeep({ state: "broken", status: 404 });
    });

    it("should not ask again while the check is fresh", async function() {
      const scope = nock("https://site.example").head("/fine").reply(200);
      await checkUrls([fineUrl]);
      should(scope.isDone()).be.true();
      const again = nock("https://site.example").head("/fine").reply(404);
      should((await checkUrls([fineUrl]))[fineUrl].state).eql("ok");
      should(again.isDone()).be.false();
    });

    it("should ask again when the check ran out (broken after a day, ok after 90 days)", async function() {
      await storeRow({ url: goneUrl, check: { state: "broken", status: 404, checkedAt: daysAgo(2) } });
      await storeRow({ url: fineUrl, check: { state: "ok", status: "OK", checkedAt: daysAgo(80) } });
      const scope = nock("https://site.example").head("/gone").reply(200);
      const results = await checkUrls([goneUrl, fineUrl]);
      should(scope.isDone()).be.true();
      should(results[goneUrl].state).eql("ok");
      should(results[fineUrl].state).eql("ok");
    });
  });

  describe("answer", function() {
    it("should let an editor say a 404 exists; the answer wins over later checks", async function() {
      await storeRow({ url: goneUrl, check: { state: "broken", status: 404, checkedAt: daysAgo(0) } });
      const result = await answer(editor, goneUrl, true);
      should(result).containDeep({ state: "broken", status: 404, exists: true, by: "Editor" });
      should.exist(result.validUntil);
      await query("UPDATE link SET data = jsonb_set(data, '{check,checkedAt}', to_jsonb($1::text))", [daysAgo(2)]);
      nock("https://site.example").head("/gone").reply(404);
      should((await checkUrls([goneUrl]))[goneUrl]).containDeep({ state: "broken", exists: true, by: "Editor" });
    });

    it("should let an editor say an ok link is missing, and log it", async function() {
      await storeRow({ url: fineUrl, check: { state: "ok", status: "OK", checkedAt: daysAgo(0) } });
      should(await answer(editor, fineUrl, false)).containDeep({ state: "ok", exists: false, by: "Editor" });
      const log = await logModule.find({ table: "link" });
      should(log.length).eql(1);
      should(log[0]).containDeep({ user: "Editor", property: "exists", from: null, to: false, url: fineUrl });
    });

    it("should answer a url that was not checked yet", async function() {
      should(await answer(editor, blockedUrl, true)).containDeep({ state: "unknown", exists: true, by: "Editor" });
    });

    it("should let the check decide again once the answer ran out", async function() {
      await storeRow({ url: goneUrl, check: { state: "broken", status: 404, checkedAt: daysAgo(0) }, answer: { exists: true, by: "Editor", timestamp: "2020-01-01T00:00:00.000Z" } });
      should((await knownResults([goneUrl]))[goneUrl]).eql({ state: "broken", status: 404, exists: false, by: "auto" });
    });

    it("should be valid for 180 days", function() {
      const l = new linkModule.Class({ id: 1, data: { url: fineUrl, answer: { exists: true, by: "E", timestamp: "2026-01-15T10:00:00.000Z" } } });
      should(l.answerValidUntil().toISOString()).eql("2026-07-14T10:00:00.000Z");
      should(!!l.validAnswer(new Date("2026-07-14T09:59:00.000Z"))).be.true();
      should(l.validAnswer(new Date("2026-07-14T10:01:00.000Z"))).be.null();
    });

    it("should refuse guests, no url and an answer that is not true or false", async function() {
      await rejects(answer(guest, fineUrl, true), 403);
      await rejects(answer(editor, "javascript:alert(1)", true), 400);
      await rejects(answer(editor, undefined, true), 400);
      await rejects(answer(editor, fineUrl, "yes"), 400);
    });
  });

  describe("revoke", function() {
    it("should remove the answer, keep the check and log it", async function() {
      await storeRow({ url: goneUrl, check: { state: "broken", status: 404, checkedAt: daysAgo(0) } });
      await answer(editor, goneUrl, true);
      const result = await revoke({ OSMUser: "Other", access: "full" }, goneUrl);
      should(result).eql({ state: "broken", status: 404, exists: false, by: "auto" });
      const log = await logModule.find({ table: "link", user: "Other" });
      should(log[0]).containDeep({ property: "exists", from: true, to: null, url: goneUrl });
    });

    it("should answer 404 without an answer and refuse guests", async function() {
      await rejects(revoke(editor, goneUrl), 404);
      await rejects(revoke(guest, goneUrl), 403);
    });
  });

  describe("known results for a page", function() {
    it("should give only fresh results, without requests", async function() {
      await storeRow({ url: fineUrl, check: { state: "ok", status: "OK", checkedAt: daysAgo(1) } });
      await storeRow({ url: goneUrl, check: { state: "broken", status: 404, checkedAt: daysAgo(3) } });
      should(await knownResults([fineUrl, goneUrl, blockedUrl])).eql({ [fineUrl]: { state: "ok", status: "OK", exists: true, by: "auto" } });
    });

    it("should find the urls of articles as written in markdown and collection", function() {
      should(linkModule.urlsOfArticles([
        { collection: "see https://a.example/x and more", markdownDE: `Text [a](${blockedUrl}), [b](https://b.example/p?q=1)`, title: "https://no.example" }
      ]).sort()).eql(["https://a.example/x", "https://b.example/p?q=1", blockedUrl].sort());
    });

    it("should give guests nothing", async function() {
      should(await knownResultsForArticles(guest, [{ markdownDE: `[a](${fineUrl})` }])).be.null();
    });
  });

  describe("search", function() {
    beforeEach(async function() {
      await storeRow({ url: "https://a.example/ok", check: { state: "ok", status: "OK", checkedAt: daysAgo(1) } });
      await storeRow({ url: "https://b.example/open", check: { state: "blocked", status: 403, checkedAt: daysAgo(1) } });
      await storeRow({ url: "https://c.example/gone", check: { state: "broken", status: 404, checkedAt: daysAgo(1) }, answer: { exists: true, by: "Alice", timestamp: daysAgo(1) } });
      await storeRow({ url: "https://d.example/old", check: { state: "blocked", status: 401, checkedAt: daysAgo(1) }, answer: { exists: false, by: "Bob", timestamp: "2020-01-01T00:00:00.000Z" } });
    });
    async function urls(options) { return (await search(options)).links.map(l => l.url).sort(); }

    it("should filter", async function() {
      should(await urls({})).have.length(4);
      should(await urls({ filter: "open" })).eql(["https://b.example/open", "https://d.example/old"]);
      should(await urls({ filter: "exists" })).eql(["https://a.example/ok", "https://c.example/gone"]);
      should(await urls({ filter: "missing" })).eql([]);
      should(await urls({ filter: "answered" })).eql(["https://c.example/gone"]);
      should(await urls({ filter: "expired" })).eql(["https://d.example/old"]);
    });
    it("should search url and user, case ignored", async function() {
      should(await urls({ text: "ALICE" })).eql(["https://c.example/gone"]);
      should(await urls({ text: "b.example" })).eql(["https://b.example/open"]);
    });
    it("should refuse an unknown filter", async function() {
      await rejects(search({ filter: "constructor" }), 400);
    });
  });

  describe("settings (LinkCheck)", function() {
    it("should use the defaults without config", function() {
      should(linkModule.settings({})).eql({
        confirmationValidDays: 180, recheckOkDays: 90, recheckBrokenDays: 1, recheckBlockedDays: 1, recheckUnreachableDays: 0.25, cleanupAfterDays: 180
      });
      should(linkModule.settingsProblems({})).eql([]);
    });
    it("should take configured values and replace invalid ones by the default", function() {
      const s = linkModule.settings({ recheckOkDays: 365, cleanupAfterDays: 400, recheckBrokenDays: 0.5, recheckBlockedDays: "2", confirmationValidDays: -1 });
      should(s).containDeep({ recheckOkDays: 365, cleanupAfterDays: 400, recheckBrokenDays: 0.5, recheckBlockedDays: 1, confirmationValidDays: 180 });
    });
    it("should report unknown keys, invalid values and a cleanup shorter than the ok recheck", function() {
      should(linkModule.settingsProblems({ recheckOKDays: 30, recheckBlockedDays: "2", cleanupAfterDays: 30 })).eql([
        "LinkCheck.recheckOKDays is unknown",
        "LinkCheck.recheckBlockedDays must be a number > 0, using 1",
        "LinkCheck.cleanupAfterDays is shorter than recheckOkDays"
      ]);
    });
  });

  describe("cleanup", function() {
    it("should remove old automatic rows and keep answered ones", async function() {
      await storeRow({ url: "https://old.example/", check: { state: "ok", status: "OK", checkedAt: daysAgo(200) } });
      await storeRow({ url: "https://new.example/", check: { state: "ok", status: "OK", checkedAt: daysAgo(100) } });
      await storeRow({ url: "https://answered.example/", check: { state: "broken", status: 404, checkedAt: daysAgo(200) }, answer: { exists: true, by: "E", timestamp: daysAgo(200) } });
      await cleanup();
      const rows = await query("SELECT data->>'url' AS url FROM link ORDER BY 1", []);
      should(rows.rows.map(r => r.url)).eql(["https://answered.example/", "https://new.example/"]);
    });
  });
});
