import { execFileSync } from "child_process";
import nock from "nock";
import should from "should";
import HttpStatus from "http-status-codes";

import config from "../config.js";
import initialiseModules from "../util/initialise.js";
import testutil from "../test/testutil.js";
import { WikiStore, blobHash } from "../wiki/wikiStore.js";

const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
const wikiLink = baseLink + "/wiki";
const wikiDir = config.getWikiConfig().directory;

// a second store on the app's wiki directory, to set up and check pages
const store = new WikiStore({ directory: wikiDir, logger: { info: () => {}, error: () => {} } });

function git(...args) {
  return execFileSync("git", args, { cwd: wikiDir, encoding: "utf8" });
}

async function loggedInClient(username) {
  const client = testutil.getWrappedAxiosClient();
  await client.post(baseLink + "/login", { username, password: username });
  return client;
}

describe("routes/wiki", function() {
  this.timeout(this.timeout() * 3);
  let full;
  let guest;

  before(async function () {
    await testutil.clearDB();
    await initialiseModules();
    testutil.startServerSync();
    // empty the wiki left over from an earlier direct run
    await store.init();
    if (git("ls-files").trim()) {
      git("rm", "-r", "-q", ".");
      git("-c", "user.name=Test", "-c", "user.email=test@osmbc", "commit", "-q", "-m", "clean up");
    }
    await store.savePage("start", "# Welcome\n\nSee [the rules](/wiki/osmbc/rules) and [later](/wiki/osmbc/not_yet).\n", { user: "TheFive" });
    await store.savePage("sidebar", "* [Index](/wiki)\n* Sidebar entry\n", { user: "TheFive" });
    await store.savePage("osmbc/rules", "---\ntitle: Editorial rules\n---\n# Rules\n\n<b>no html</b>\n", { user: "TheFive" });
    await store.savePage("osmbc/user_mapping", "---\naccess: full\n---\n# Mapping\n\nsecret list\n", { user: "TheFive" });
  });

  after(function () {
    nock.cleanAll();
    testutil.stopServer();
  });

  beforeEach(async function () {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    await testutil.importData({
      user: [
        { OSMUser: "TestUser", access: "full" },
        { OSMUser: "GuestUser", access: "guest" },
        { OSMUser: "TestUserDenied", access: "denied" }
      ],
      clear: true
    });
    full = await loggedInClient("TestUser");
    guest = await loggedInClient("GuestUser");
  });

  describe("GET /wiki", function() {
    it("should list all pages for full users", async function () {
      const res = await full.get(wikiLink);
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("Editorial rules");
      should(res.data).containEql("osmbc/user_mapping");
      should(res.data).containEql("New page");
    });
    it("should hide restricted pages and the new-page form from guests", async function () {
      const res = await guest.get(wikiLink);
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("Editorial rules");
      should(res.data).not.containEql("osmbc/user_mapping");
      should(res.data).not.containEql("New page");
    });
    it("should deny denied users", testutil.checkUrlWithUser({
      url: wikiLink,
      username: "TestUserDenied",
      password: "TestUserDenied",
      expectedStatusCode: HttpStatus.FORBIDDEN,
      expectedMessage: "OSM User >TestUserDenied< has no access rights"
    }));
  });

  describe("GET /wiki/:page", function() {
    it("should render a page with sidebar and missing-page links", async function () {
      const res = await full.get(wikiLink + "/start");
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("<h1 id=\"welcome\">Welcome</h1>");
      should(res.data).containEql("<a href=\"/wiki/osmbc/rules\">the rules</a>");
      should(res.data).containEql("<a href=\"/wiki/osmbc/not_yet\" class=\"osmbc-wiki-missing\">later</a>");
      should(res.data).containEql("Sidebar entry");
      should(res.data).containEql("id=\"wikiEdit\"");
    });
    it("should render pages in namespaces and keep HTML escaped", async function () {
      const res = await guest.get(wikiLink + "/osmbc/rules");
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("&lt;b&gt;no html&lt;/b&gt;");
      should(res.data).not.containEql("id=\"wikiEdit\"");
    });
    it("should hide a page with access: full from guests", async function () {
      const res = await guest.get(wikiLink + "/osmbc/user_mapping");
      should(res.status).eql(HttpStatus.FORBIDDEN);
      should(res.data).not.containEql("secret list");
      const resFull = await full.get(wikiLink + "/osmbc/user_mapping");
      should(resFull.status).eql(HttpStatus.OK);
      should(resFull.data).containEql("secret list");
    });
    it("should offer to create a missing page", async function () {
      const res = await full.get(wikiLink + "/osmbc/not_yet");
      should(res.status).eql(HttpStatus.NOT_FOUND);
      should(res.data).containEql("This page does not exist yet.");
      should(res.data).containEql("Create this page");
      const resGuest = await guest.get(wikiLink + "/osmbc/not_yet");
      should(resGuest.status).eql(HttpStatus.NOT_FOUND);
      should(resGuest.data).not.containEql("Create this page");
    });
    it("should reject invalid page names and path traversal", async function () {
      for (const path of ["/Start", "/a.b", "/%2e%2e/%2e%2e/package", "/..%2Fconfig.test", "/media/logo"]) {
        const res = await full.get(wikiLink + path);
        should(res.status).eql(HttpStatus.NOT_FOUND, path);
      }
    });
    it("should show the editor to full users only", async function () {
      const res = await full.get(wikiLink + "/osmbc/rules?edit");
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("id=\"wikiEditForm\"");
      should(res.data).containEql("title: Editorial rules");
      const page = await store.readPage("osmbc/rules");
      should(res.data).containEql("value=\"" + page.blob + "\"");
      const resGuest = await guest.get(wikiLink + "/osmbc/rules?edit");
      should(resGuest.status).eql(HttpStatus.FORBIDDEN);
    });
  });

  describe("POST /wiki/:page", function() {
    it("should create a page with the editor as git author", async function () {
      const res = await full.post(wikiLink + "/howto/new_page", { markdown: "# New\nText", baseBlob: "", message: "first version" });
      should(res.status).eql(HttpStatus.MOVED_TEMPORARILY);
      should(res.headers.location).eql("/wiki/howto/new_page?saved");
      should((await store.readPage("howto/new_page")).markdown).eql("# New\nText\n");
      should(git("log", "-1", "--format=%an|%s")).eql("TestUser|first version\n");
      const view = await full.get(wikiLink + "/howto/new_page?saved");
      should(view.data).containEql("id=\"wikiSaved\"");
    });
    it("should show a conflict when the page changed in between", async function () {
      const before = await store.readPage("start");
      await store.savePage("start", before.markdown + "\nChange by someone else\n", { user: "TheFive" });
      const res = await full.post(wikiLink + "/start", { markdown: "my version", baseBlob: before.blob });
      should(res.status).eql(HttpStatus.CONFLICT);
      should(res.data).containEql("id=\"wikiConflict\"");
      should(res.data).containEql("my version");
      should(res.data).containEql("Change by someone else");
      const current = await store.readPage("start");
      should(res.data).containEql("value=\"" + current.blob + "\"");
      should(current.markdown).not.containEql("my version");
    });
    it("should not let guests save", async function () {
      const res = await guest.post(wikiLink + "/start", { markdown: "guest text", baseBlob: blobHash("x") });
      should(res.status).eql(HttpStatus.FORBIDDEN);
      should((await store.readPage("start")).markdown).not.containEql("guest text");
    });
    it("should refuse a request without text", async function () {
      const res = await full.post(wikiLink + "/start", { baseBlob: "" });
      should(res.status).eql(HttpStatus.BAD_REQUEST);
    });
  });

  describe("helpers", function() {
    it("should render a preview", async function () {
      const res = await full.post(wikiLink + "/_preview", { id: "osmbc/start", markdown: "---\ntitle: x\n---\n# Hi\n[r](rules)" });
      should(res.status).eql(HttpStatus.OK);
      should(res.data.html).eql("<h1 id=\"hi\">Hi</h1>\n<p><a href=\"/wiki/osmbc/rules\">r</a></p>\n");
      const resGuest = await guest.post(wikiLink + "/_preview", { markdown: "x" });
      should(resGuest.status).eql(HttpStatus.FORBIDDEN);
    });
    it("should redirect the new-page form to the editor", async function () {
      const res = await full.get(wikiLink + "/_new?id=" + encodeURIComponent(" Howto/My Page "));
      should(res.status).eql(HttpStatus.MOVED_TEMPORARILY);
      should(res.headers.location).eql("/wiki/howto/my_page?edit");
      const bad = await full.get(wikiLink + "/_new?id=" + encodeURIComponent("a/../b"));
      should(bad.status).eql(HttpStatus.BAD_REQUEST);
    });
  });
});
