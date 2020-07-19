"use strict";

var should = require("should");

var nock = require("nock");

var testutil = require("./testutil.js");
var htmltitle = require("../model/htmltitle.js");


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
    let linkFrom = htmltitle.fortestonly.linkFrom;
    it("should recognize http sources", function(bddone) {
      should(linkFrom("http://twitter.com/irgendwas", "twitter.com")).be.True();
      should(linkFrom("http://forum.openstreetmap.org/viewtopic.php?id=54487", "forum.openstreetmap.org")).be.True();
      should(linkFrom("http://forum.openstreetmap.org/viewtopic.php?id=54487", "witter.com")).be.False();
      should(linkFrom("http://forum.openstreetmap.org/viewtopic.php?id=54487", "google.de")).be.False();
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
  it("should get title a forum link", function(bddone) {
    htmltitle.getTitle("http://forum.openstreetmap.org/viewtopic.php?id=54487", function(err, result) {
      should.not.exist(err);
      should(result).eql("Bridges which aren't on any Way? / Questions and Answers");
      bddone();
    });
  });
  it("should get title from twitter", function(bddone) {
    htmltitle.getTitle("https://twitter.com/WeeklyOSM/status/726026930479370241", function(err, result) {
      should.not.exist(err);
      should(result).eql("“The weekly issue #301 now available in *English* the news from the #openstreetmap #osm world <..>”");
      bddone();
    });
  });
  it("should get title from mapoftheweek", function(bddone) {
    htmltitle.getTitle("http://mapoftheweek.blogspot.ch/2016/04/mapping-playgrounds.html", function(err, result) {
      should.not.exist(err);
      should(result).eql("Map of the Week: Mapping the Playgrounds");
      bddone();
    });
  });
  it("should get title from Media Wiki", function(bddone) {
    htmltitle.getTitle("https://www.mediawiki.org/wiki/Maps/Conversation_about_interactive_map_use", function(err, result) {
      should.not.exist(err);
      should(result).eql("Maps/Conversation about interactive map use - MediaWiki");
      bddone();
    });
  });
  it("should get title from OSMBlog", function(bddone) {
    htmltitle.getTitle("http://www.openstreetmap.org/user/phuonglinh9/diary/38568", function(err, result) {
      should.not.exist(err);
      should(result).eql("Blog von phuonglinh9 | Xin chào các bạn");
      bddone();
    });
  });
  it("should get title with other encoding", function(bddone) {
    htmltitle.getTitle("https://www.gesetze-im-internet.de/satdsig/BJNR259000007.html", function(err, result) {
      should.not.exist(err);
      should(result).eql("SatDSiG - Gesetz zum Schutz vor Gefährdung der Sicherheit der Bundesrepublik Deutschland durch das Verbreiten von hochwertigen Erdfernerkundungsdaten");
      bddone();
    });
  });
  it("should handle timeout", function(bddone) {
    nock("https://www.test.test")
      .get("/testdd")
      .delayConnection(3000)
      .reply(200,"OK");
    htmltitle.getTitle("https://www.test.test/testdd", function(err, result) {
      should.not.exist(err);
      should(result).eql("https://www.test.test/testdd TIMEOUT");
      bddone();
    });
  });
});
