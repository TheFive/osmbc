import should from "should";

import { htmlLineDiff, escapeHtml } from "../wiki/wikiDiff.js";
import { createWikiNotifier, wikiChangeText } from "../wiki/wikiNotify.js";

describe("wiki/wikiDiff", function() {
  it("should escape HTML", function() {
    should(escapeHtml("<a href=\"x\">'&'</a>")).eql("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
  it("should show added and removed lines with context", function() {
    const before = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].join("\n") + "\n";
    const after = before.replace("e\n", "E <b>\n");
    const diff = htmlLineDiff(before, after, { context: 1 });
    should(diff.added).eql(1);
    should(diff.removed).eql(1);
    should(diff.html).eql(
      "<div class=\"osmbc-wiki-diff-skip\">…</div>\n" +
      "<div class=\"osmbc-wiki-diff-line\">  d</div>\n" +
      "<div class=\"osmbc-wiki-diff-line osmbc-wiki-diff-removed\">- e</div>\n" +
      "<div class=\"osmbc-wiki-diff-line osmbc-wiki-diff-added\">+ E &lt;b&gt;</div>\n" +
      "<div class=\"osmbc-wiki-diff-line\">  f</div>\n" +
      "<div class=\"osmbc-wiki-diff-skip\">…</div>\n");
  });
  it("should handle a new page", function() {
    should(htmlLineDiff("", "x\ny\n")).eql({
      html: "<div class=\"osmbc-wiki-diff-line osmbc-wiki-diff-added\">+ x</div>\n<div class=\"osmbc-wiki-diff-line osmbc-wiki-diff-added\">+ y</div>\n",
      added: 2,
      removed: 0
    });
  });
});

describe("wiki/wikiNotify", function() {
  const logger = { info: () => {}, error: () => {} };
  const site = "https://osmbc.example.com";

  it("should describe every kind of change", function() {
    const base = { id: "osmbc/start", user: "TheFive", rev: "0123456789abcdef", url: "/wiki/osmbc/start", message: "typo" };
    should(wikiChangeText(Object.assign({}, base, { type: "edit" }), site))
      .eql("edited wiki page [osmbc/start](https://osmbc.example.com/wiki/osmbc/start): typo ([changes](https://osmbc.example.com/wiki/osmbc/start?diff=0123456789ab))");
    should(wikiChangeText(Object.assign({}, base, { type: "create", message: "" }), site))
      .eql("created wiki page [osmbc/start](https://osmbc.example.com/wiki/osmbc/start)");
    should(wikiChangeText(Object.assign({}, base, { type: "move", fromId: "old" }), site))
      .eql("moved wiki page old to [osmbc/start](https://osmbc.example.com/wiki/osmbc/start): typo");
    should(wikiChangeText(Object.assign({}, base, { type: "delete" }), site)).eql("deleted wiki page osmbc/start: typo");
    should(wikiChangeText({ type: "upload", mediaPath: "osmbc/a.png", url: "/wiki/_media/osmbc/a.png" }, site))
      .eql("uploaded [osmbc/a.png](https://osmbc.example.com/wiki/_media/osmbc/a.png) to the wiki");
  });

  it("should send one message per change in mode each", function() {
    const sent = [];
    const notify = createWikiNotifier({ channel: "#wiki", mode: "each" }, { send: (m) => sent.push(m), siteUrl: site, botName: "osmbc", iconUrl: "icon", logger });
    notify({ type: "create", id: "x", user: "TheFive", url: "/wiki/x" });
    should(sent).eql([{ text: "created wiki page [x](https://osmbc.example.com/wiki/x)", channel: "#wiki", username: "osmbc(TheFive)", icon_url: "icon" }]);
  });

  it("should send nothing when off, misconfigured or without channel", function() {
    const sent = [];
    const errors = [];
    const send = (m) => sent.push(m);
    createWikiNotifier(null, { send, logger })({ type: "edit", id: "x", url: "/wiki/x" });
    createWikiNotifier({ channel: "#wiki", mode: "off" }, { send, logger })({ type: "edit", id: "x", url: "/wiki/x" });
    createWikiNotifier({ mode: "each" }, { send, logger })({ type: "edit", id: "x", url: "/wiki/x" });
    createWikiNotifier({ channel: "#wiki", mode: "daily" }, { send, logger: { error: (e) => errors.push(e) } })({ type: "edit", id: "x", url: "/wiki/x" });
    should(sent).eql([]);
    should(errors[0]).match(/unknown wiki.mattermost.mode/);
  });

  it("should not throw when sending fails", function() {
    const errors = [];
    const notify = createWikiNotifier({ channel: "#wiki", mode: "each" }, { send: () => { throw new Error("down"); }, logger: { error: (e) => errors.push(e) } });
    notify({ type: "edit", id: "x", url: "/wiki/x" });
    should(errors[0]).match(/down/);
  });
});
