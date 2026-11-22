import nock from "nock";
import should from "should";
import HttpStatus from "http-status-codes";

import config from "../config.js";
import initialiseModules from "../util/initialise.js";
import testutil from "./testutil.js";
import linkCheck from "../util/linkCheck.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
const blockedUrl = "https://www.reuters.example/world/news-2026-11-13/";

function blocked(times = 1) {
  nock("https://www.reuters.example").head("/world/news-2026-11-13/").times(times).reply(401, "", { "x-datadome": "protected" });
}

async function login(user) {
  const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
  await client.post(baseLink + "/login", { username: user, password: user });
  return client;
}

describe("routes/linkConfirmation", function() {
  this.timeout(this.timeout() * 2);

  before(async function() {
    await testutil.clearDB();
    await initialiseModules();
    testutil.startServerSync();
  });
  after(function() {
    nock.cleanAll();
    testutil.stopServer();
  });
  beforeEach(async function() {
    linkCheck.cacheFlushAll();
    nock.cleanAll();
    await testutil.importData({
      clear: true,
      user: [{ OSMUser: "TestUser", access: "full" }, { OSMUser: "GuestUser", access: "guest" }]
    });
  });

  it("should answer urlexist with blocked, then confirmed after a confirmation", async function() {
    blocked(3);
    const client = await login("TestUser");
    let body = await client.post(baseLink + "/article/urlexist", { urls: [blockedUrl] });
    should(body.data).eql({ [blockedUrl]: { state: "blocked", status: 401 } });

    body = await client.post(baseLink + "/linkconfirmation/confirm", { url: blockedUrl, exists: "true" });
    should(body.status).eql(HttpStatus.OK);
    should(body.data).containDeep({ state: "confirmed", exists: true, status: 401, user: "TestUser" });

    body = await client.post(baseLink + "/article/urlexist", { urls: [blockedUrl] });
    should(body.data[blockedUrl]).containDeep({ state: "confirmed", user: "TestUser" });
  });

  it("should list confirmations on the admin page and undo them", async function() {
    blocked(2);
    const client = await login("TestUser");
    await client.post(baseLink + "/linkconfirmation/confirm", { url: blockedUrl, exists: "true" });
    let body = await client.get(baseLink + "/linkconfirmation");
    should(body.status).eql(HttpStatus.OK);
    should(body.data).containEql("answered by TestUser");
    body = await client.get(baseLink + "/linkconfirmation?answer=missing");
    should(body.data).containEql("No checked links.");
    body = await client.get(baseLink + "/linkconfirmation?q=reuters&answer=exists");
    should(body.data).containEql("answered by TestUser");
    should(body.data).containEql(`data-link-revoke="${blockedUrl}"`);

    body = await client.post(baseLink + "/linkconfirmation/revoke", { url: blockedUrl });
    should(body.data).eql({ state: "revoked" });
    body = await client.post(baseLink + "/article/urlexist", { urls: [blockedUrl] });
    should(body.data).eql({ [blockedUrl]: { state: "blocked", status: 401 } });
  });

  it("should refuse to confirm a 404", async function() {
    nock("https://site.example").head("/gone").reply(404);
    const client = await login("TestUser");
    const body = await client.post(baseLink + "/linkconfirmation/confirm", { url: "https://site.example/gone", exists: "false" });
    should(body.status).eql(HttpStatus.CONFLICT);
  });

  it("should not let guests confirm or see the list", async function() {
    const client = await login("GuestUser");
    let body = await client.post(baseLink + "/linkconfirmation/confirm", { url: blockedUrl, exists: "true" });
    should(body.status).eql(HttpStatus.FORBIDDEN);
    body = await client.post(baseLink + "/linkconfirmation/revoke", { url: blockedUrl });
    should(body.status).eql(HttpStatus.FORBIDDEN);
    body = await client.get(baseLink + "/linkconfirmation");
    should(body.status).eql(HttpStatus.FORBIDDEN);
  });
});
