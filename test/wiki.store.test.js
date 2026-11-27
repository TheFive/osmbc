import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import should from "should";

import {
  WikiStore, WikiError, isValidPageId, validateMediaPath, validateMediaContent, blobHash,
  splitFrontMatter, pageAllowsAccess, userHasAccess
} from "../wiki/wikiStore.js";

const pngBytes = (...rest) => Buffer.from([0x89, 0x50, 0x4e, 0x47, ...rest]);

const silentLogger = { info: () => {}, error: () => {} };

function git(dir, ...args) {
  return execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

async function shouldReject(promise, status) {
  let error;
  try {
    await promise;
  } catch (err) {
    error = err;
  }
  should.exist(error, "expected a rejection");
  should(error).be.instanceOf(WikiError);
  should(error.status).eql(status);
  return error;
}

describe("wiki/wikiStore", function() {
  this.timeout(20000);
  let tmpRoot;
  let store;

  beforeEach(function() {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "osmbc-wiki-store-"));
    store = new WikiStore({ directory: path.join(tmpRoot, "wiki"), logger: silentLogger });
  });
  afterEach(function() {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe("helpers", function() {
    it("should accept valid page ids", function() {
      for (const id of ["start", "osmbc/start", "osmbc/how_to-publish", "a/b/c", "30daymapchallenge"]) {
        should(isValidPageId(id)).be.true(id);
      }
    });
    it("should reject invalid page ids", function() {
      for (const id of ["", "../etc/passwd", "osmbc/../start", "/start", "start/", "Start", "a//b",
        "media/logo", "_search", "a.b", "a b", "ä", null, undefined, "x".repeat(201)]) {
        should(isValidPageId(id)).be.false(String(id));
      }
    });
    it("should validate media paths", function() {
      should(validateMediaPath("osmbc/howto-leadpicture.png").contentType).eql("image/png");
      should(validateMediaPath("logo.svg").contentType).eql("image/svg+xml");
      for (const p of ["../x.png", "a/../x.png", ".hidden.png", "x.exe", "x", "A/x.png", "x.png/", ""]) {
        should(() => validateMediaPath(p)).throw(WikiError);
      }
    });
    it("should compute the git blob hash", function() {
      const file = path.join(tmpRoot, "x.txt");
      fs.writeFileSync(file, "Hällo\n");
      should(blobHash("Hällo\n")).eql(execFileSync("git", ["hash-object", file], { encoding: "utf8" }).trim());
    });
    it("should split front matter", function() {
      should(splitFrontMatter("---\naccess: full\ntitle: T\n---\n# Body\n")).eql({ frontMatter: { access: "full", title: "T" }, body: "# Body\n" });
      should(splitFrontMatter("# No front matter\n")).eql({ frontMatter: {}, body: "# No front matter\n" });
      should(splitFrontMatter("---\na: [unclosed\n---\nx").frontMatterError).be.a.String();
    });
    it("should narrow access by front matter only", function() {
      should(pageAllowsAccess({ access: "full" }, "full")).be.true();
      should(pageAllowsAccess({ access: "full" }, "guest")).be.false();
      should(pageAllowsAccess({}, "guest")).be.true();
    });
    it("should give access by level or by OSM user name", function() {
      const full = { OSMUser: "Alice", access: "full" };
      const guest = { OSMUser: "Bob", access: "guest" };
      const denied = { OSMUser: "Eve", access: "denied" };
      should(userHasAccess(["full"], full)).be.true();
      should(userHasAccess(["full"], guest)).be.false();
      should(userHasAccess(["full", "guest"], guest)).be.true();
      // small rollout: only named users, case ignored
      should(userHasAccess(["alice"], full)).be.true();
      should(userHasAccess(["alice"], { OSMUser: "Carol", access: "full" })).be.false();
      should(userHasAccess(["full", "BOB"], guest)).be.true();
      should(userHasAccess(["Eve", "guest", "full"], denied)).be.false();
      should(userHasAccess(["full"], null)).be.false();
    });
  });

  describe("init", function() {
    it("should create a git repository in an empty directory", async function() {
      await store.init();
      should(fs.existsSync(path.join(store.directory, ".git"))).be.true();
    });
    it("should refuse a non-empty directory that is not a repository", async function() {
      fs.mkdirSync(store.directory);
      fs.writeFileSync(path.join(store.directory, "something.txt"), "x");
      await should(store.init()).be.rejectedWith(/not empty and not a git repository/);
    });
    it("should need an absolute directory", function() {
      should(() => new WikiStore({ directory: "wiki" })).throw();
    });
    it("should keep every file access inside the directory", function() {
      should(store._absolute("osmbc/page.md")).eql(path.join(store.directory, "osmbc/page.md"));
      should(store._absolute("")).eql(store.directory);
      should(() => store._absolute("../outside.md")).throw(/Invalid wiki path/);
      should(() => store._absolute("media/../../outside.png")).throw(/Invalid wiki path/);
    });
  });

  describe("pages", function() {
    it("should save and read a page with the editor as author", async function() {
      const result = await store.savePage("osmbc/start", "# Start\r\nHello", { user: "TheFive", baseBlob: "" });
      should(result.changed).be.true();
      should(result.created).be.true();
      const page = await store.readPage("osmbc/start");
      should(page.markdown).eql("# Start\nHello\n");
      should(page.title).eql("Start");
      should(page.blob).eql(result.blob);
      should(git(store.directory, "log", "-1", "--format=%an <%ae>|%cn|%s")).eql("TheFive <TheFive@osmbc>|OSMBC|Create osmbc/start\n");
    });
    it("should return null for a missing page", async function() {
      should(await store.readPage("nothing")).be.null();
      should(await store.exists("nothing")).be.false();
    });
    it("should not commit an unchanged text", async function() {
      const first = await store.savePage("start", "same", { user: "A", baseBlob: "" });
      const result = await store.savePage("start", "same\n", { user: "B", baseBlob: first.blob });
      should(result.changed).be.false();
      should(git(store.directory, "rev-list", "--count", "HEAD").trim()).eql("1");
    });
    it("should report a conflict when the page changed in between", async function() {
      const first = await store.savePage("start", "v1", { user: "A", baseBlob: "" });
      await store.savePage("start", "v2", { user: "B", baseBlob: first.blob });
      const err = await shouldReject(store.savePage("start", "v3", { user: "C", baseBlob: first.blob }), 409);
      should(err.conflict).be.true();
      should(err.currentMarkdown).eql("v2\n");
      should((await store.readPage("start")).markdown).eql("v2\n");
    });
    it("should report a conflict when a new page already exists", async function() {
      await store.savePage("start", "v1", { user: "A", baseBlob: "" });
      await shouldReject(store.savePage("start", "other", { user: "B", baseBlob: "" }), 409);
    });
    it("should not report a conflict when the same text was saved in between", async function() {
      const first = await store.savePage("start", "v1", { user: "A", baseBlob: "" });
      await store.savePage("start", "v2", { user: "B", baseBlob: first.blob });
      const result = await store.savePage("start", "v2", { user: "C", baseBlob: first.blob });
      should(result.changed).be.false();
    });
    it("should refuse a change without base version", async function() {
      await shouldReject(store.savePage("start", "x", { user: "A" }), 400);
      should(fs.existsSync(path.join(store.directory, "start.md"))).be.false();
      const saved = await store.savePage("start", "x", { user: "A", baseBlob: "" });
      await shouldReject(store.movePage("start", "other", { user: "A" }), 400);
      await shouldReject(store.deletePage("start", { user: "A" }), 400);
      await shouldReject(store.revert("start", saved.rev, { user: "A" }), 400);
      should(await store.exists("start")).be.true();
    });
    it("should refuse a missing or non-text page text", async function() {
      await shouldReject(store.savePage("start", undefined, { user: "A", baseBlob: "" }), 400);
      await shouldReject(store.savePage("start", { text: "x" }, { user: "A", baseBlob: "" }), 400);
      should(fs.existsSync(path.join(store.directory, "start.md"))).be.false();
    });
    it("should refuse to move or delete a page that changed in between", async function() {
      const first = await store.savePage("start", "v1", { user: "A", baseBlob: "" });
      await store.savePage("start", "v2", { user: "B", baseBlob: first.blob });
      await shouldReject(store.movePage("start", "other", { user: "C", baseBlob: first.blob }), 409);
      await shouldReject(store.deletePage("start", { user: "C", baseBlob: first.blob }), 409);
      should((await store.readPage("start")).markdown).eql("v2\n");
    });
    it("should serialise concurrent saves", async function() {
      await Promise.all([1, 2, 3, 4, 5].map(n => store.savePage("p" + n, "text " + n, { user: "U" + n, baseBlob: "" })));
      should(git(store.directory, "rev-list", "--count", "HEAD").trim()).eql("5");
    });
    it("should refuse a save without user", async function() {
      await shouldReject(store.savePage("start", "x", {}), 400);
      should(fs.existsSync(path.join(store.directory, "start.md"))).be.false();
    });
    it("should refuse invalid ids without touching the file system", async function() {
      await shouldReject(store.savePage("../outside", "x", { user: "A", baseBlob: "" }), 400);
      should(fs.existsSync(path.join(tmpRoot, "outside.md"))).be.false();
    });
    it("should list pages with titles, without media", async function() {
      await store.savePage("start", "# Welcome\n", { user: "A", baseBlob: "" });
      await store.savePage("osmbc/review", "---\ntitle: Review rules\naccess: full\n---\n# Ignored\n", { user: "A", baseBlob: "" });
      await store.saveMedia("logo.png", pngBytes(), { user: "A" });
      const pages = await store.listPages();
      should(pages.map(p => [p.id, p.title])).eql([["osmbc/review", "Review rules"], ["start", "Welcome"]]);
      should(pages[0].frontMatter.access).eql("full");
    });
    it("should move and delete pages", async function() {
      const saved = await store.savePage("old", "text", { user: "A", baseBlob: "" });
      await store.movePage("old", "ns/new", { user: "B", baseBlob: saved.blob });
      should(await store.readPage("old")).be.null();
      should((await store.readPage("ns/new")).markdown).eql("text\n");
      await shouldReject(store.movePage("missing", "x", { user: "B", baseBlob: "" }), 404);
      const other = await store.savePage("other", "x", { user: "A", baseBlob: "" });
      await shouldReject(store.movePage("other", "ns/new", { user: "B", baseBlob: other.blob }), 409);
      await store.deletePage("ns/new", { user: "C", baseBlob: saved.blob });
      should(await store.exists("ns/new")).be.false();
      await shouldReject(store.deletePage("ns/new", { user: "C", baseBlob: saved.blob }), 404);
    });
  });

  describe("history", function() {
    it("should list the history across a rename and show old revisions", async function() {
      const v1 = await store.savePage("old", "v1", { user: "A", baseBlob: "" });
      await store.movePage("old", "new", { user: "B", baseBlob: v1.blob });
      const v2 = await store.savePage("new", "v2", { user: "C", baseBlob: v1.blob });
      const history = await store.history("new");
      should(history.map(h => [h.author, h.message, h.path])).eql([
        ["C", "Edit new", "new.md"],
        ["B", "Move old to new", "new.md"],
        ["A", "Create old", "old.md"]
      ]);
      should(await store.pageAt("new", v1.rev)).eql("v1\n");
      should(await store.pageAt("new", v2.rev.substring(0, 8))).eql("v2\n");
      const change = await store.change("new", v2.rev);
      should(change.before).eql("v1\n");
      should(change.after).eql("v2\n");
      should((await store.change("new", v1.rev)).before).eql("");
    });
    it("should return an empty history for unknown pages and an empty repo", async function() {
      should(await store.history("nothing")).eql([]);
      await store.savePage("start", "x", { user: "A", baseBlob: "" });
      should(await store.history("nothing")).eql([]);
    });
    it("should reject bad and unknown revisions", async function() {
      await store.savePage("start", "x", { user: "A", baseBlob: "" });
      await should(store.pageAt("start", "HEAD")).be.rejectedWith(WikiError);
      await should(store.pageAt("start", "--output=x")).be.rejectedWith(WikiError);
      await shouldReject(store.pageAt("start", "0000000"), 404);
    });
    it("should revert to an old revision as a new commit", async function() {
      const v1 = await store.savePage("start", "v1", { user: "A", baseBlob: "" });
      const v2 = await store.savePage("start", "v2", { user: "B", baseBlob: v1.blob });
      const result = await store.revert("start", v1.rev, { user: "C", baseBlob: v2.blob });
      should(result.changed).be.true();
      should((await store.readPage("start")).markdown).eql("v1\n");
      should((await store.history("start"))[0].message).match(/^Revert start to /);
    });
  });

  describe("search", function() {
    it("should find text case-insensitively, literally", async function() {
      await store.savePage("a", "# Lead Picture\nthe lead picture rules\n", { user: "A", baseBlob: "" });
      await store.savePage("ns/b", "nothing here\n", { user: "A", baseBlob: "" });
      await store.savePage("c", "a.*b regex chars\n", { user: "A", baseBlob: "" });
      const result = await store.search("LEAD picture");
      should(result.map(r => [r.id, r.matchCount])).eql([["a", 2]]);
      should(result[0].matches[0]).eql({ line: 1, text: "# Lead Picture" });
      should((await store.search("a.*b")).map(r => r.id)).eql(["c"]);
      should(await store.search("does not exist")).eql([]);
      should(await store.search("  ")).eql([]);
      should((await store.search("-e")).length).eql(0);
    });
  });

  describe("media", function() {
    it("should save, read and protect media files", async function() {
      await store.saveMedia("osmbc/shot.png", pngBytes(1, 2), { user: "A", maxBytes: 10 });
      const media = await store.readMedia("osmbc/shot.png");
      should(media.contentType).eql("image/png");
      should(Array.from(media.buffer)).eql([0x89, 0x50, 0x4e, 0x47, 1, 2]);
      should(await store.readMedia("osmbc/missing.png")).be.null();
      should(await store.mediaExists("osmbc/shot.png")).be.true();
      await shouldReject(store.saveMedia("osmbc/shot.png", pngBytes(4), { user: "A" }), 409);
      await store.saveMedia("osmbc/shot.png", pngBytes(4), { user: "A", overwrite: true });
      await shouldReject(store.saveMedia("big.png", Buffer.alloc(11), { user: "A", maxBytes: 10 }), 413);
      await shouldReject(store.saveMedia("script.js", Buffer.from("x"), { user: "A" }), 400);
      await shouldReject(store.saveMedia("fake.png", Buffer.from("<html>"), { user: "A" }), 400);
      should(git(store.directory, "log", "-1", "--format=%s")).eql("Replace media/osmbc/shot.png\n");
    });
  });

  describe("media content", function() {
    it("should accept matching content", function() {
      validateMediaContent(pngBytes(), "png");
      validateMediaContent(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "jpg");
      validateMediaContent(Buffer.from("GIF89a"), "gif");
      validateMediaContent(Buffer.from("RIFF\0\0\0\0WEBPVP8 "), "webp");
      validateMediaContent(Buffer.from("<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0\"/></svg>"), "svg");
    });
    it("should reject mismatching content and active SVG", function() {
      for (const [content, ext] of [
        ["<html>", "png"], ["GIF89a", "jpg"], ["RIFF0000WAVE", "webp"], ["no svg", "svg"],
        ["<svg><script>alert(1)</script></svg>", "svg"],
        ["<svg onload=\"alert(1)\"></svg>", "svg"],
        ["<svg><a href=\"javascript:alert(1)\">x</a></svg>", "svg"],
        ["<svg><foreignObject><div/></foreignObject></svg>", "svg"]
      ]) {
        should(() => validateMediaContent(Buffer.from(content), ext)).throw(WikiError);
      }
    });
  });

  describe("autoPush", function() {
    it("should push after a commit", async function() {
      const remote = path.join(tmpRoot, "remote.git");
      execFileSync("git", ["init", "--quiet", "--bare", remote]);
      store = new WikiStore({ directory: path.join(tmpRoot, "wiki"), autoPush: true, logger: silentLogger });
      await store.init();
      git(store.directory, "remote", "add", "origin", remote);
      const branch = git(store.directory, "symbolic-ref", "--short", "HEAD").trim();
      git(store.directory, "config", "push.default", "current");
      const result = await store.savePage("start", "x", { user: "A", baseBlob: "" });
      // push runs in the background
      for (let i = 0; i < 50; i++) {
        try {
          if (git(remote, "rev-parse", branch).trim() === result.rev) return;
        } catch (err) { /* not pushed yet */ }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      should.fail("commit was not pushed");
    });
    it("should only log a failing push", async function() {
      const errors = [];
      store = new WikiStore({ directory: path.join(tmpRoot, "wiki"), autoPush: true, logger: { info: () => {}, error: (m) => errors.push(m) } });
      const result = await store.savePage("start", "x", { user: "A", baseBlob: "" });
      should(result.changed).be.true();
      for (let i = 0; i < 50 && errors.length === 0; i++) await new Promise(resolve => setTimeout(resolve, 100));
      should(errors[0]).match(/git push failed/);
    });
  });
});
