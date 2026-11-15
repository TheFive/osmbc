import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import nock from "nock";
import should from "should";

import config from "../../config.js";
import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import OsmbcApp from "../PageObjectModel/osmbcApp.js";
import WikiPage from "../PageObjectModel/wikiPage.js";
import { WikiStore } from "../../wiki/wikiStore.js";

const wikiDir = config.getWikiConfig().directory;
// 1x1 pixel PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

const store = new WikiStore({ directory: wikiDir, logger: { info: () => {}, error: () => {} } });

function git(...args) {
  return execFileSync("git", args, { cwd: wikiDir, encoding: "utf8" });
}

// a new repository with a few pages per test (the app's store keeps
// working on the directory, it only runs git in it)
async function resetWiki() {
  fs.rmSync(wikiDir, { recursive: true, force: true });
  fs.mkdirSync(wikiDir, { recursive: true });
  git("init", "-q");
  await store.savePage("start", "# Welcome\n\nRead the [editorial rules](/wiki/osmbc/rules) first.\n", { user: "Hallo" });
  await store.savePage("sidebar", "* [Index](/wiki)\n* Weekly links\n", { user: "Hallo" });
  await store.savePage("osmbc/rules", "# Rules\n\nBe nice.\n", { user: "Hallo" });
  await store.savePage("osmbc/wide_table", "# Table\n\n| " + Array(12).fill("averyveryverylongcolumnheader").join(" | ") + " |\n|" + Array(12).fill("---").join("|") + "|\n| " + Array(12).fill("cell").join(" | ") + " |\n", { user: "Hallo" });
}

for (const device of [undefined, "phone"]) {
  describe("uc/wiki" + (device ? " on a " + device : ""), function() {
    this.timeout(60000);
    let driver;
    let app;
    let tmpDir;

    beforeEach(async function() {
      nock("https://missingmattermost.example.com/")
        .post(/\/services\/.*/)
        .times(999)
        .reply(200, "ok");
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "osmbc-uc-wiki-"));
      await testutil.clearDB();
      await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
      await resetWiki();
      testutil.startServerSync();
      driver = await testutil.getNewDriver("TheFive", device ? { device } : {});
      app = new OsmbcApp(driver);
    });

    afterEach(async function() {
      await testutil.safeQuit(driver);
      testutil.stopServer();
      nock.cleanAll();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should find a page from the index and follow its links", async function() {
      await app.openWikiPage();
      const wiki = app.getWikiPage();
      should(await wiki.getIndexPageIds()).eql(["start", "sidebar", "osmbc/rules", "osmbc/wide_table"].sort((a, b) => {
        // grouped by namespace: top level first
        const ns = (id) => id.includes("/") ? id.split("/")[0] : "";
        return ns(a).localeCompare(ns(b)) || a.localeCompare(b);
      }));
      await wiki.search("be nice");
      should(await wiki.getSearchResultIds()).eql(["osmbc/rules"]);

      await app.openWikiPage("start");
      should(await wiki.getSidebarText()).containEql("Weekly links");
      await wiki.clickContentLink("editorial rules");
      should(await wiki.getContentText()).containEql("Be nice.");
      if (device) should(await wiki.hasHorizontalScroll()).be.false();
    });

    it("should edit a page with preview and an image, and show its history", async function() {
      await app.openWikiPage("osmbc/rules");
      const wiki = app.getWikiPage();
      if (device) should(await wiki.tapTargetsTooSmall(WikiPage.actionButtons)).eql([]);
      should(await wiki.tapTargetsTooClose(WikiPage.actionButtons)).eql([]);
      await wiki.clickEdit();

      await wiki.setMarkdown("# Rules\n\nBe nice and [ask](/wiki/osmbc/questions).\n\n");
      const preview = await wiki.waitForPreview("Be nice and ask");
      should(preview).containEql("osmbc-wiki-missing");
      should(await wiki.getSaveState()).eql("Not saved");

      const image = path.join(tmpDir, "Screen Shot.png");
      fs.writeFileSync(image, PNG);
      should(await wiki.uploadImage(image)).eql("Uploaded osmbc/screen_shot.png");
      should(await wiki.getMarkdown()).containEql("![screen shot](/wiki/_media/osmbc/screen_shot.png)");
      if (device) {
        should(await wiki.isSaveButtonOnScreen()).be.true();
        should(await wiki.tapTargetsTooSmall(WikiPage.editorButtons)).eql([]);
      }
      if (device) should(await wiki.hasHorizontalScroll()).be.false();
      await wiki.clickSave();

      should(await wiki.isSavedShown()).be.true();
      should(await wiki.getContentText()).containEql("Be nice and ask");
      should(await wiki.getLoadedImages()).eql(["/wiki/_media/osmbc/screen_shot.png"]);
      should(git("log", "-1", "--format=%an", "--", "osmbc/rules.md")).eql("TheFive\n");

      await wiki.clickHistory();
      should(await wiki.getHistory()).eql([
        { author: "TheFive", message: "Edit osmbc/rules" },
        { author: "Hallo", message: "Create osmbc/rules" }
      ]);
      await wiki.clickChangesOfVersion(0);
      should(await wiki.getDiff()).eql({ added: ["Be nice and [ask](/wiki/osmbc/questions).", "", "![screen shot](/wiki/_media/osmbc/screen_shot.png)"], removed: ["Be nice."] });
    });

    it("should restore an old version", async function() {
      await store.savePage("osmbc/rules", "# Rules\n\nBroken.\n", { user: "Hallo" });
      await app.openWikiPage("osmbc/rules?history");
      const wiki = app.getWikiPage();
      await wiki.clickViewVersion(1);
      should(await wiki.getContentText()).containEql("Be nice.");
      await wiki.clickRestore();
      should(await wiki.isSavedShown()).be.true();
      should(await wiki.getContentText()).containEql("Be nice.");
    });

    it("should create a new page in an existing folder from the index", async function() {
      await app.openWikiPage();
      const wiki = app.getWikiPage();
      should(await wiki.getNewPageFolders()).containEql("osmbc");
      await wiki.clickNewPage("osmbc", "First Steps");
      await wiki.setMarkdown("# First steps\n\nCollect an article.");
      await wiki.waitForPreview("Collect an article.");
      await wiki.clickSave();
      should(await wiki.isSavedShown()).be.true();
      should(await store.exists("osmbc/first_steps")).be.true();
    });

    it("should create a new page in a new folder from the index", async function() {
      await app.openWikiPage();
      const wiki = app.getWikiPage();
      await wiki.clickNewPage("", "howto/First Steps");
      await wiki.setMarkdown("# First steps\n\nNew folder.");
      await wiki.waitForPreview("New folder.");
      await wiki.clickSave();
      should(await wiki.isSavedShown()).be.true();
      should(await store.exists("howto/first_steps")).be.true();
    });

    it("should keep a wide table inside the page", async function() {
      await app.openWikiPage("osmbc/wide_table");
      const wiki = app.getWikiPage();
      should(await wiki.getContentText()).containEql("cell");
      if (device) should(await wiki.hasHorizontalScroll()).be.false();
    });
  });
}
