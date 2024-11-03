

import should from "should";

import nock from "nock";

import testutil from "./testutil.js";
import htmltitle from "../model/htmltitle.js";


describe("model/htmltitle", function() {
  this.timeout(4000);
  before(function(bddone) {
    testutil.nockHtmlPages();
    return bddone();
  });
  after(function(bddone) {
    testutil.nockHtmlPagesClear();
    bddone();
  });
  describe("linkFrom", function() {
    const linkFrom = htmltitle.fortestonly.linkFrom;
    it("should recognize http sources", function(bddone) {
      should(linkFrom("https://twitter.com/irgendwas", "twitter.com")).be.True();
      should(linkFrom("https://forum.openstreetmap.org/viewtopic.php?id=54487", "forum.openstreetmap.org")).be.True();
      should(linkFrom("https://forum.openstreetmap.org/viewtopic.php?id=54487", "witter.com")).be.False();
      should(linkFrom("https://forum.openstreetmap.org/viewtopic.php?id=54487", "google.de")).be.False();
      return bddone();
    });
    it("should recognize https sources", function(bddone) {
      should(linkFrom("https://twitter.com/irgendwas", "twitter.com")).be.True();
      should(linkFrom("https://forum.openstreetmap.org/viewtopic.php?id=54487", "forum.openstreetmap.org")).be.True();
      should(linkFrom("https://forum.openstreetmap.org/viewtopic.php?id=54487", "witter.com")).be.False();
      should(linkFrom("https://forum.openstreetmap.org/viewtopic.php?id=54487", "google.de")).be.False();
      return bddone();
    });
  });
  it("should check a html title", async function() {
    try {
      const result = await htmltitle.getTitle("https://forum.openstreetmap.org/viewtopic.php?id=54487");
      should(result).eql("Bridges which aren't on any Way? / Questions and Answers");
    } catch (err) {
      should.not.exist(err);
    }
  });
  it("should work with empty title", async function() {
    nock("https://www.test.de").get("/page").reply(200, "<title></title>");
    const result = await htmltitle.getTitle("https://www.test.de/page");
    should(result).eql("");
  });
  it("should work with linebreak in  title", async function() {
    nock("https://www.test.de").get("/page").reply(200, "<title>line 1 \n line 2 \r\n line 3 \r last line</title>");
    const result = await htmltitle.getTitle("https://www.test.de/page");
    should(result).eql("line 1   line 2   line 3   last line");
  });
  it("should get title from twitter", async function() {
    const result = await htmltitle.getTitle("https://twitter.com/WeeklyOSM/status/726026930479370241");
    should(result).eql("“The weekly issue #301 now available in *English* the news from the #openstreetmap #osm world <..>”");
  });
  it("should get title from mapoftheweek", async function() {
    const result = await htmltitle.getTitle("https://mapoftheweek.blogspot.ch/2016/04/mapping-playgrounds.html");
    should(result).eql("Map of the Week: Mapping the Playgrounds");
  });
  it("should get title from Media Wiki", async function() {
    const result = await htmltitle.getTitle("https://www.mediawiki.org/wiki/Maps/Conversation_about_interactive_map_use");
    should(result).eql("Maps/Conversation about interactive map use - MediaWiki");
  });
  it("should get title from OSMBlog", async function() {
    const result = await htmltitle.getTitle("https://www.openstreetmap.org/user/phuonglinh9/diary/38568");
    should(result).eql("Blog von phuonglinh9 | Xin chào các bạn");
  });
  it("should get title with other encoding", async function() {
    const result = await htmltitle.getTitle("https://www.gesetze-im-internet.de/satdsig/BJNR259000007.html");
    should(result).eql("SatDSiG - Gesetz zum Schutz vor Gefährdung der Sicherheit der Bundesrepublik Deutschland durch das Verbreiten von hochwertigen Erdfernerkundungsdaten");
  });
  it("should handle timeout", async function() {
    nock("https://www.test.de")
      .get("/testdd")
      .delayConnection(3000)
      .reply(200, "OK");
    const result = await htmltitle.getTitle("https://www.test.de/testdd");
    should(result).eql("https://www.test.de/testdd TIMEOUT");
  });
  it("should handle wrong urls", async function() {
    try {
      await htmltitle.getTitle("https://www.test.dns-not-existing/testdd");
    } catch (err) {
      should(err.message).eql("Problem with url");
    }
  });
  it("should not allow internal IPs", async function() {
    try {
      await htmltitle.getTitle("https://127.0.0.1/testdd");
    } catch (err) {
      should(err.message).eql("Problem with url");
    }
  });
});
