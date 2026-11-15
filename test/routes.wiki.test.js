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
  let posted;

  // messages to Mattermost are sent in the background
  async function waitForMessages(count) {
    for (let i = 0; i < 50 && posted.length < count; i++) await new Promise(resolve => setTimeout(resolve, 50));
    return posted;
  }

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
    nock.cleanAll();
    posted = [];
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/, (body) => { posted.push(body); return true; })
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
      const messages = await waitForMessages(1);
      should(messages.length).eql(1);
      should(messages[0].channel).eql("#osmbcwiki");
      should(messages[0].username).eql("testbc(TestUser)");
      should(messages[0].text).eql("created wiki page [howto/new_page](" + config.getValue("url") + "/wiki/howto/new_page): first version");
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

  describe("history", function() {
    let v1;
    let v2;
    before(async function() {
      v1 = await store.savePage("hist/page", "# History\n\nfirst <i>text</i>\n", { user: "Hallo" });
      v2 = await store.savePage("hist/page", "# History\n\nsecond text\n", { user: "TheFive" });
    });
    it("should list the versions", async function () {
      const res = await full.get(wikiLink + "/hist/page?history");
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("id=\"wikiHistoryTable\"");
      should(res.data).containEql("Hallo");
      should(res.data).containEql("?diff=" + v2.rev);
      should(res.data).containEql("?rev=" + v1.rev);
    });
    it("should show the changes of a version, escaped", async function () {
      const res = await full.get(wikiLink + "/hist/page?diff=" + v2.rev);
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("<div class=\"osmbc-wiki-diff-line osmbc-wiki-diff-removed\">- first &lt;i&gt;text&lt;/i&gt;</div>");
      should(res.data).containEql("<div class=\"osmbc-wiki-diff-line osmbc-wiki-diff-added\">+ second text</div>");
    });
    it("should show an old version with a restore button", async function () {
      const res = await full.get(wikiLink + "/hist/page?rev=" + v1.rev.substring(0, 10));
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("id=\"wikiOldRevision\"");
      should(res.data).containEql("first &lt;i&gt;text&lt;/i&gt;");
      should(res.data).containEql("id=\"wikiRestore\"");
      const resGuest = await guest.get(wikiLink + "/hist/page?rev=" + v1.rev);
      should(resGuest.data).not.containEql("id=\"wikiRestore\"");
    });
    it("should reject bad revisions", async function () {
      should((await full.get(wikiLink + "/hist/page?diff=HEAD")).status).eql(HttpStatus.BAD_REQUEST);
      should((await full.get(wikiLink + "/hist/page?rev=0000000")).status).eql(HttpStatus.NOT_FOUND);
    });
    it("should restore an old version", async function () {
      const page = await store.readPage("hist/page");
      const res = await full.post(wikiLink + "/hist/page", { action: "revert", rev: v1.rev, baseBlob: page.blob });
      should(res.status).eql(HttpStatus.MOVED_TEMPORARILY);
      should((await store.readPage("hist/page")).markdown).containEql("first <i>text</i>");
      should(git("log", "-1", "--format=%an|%s")).match(/^TestUser\|Revert hist\/page to /);
      const messages = await waitForMessages(1);
      should(messages[0].text).match(/^reverted wiki page \[hist\/page\]/);
    });
    it("should hide old versions of restricted pages from guests", async function () {
      const rev = (await store.history("osmbc/user_mapping"))[0].rev;
      should((await guest.get(wikiLink + "/osmbc/user_mapping?history")).status).eql(HttpStatus.FORBIDDEN);
      should((await guest.get(wikiLink + "/osmbc/user_mapping?diff=" + rev)).status).eql(HttpStatus.FORBIDDEN);
      should((await guest.get(wikiLink + "/osmbc/user_mapping?rev=" + rev)).status).eql(HttpStatus.FORBIDDEN);
    });
  });

  describe("move and delete", function() {
    it("should ask before moving and deleting", async function () {
      await store.savePage("tmp/ask", "x", { user: "TheFive" });
      const move = await full.get(wikiLink + "/tmp/ask?move");
      should(move.data).containEql("id=\"wikiMoveSubmit\"");
      const del = await full.get(wikiLink + "/tmp/ask?delete");
      should(del.data).containEql("id=\"wikiDeleteSubmit\"");
      should((await guest.get(wikiLink + "/tmp/ask?delete")).status).eql(HttpStatus.FORBIDDEN);
    });
    it("should move a page", async function () {
      const saved = await store.savePage("tmp/from", "moving text", { user: "TheFive" });
      const res = await full.post(wikiLink + "/tmp/from", { action: "move", to: "Tmp/To Here", baseBlob: saved.blob, message: "better name" });
      should(res.status).eql(HttpStatus.MOVED_TEMPORARILY);
      should(res.headers.location).eql("/wiki/tmp/to_here");
      should(await store.exists("tmp/from")).be.false();
      should((await store.readPage("tmp/to_here")).markdown).eql("moving text\n");
      const messages = await waitForMessages(1);
      should(messages[0].text).match(/^moved wiki page tmp\/from to \[tmp\/to_here\].*: better name$/);
    });
    it("should not move onto an existing page or with a stale text", async function () {
      const saved = await store.savePage("tmp/a", "a", { user: "TheFive" });
      await store.savePage("tmp/b", "b", { user: "TheFive" });
      should((await full.post(wikiLink + "/tmp/a", { action: "move", to: "tmp/b", baseBlob: saved.blob })).status).eql(HttpStatus.CONFLICT);
      should((await full.post(wikiLink + "/tmp/a", { action: "move", to: "tmp/c", baseBlob: "0" })).status).eql(HttpStatus.CONFLICT);
      should((await full.post(wikiLink + "/tmp/a", { action: "move", to: "../c", baseBlob: saved.blob })).status).eql(HttpStatus.BAD_REQUEST);
    });
    it("should delete a page and restore it from its history", async function () {
      const saved = await store.savePage("tmp/gone", "deleted text", { user: "TheFive" });
      const res = await full.post(wikiLink + "/tmp/gone", { action: "delete", baseBlob: saved.blob });
      should(res.status).eql(HttpStatus.MOVED_TEMPORARILY);
      should(await store.exists("tmp/gone")).be.false();
      const history = await full.get(wikiLink + "/tmp/gone?history");
      should(history.status).eql(HttpStatus.OK);
      should(history.data).containEql("This page was deleted.");
      const restore = await full.post(wikiLink + "/tmp/gone", { action: "revert", rev: saved.rev, baseBlob: "" });
      should(restore.status).eql(HttpStatus.MOVED_TEMPORARILY);
      should((await store.readPage("tmp/gone")).markdown).eql("deleted text\n");
    });
    it("should refuse unknown actions and guests", async function () {
      should((await full.post(wikiLink + "/start", { action: "explode" })).status).eql(HttpStatus.BAD_REQUEST);
      should((await guest.post(wikiLink + "/start", { action: "delete" })).status).eql(HttpStatus.FORBIDDEN);
      should(await store.exists("start")).be.true();
    });
  });

  describe("search", function() {
    it("should find text and page names, without restricted pages for guests", async function () {
      const res = await full.get(wikiLink + "/_search?q=" + encodeURIComponent("SECRET list"));
      should(res.status).eql(HttpStatus.OK);
      should(res.data).containEql("osmbc/user_mapping");
      const resGuest = await guest.get(wikiLink + "/_search?q=" + encodeURIComponent("secret list"));
      should(resGuest.data).not.containEql("osmbc/user_mapping");
      should(resGuest.data).containEql("id=\"wikiSearchEmpty\"");
      const byName = await guest.get(wikiLink + "/_search?q=rules");
      should(byName.data).containEql("Editorial rules");
    });
    it("should treat the query as text", async function () {
      const res = await full.get(wikiLink + "/_search?q=" + encodeURIComponent("<script>"));
      should(res.status).eql(HttpStatus.OK);
      should(res.data).not.containEql("<script>alert");
      should(res.data).containEql("value=\"&lt;script&gt;\"");
    });
  });

  describe("media", function() {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    it("should upload an image into the namespace of the page and serve it", async function () {
      const res = await full.post(wikiLink + "/_media", { page: "osmbc/start", fileName: "My Screen Shot.PNG", data: "data:image/png;base64," + png.toString("base64") });
      should(res.status).eql(HttpStatus.OK);
      should(res.data).eql({
        mediaPath: "osmbc/my_screen_shot.png",
        url: "/wiki/_media/osmbc/my_screen_shot.png",
        markdown: "![my screen shot](/wiki/_media/osmbc/my_screen_shot.png)"
      });
      const second = await full.post(wikiLink + "/_media", { page: "osmbc/start", fileName: "my_screen_shot.png", data: png.toString("base64") });
      should(second.data.mediaPath).eql("osmbc/my_screen_shot-2.png");
      const image = await guest.get(wikiLink + "/_media/osmbc/my_screen_shot.png", { responseType: "arraybuffer" });
      should(image.status).eql(HttpStatus.OK);
      should(image.headers["content-type"]).eql("image/png");
      should(image.headers["x-content-type-options"]).eql("nosniff");
      should(image.headers["content-security-policy"]).containEql("sandbox");
      should(Buffer.from(image.data).equals(png)).be.true();
      should(git("log", "-1", "--format=%an|%s")).eql("TestUser|Upload media/osmbc/my_screen_shot-2.png\n");
      const messages = await waitForMessages(2);
      should(messages[0].text).match(/^uploaded \[osmbc\/my_screen_shot.png\]/);
    });
    it("should reject bad uploads with a JSON error", async function () {
      const cases = [
        [{ page: "start", fileName: "x.exe", data: "AAAA" }, HttpStatus.BAD_REQUEST],
        [{ page: "start", fileName: "x.png", data: Buffer.from("<html>").toString("base64") }, HttpStatus.BAD_REQUEST],
        [{ page: "start", fileName: "x.svg", data: Buffer.from("<svg onload=\"alert(1)\"></svg>").toString("base64") }, HttpStatus.BAD_REQUEST],
        [{ page: "start", fileName: "noextension", data: "AAAA" }, HttpStatus.BAD_REQUEST],
        [{ page: "start", fileName: "x.png" }, HttpStatus.BAD_REQUEST]
      ];
      for (const [body, status] of cases) {
        const res = await full.post(wikiLink + "/_media", body);
        should(res.status).eql(status, JSON.stringify(body));
        should(res.data.error).be.a.String();
      }
      should((await guest.post(wikiLink + "/_media", { page: "start", fileName: "x.png", data: png.toString("base64") })).status).eql(HttpStatus.FORBIDDEN);
    });
    it("should not serve missing or invalid media", async function () {
      should((await full.get(wikiLink + "/_media/osmbc/none.png")).status).eql(HttpStatus.NOT_FOUND);
      should((await full.get(wikiLink + "/_media/%2e%2e/%2e%2e/package.json")).status).eql(HttpStatus.NOT_FOUND);
      should((await full.get(wikiLink + "/_media/start.md")).status).eql(HttpStatus.NOT_FOUND);
    });
  });
});
