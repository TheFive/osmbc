import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import should from "should";

import {
  cleanPageId, cleanMediaPath, mapDokuLink, mapDokuMedia, createLinkContext,
  fixUnindentedLists, convertJingo, mapAuthor, classifyPath, migrate
} from "../wiki/dokuwikiMigration.js";

function hasPandoc() {
  try {
    execFileSync("pandoc", ["--version"], { stdio: "ignore" });
    return true;
  } catch (err) {
    return false;
  }
}

function git(dir, args, env = {}) {
  return execFileSync("git", args, {
    cwd: dir,
    encoding: "utf8",
    env: Object.assign({}, process.env, env),
    stdio: ["ignore", "pipe", "pipe"]
  });
}

describe("wiki/dokuwikiMigration", function() {
  describe("names and links", function() {
    it("should clean DokuWiki names to OSMBC page ids", function() {
      should(cleanPageId("osmbc:Onboarding")).eql("osmbc/onboarding");
      should(cleanPageId("Online Meeting 2020-10-13 Stammtisch #4")).eql("online_meeting_2020-10-13_stammtisch_4");
      should(cleanPageId("meetings/slack-discussion-31.8.2016")).eql("meetings/slack-discussion-31-8-2016");
      should(cleanPageId("meeting-on-13.-august-2016")).eql("meeting-on-13-august-2016");
      should(cleanPageId("Übersetzungshilfe")).eql("uebersetzungshilfe");
      should(cleanMediaPath("osmbc/HowTo Lead.PNG")).eql("osmbc/howto_lead.png");
    });
    it("should map DokuWiki links to canonical wiki links", function() {
      const context = createLinkContext(["osmbc/onboarding", "osmbc/start", "meetings/online-meeting-2020", "osmbc/rules"]);
      should(mapDokuLink("/osmbc/rules", "meetings/x", context)).eql("/wiki/osmbc/rules");
      should(mapDokuLink("rules#Some Section", "osmbc/x", context)).eql("/wiki/osmbc/rules#some-section");
      should(mapDokuLink("/osmbc/", "meetings/x", context)).eql("/wiki/osmbc/start");
      // missing pages: same name elsewhere, or the same name without separators
      should(mapDokuLink("Onboarding", "meetings/x", context)).eql("/wiki/osmbc/onboarding");
      should(mapDokuLink("online_meeting_2020", "meetings/x", context)).eql("/wiki/meetings/online-meeting-2020");
      should(mapDokuLink("nowhere", "meetings/x", context)).eql("/wiki/meetings/nowhere");
      should(mapDokuLink("https://osm.org", "x", context)).eql("https://osm.org");
      should(mapDokuLink("mail@example.org", "x", context)).eql("mailto:mail@example.org");
      should(mapDokuLink("#Top Part", "x", context)).eql("#top-part");
    });
    it("should map media relative to the page's namespace", function() {
      should(mapDokuMedia("/osmbc/shot.png", "meetings/x")).eql({ href: "/wiki/_media/osmbc/shot.png", isImage: true });
      should(mapDokuMedia("shot.png", "osmbc/x")).eql({ href: "/wiki/_media/osmbc/shot.png", isImage: true });
      should(mapDokuMedia("/osmbc/doc.pdf", "x").isImage).be.false();
      should(mapDokuMedia("https://e.org/i.png", "x").external).be.true();
    });
    it("should turn unindented * lines into list items outside code", function() {
      should(fixUnindentedLists("* a\n  * b\n<code>\n* c\n</code>\n* d")).eql("  * a\n  * b\n<code>\n* c\n</code>\n  * d");
      should(fixUnindentedLists("**bold**\n*x")).eql("**bold**\n*x");
    });
    it("should convert jingo links outside code", function() {
      const ids = new Map([["picture-licenses.md", "osmbc/picture-licenses"], ["vision-rules.md", "osmbc/vision-rules"]]);
      should(convertJingo("[[Picture Licenses]] and [[EN|Vision Rules]] `[[Picture Licenses]]`", ids))
        .eql("[Picture Licenses](/wiki/osmbc/picture-licenses) and [EN](/wiki/osmbc/vision-rules) `[[Picture Licenses]]`");
    });
    it("should map authors without private e-mail addresses", function() {
      should(mapAuthor("Real Name", "real@example.org", { "Real Name": "osmuser" })).eql({ name: "osmuser", email: "osmuser@osmbc" });
      should(mapAuthor("osmuser", "12345@openstreetmap.org")).eql({ name: "osmuser", email: "osmuser@osmbc" });
      should(mapAuthor("Ted Johnson", "x@y.z")).eql({ name: "Ted Johnson", email: "Ted_Johnson@osmbc" });
    });
    it("should classify the source paths of both eras", function() {
      should(classifyPath("pages/osmbc/start.txt")).eql({ kind: "page", id: "osmbc/start" });
      should(classifyPath("osmbc/start.txt")).eql({ kind: "page", id: "osmbc/start" });
      should(classifyPath("Picture-Licenses.md")).eql({ kind: "jingo", file: "Picture-Licenses.md" });
      should(classifyPath("media/osmbc/a.png")).eql({ kind: "media", mediaPath: "osmbc/a.png" });
      should(classifyPath(".gitignore")).be.null();
    });
  });

  describe("migrate", function() {
    let tmpDir;
    let source;

    before(function() {
      if (!hasPandoc()) {
        console.log("      pandoc not installed, migration run not tested");
        this.skip();
      }
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "osmbc-migration-"));
      source = path.join(tmpDir, "source");
      fs.mkdirSync(source);
      git(source, ["init", "--quiet", "--initial-branch=master"]);
      const commit = (message, author, date) => {
        git(source, ["add", "-A"]);
        git(source, ["-c", "user.name=x", "-c", "user.email=x@x", "commit", "--quiet", "-m", message, "--author", author],
          { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
      };
      const write = (file, text) => {
        fs.mkdirSync(path.dirname(path.join(source, file)), { recursive: true });
        fs.writeFileSync(path.join(source, file), text);
      };
      // jingo era
      const licenses = "# Picture Licenses\n\nOnly free pictures.\nAsk the author.\nName the source.\nSee [[Vision Rules]].\n";
      write("Picture-Licenses.md", licenses);
      write("Vision-Rules.md", "# Vision\n\nBe nice.\n");
      commit("Page created", "Real Name <real@example.org>", "2016-08-28T12:00:00+02:00");
      // conversion to DokuWiki (one renamed by content, one by name)
      fs.rmSync(path.join(source, "Picture-Licenses.md"));
      fs.rmSync(path.join(source, "Vision-Rules.md"));
      write("pages/osmbc/picture-licenses.txt", "====== Picture Licenses ======\n\nOnly free pictures.\nAsk the author.\nName the source.\nSee [[vision-rules]].\n");
      write("pages/osmbc/vision-rules.txt", "====== Vision ======\n\nBe nice and friendly, always.\n");
      commit("move content to dokuwiki format", "osmuser <1@openstreetmap.org>", "2024-03-12T10:00:00+01:00");
      // DokuWiki era
      write("pages/meetings/notes_31.8.2016.txt", "====== Notes ======\n\n* first\n* second\n\n[[Picture Licenses]] [[osmbc:]] [[mail@example.org]]\n\n{{osmbc:shot.png?200}}\n");
      write("pages/osmbc/osm-user-name-mapping-list.txt", "====== Mapping ======\n\nsecret\n");
      write("pages/osmbc/start.txt", "====== Start ======\n");
      write("media/osmbc/shot.png", "PNG");
      commit("Wiki page notes changed", "osmuser <1@openstreetmap.org>", "2026-07-07T15:00:00+02:00");
    });
    after(function() {
      if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    async function run(target) {
      return migrate({
        source: path.join(source, ".git"),
        target,
        authors: { "Real Name": "osmuser" },
        restricted: ["osmbc/osm-user-name-mapping-list"]
      });
    }

    it("should replay the history with authors and dates", async function() {
      const target = path.join(tmpDir, "out1");
      const result = await run(target);
      should(result.commits).eql(3);
      should(result.pages).eql(5);
      should(result.media).eql(1);
      should(git(target, ["log", "--reverse", "--format=%an <%ae> %aI"]).trim().split("\n")).eql([
        "osmuser <osmuser@osmbc> 2016-08-28T12:00:00+02:00",
        "osmuser <osmuser@osmbc> 2024-03-12T10:00:00+01:00",
        "osmuser <osmuser@osmbc> 2026-07-07T15:00:00+02:00"
      ]);
      should(git(target, ["log", "-1", "--format=%B"])).match(/Migrated-From: [0-9a-f]{40}/);
      // the jingo page continues in the DokuWiki page's file
      should(git(target, ["log", "--format=%s", "--", "osmbc/picture-licenses.md"]).trim().split("\n"))
        .eql(["move content to dokuwiki format", "Page created"]);
      should(git(target, ["log", "--format=%s", "--", "osmbc/vision-rules.md"]).trim().split("\n"))
        .eql(["move content to dokuwiki format", "Page created"]);
      should(git(target, ["show", "HEAD~2:osmbc/picture-licenses.md"])).containEql("See [Vision Rules](/wiki/osmbc/vision-rules).");
    });

    it("should convert pages, links and media", async function() {
      const target = path.join(tmpDir, "out1");
      const notes = fs.readFileSync(path.join(target, "meetings/notes_31-8-2016.md"), "utf8");
      should(notes).eql("# Notes\n\n- first\n- second\n\n" +
        "[Picture Licenses](/wiki/osmbc/picture-licenses) [osmbc](/wiki/osmbc/start) <mail@example.org>\n\n" +
        "![shot.png](/wiki/_media/osmbc/shot.png =200x)\n");
      should(fs.readFileSync(path.join(target, "osmbc/osm-user-name-mapping-list.md"), "utf8")).startWith("---\naccess: full\n---\n# Mapping");
      should(fs.readFileSync(path.join(target, "media/osmbc/shot.png"), "utf8")).eql("PNG");
    });

    it("should give the same commits on a second run", async function() {
      const target = path.join(tmpDir, "out2");
      await run(target);
      should(git(target, ["rev-parse", "HEAD"])).eql(git(path.join(tmpDir, "out1"), ["rev-parse", "HEAD"]));
      should(git(target, ["config", "osmbc.migration"]).trim()).eql("dokuwiki");
    });
  });
});
