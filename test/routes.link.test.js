import nock from "nock";
import should from "should";
import HttpStatus from "http-status-codes";

import config from "../config.js";
import initialiseModules from "../util/initialise.js";
import testutil from "./testutil.js";
import articleModule from "../model/article.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
const blockedUrl = "https://www.reuters.example/world/news-2026-11-13/";

function blocked() {
  nock("https://www.reuters.example").head("/world/news-2026-11-13/").reply(401, "", { "x-datadome": "protected" });
}

async function login(user) {
  const client = testutil.getWrappedAxiosClient({ maxRedirects: 10 });
  await client.post(baseLink + "/login", { username: user, password: user });
  return client;
}

describe("routes/link", function() {
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
    nock.cleanAll();
    await testutil.importData({
      clear: true,
      blog: [{ name: "WN1", status: "edit" }],
      user: [{ OSMUser: "TestUser", access: "full", mainLang: "DE" }, { OSMUser: "GuestUser", access: "guest" }]
    });
  });

  it("should check a link once, then answer from the table; an answer changes the result", async function() {
    blocked();
    const client = await login("TestUser");
    let body = await client.post(baseLink + "/article/urlexist", { urls: [blockedUrl] });
    should(body.data).eql({ [blockedUrl]: { state: "blocked", status: 401, exists: null } });

    // no second request (nock would refuse it)
    body = await client.post(baseLink + "/article/urlexist", { urls: [blockedUrl] });
    should(body.data[blockedUrl].state).eql("blocked");

    body = await client.post(baseLink + "/link/answer", { url: blockedUrl, exists: "true" });
    should(body.status).eql(HttpStatus.OK);
    should(body.data).containDeep({ state: "blocked", exists: true, by: "TestUser" });

    body = await client.post(baseLink + "/article/urlexist", { urls: [blockedUrl] });
    should(body.data[blockedUrl]).containDeep({ exists: true, by: "TestUser" });

    body = await client.post(baseLink + "/link/revoke", { url: blockedUrl });
    should(body.data).eql({ state: "blocked", status: 401, exists: null });
  });

  it("should send the known results with article and blog page", async function() {
    blocked();
    const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "T", markdownDE: `Reuters [berichtet](${blockedUrl}).` });
    const client = await login("TestUser");
    await client.post(baseLink + "/article/urlexist", { urls: [blockedUrl] });
    for (const page of ["/article/" + article.id, "/blog/WN1/full"]) {
      const body = await client.get(baseLink + page);
      should(body.status).eql(HttpStatus.OK);
      should(body.data).containEql(`window.cacheLink = {"${blockedUrl}":{"state":"blocked","status":401,"exists":null}};`);
      should(body.data).containEql('href="/link">All checked links</a>');
    }
  });

  it("should list, search and filter checked links on the admin page", async function() {
    blocked();
    const client = await login("TestUser");
    await client.post(baseLink + "/article/urlexist", { urls: [blockedUrl] });
    await client.post(baseLink + "/link/answer", { url: blockedUrl, exists: "false" });
    let body = await client.get(baseLink + "/link");
    should(body.status).eql(HttpStatus.OK);
    should(body.data).containEql("missing, said TestUser");
    should(body.data).containEql(`data-link-revoke="${blockedUrl}"`);
    body = await client.get(baseLink + "/link?filter=exists");
    should(body.data).containEql("No checked links.");
    body = await client.get(baseLink + "/link?q=reuters&filter=missing");
    should(body.data).containEql(blockedUrl);
  });

  it("should not let guests answer, undo or see the list", async function() {
    const client = await login("GuestUser");
    let body = await client.post(baseLink + "/link/answer", { url: blockedUrl, exists: "true" });
    should(body.status).eql(HttpStatus.FORBIDDEN);
    body = await client.post(baseLink + "/link/revoke", { url: blockedUrl });
    should(body.status).eql(HttpStatus.FORBIDDEN);
    body = await client.get(baseLink + "/link");
    should(body.status).eql(HttpStatus.FORBIDDEN);
  });
});
