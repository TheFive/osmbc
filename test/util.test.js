"use strict";

const util = require("../util/util.js");
const should = require("should");
const path = require("path");
const fs     = require("fs");
const turndownService = require("turndown")();
turndownService.use(require("../util/turndown-it-sup.js"));

const markdown = require("markdown-it")();
const mdUtil = require("../util/md_util.js");
const initialise = require("../util/initialise.js");
const testutil = require("../test/testutil.js");

/* eslint-disable mocha/no-synchronous-tests */
describe("util", function() {
  var data;
  before(function() {
    var file =  path.resolve(__dirname, "data", "util.data.json");
    data = JSON.parse(fs.readFileSync(file));
  });
  describe("shorten", function () {
    it("should return empty string for undefined", function(bddone) {
      should(util.shorten()).equal("");
      var t;
      should(util.shorten(t)).equal("");
      should(util.shorten(t, 25)).equal("");
      bddone();
    });
    it("should not shorten numbers", function(bddone) {
      should(util.shorten(9)).eql(9);
      bddone();
    });
    it("should not shorten small strings", function(bddone) {
      should(util.shorten("Short Test String")).equal("Short Test String");
      should(util.shorten("Short Test String", 20)).equal("Short Test String");
      bddone();
    });
    it("should shorten long strings", function(bddone) {
      should(util.shorten("This is a long string that will not fit on a web page table, so please shorten it")).equal("This is a long string that wil...");
      should(util.shorten("Extreme Test", 1)).equal("E...");
      bddone();
    });
    it("should shorten objects and other non strings", function(bddone) {
      should(util.shorten({ name: "Hallo" })).equal('{"name":"Hallo"}');
      should(util.shorten(null)).equal("");
      should(util.shorten(true)).equal("true");
      bddone();
    });
  });
  describe("toPGString", function() {
    it("should keep things unchanged", function() {
      should(util.toPGString("This is a string")).eql("This is a string");
      should(util.toPGString("https://thisisanurl.org/hallo/do")).eql("https://thisisanurl.org/hallo/do");
    });
    it("should escape ' with '", function() {
      should(util.toPGString("This is a 'string")).eql("This is a ''string");
    });
    it("should double escape ' with '", function() {
      should(util.toPGString("This is a 'string", 2)).eql("This is a ''''string");
    });
  });
  describe("isURL", function() {
    it("should recognise some urls", function() {
      for (var i = 0; i < data.isURLArray.length; i++) {
        should(util.isURL(data.isURLArray[i])).is.True();
      }
    });
    it("should sort Not Urls out", function() {
      for (var i = 0; i < data.isNoURLArray.length; i++) {
        should(util.isURL(data.isNoURLArray[i])).is.False();
      }
    });
    it("should return a regex", function() {
      should((util.isURL() instanceof RegExp)).is.True();
    });
    it("should return false for markdown", function() {
      should((util.isURL("On October 8th, 2015 [Locus](http://www.locusmap.eu/) version [3.13.1](http://www.locusmap.eu/news-version-3-13.0/) was released."))).is.False();
    });
    it("should return false for complex google url", function() {
      should((util.isURL("https://www.google.de/maps/place/Fehlerbereich,+01067+Dresden/@51.0515917,13.7388822,19z/data=!3m1!4b1!4m2!3m1!1s0x4709cf67e58aaa97:0xf782605d9ac23f2c"))).is.True();
    });
  });
  describe("getAllUrl", function() {
    it("should return an empty array for different strings", function() {
      should(util.getAllURL("")).eql([]);
      should(util.getAllURL("Some Text")).eql([]);
    });
    it("should return one url for a 'collection'", function() {
      for (var i = 0; i < data.isURLArray.length; i++) {
        const url = data.isURLArray[i];
        should(util.getAllURL(url)).eql([url]);
        should(util.getAllURL(url + "\n ")).eql([url]);
        should(util.getAllURL(" \n" + url)).eql([url]);
      }
    });
    it("should return several url for a 'collection'", function() {
      for (var i = 0; i < data.isURLArray.length - 1; i++) {
        const url1 = data.isURLArray[i];
        const url2 = data.isURLArray[i + 1];
        should(util.getAllURL(url1 + " " + url2)).eql([url1, url2]);
        should(util.getAllURL(url1 + "\n " + url2)).eql([url1, url2]);
        should(util.getAllURL("  " + url1 + " \n" + url2)).eql([url1, url2]);
      }
    });
    it("should return several url for a 'markdown'", function() {
      should(util.getAllURL('* Wer schon immer mal einen ["Fehlerbereich"]( https://www.google.de/maps/place/Fehlerbereich,+01067+Dresden/@51.0515917,13.7388822,19z/data=!3m1!4b1!4m2!3m1!1s0x4709cf67e58aaa97:0xf782605d9ac23f2c) besuchen wollte, kann sich von Google Maps dahin leiten lassen. Wer sich von Google Maps zum [Brecon Beacons National Park](http://www.openstreetmap.org/#map=10/51.8031/-3.5170) in Wales hat führen lassen, ist an einem Ort südlich des Londoner Hyde Parks gelandet, wie die BBC [berichtet](http://www.bbc.com/news/uk-wales-mid-wales-34410736).'))
        .eql(["https://www.google.de/maps/place/Fehlerbereich,+01067+Dresden/@51.0515917,13.7388822,19z/data=!3m1!4b1!4m2!3m1!1s0x4709cf67e58aaa97:0xf782605d9ac23f2c",
          "http://www.openstreetmap.org/#map=10/51.8031/-3.5170",
          "http://www.bbc.com/news/uk-wales-mid-wales-34410736"]);
    });
  });
  describe("linkify", function() {
    it("should handle undefined values", function(bddone) {
      should(util.linkify(undefined)).eql("undefined");
      bddone();
    });
    it("should convert the links correct", function() {
      should(util.linkify("#WN271_Titel Des Artikels")).equal("#wn271_titel_des_artikels");
    });
  });
  describe("md_render", function() {
    it("should render emty texts", function() {
      should(util.md_render(null)).eql("");
    });
    it("should convert a simple link", function() {
      var r = util.md_render("http://www.google.de/hallo");
      should(r).eql('<p><a target="_blank" href="http://www.google.de/hallo">http://www.google.de/hallo</a></p>\n');
    });
    it("should convert a simple link at the end", function() {
      var r = util.md_render("*italic* http://www.google.de/hallo");
      should(r).eql("<p><em>italic</em> <a target=\"_blank\" href=\"http://www.google.de/hallo\">http://www.google.de/hallo</a></p>\n");
    });
    it("should convert a simple link at the start and ignore a MD LInk", function() {
      var r = util.md_render("http://www.google.de/hallo is a synonym for [this](https://www.google.de/hallo2)");
      should(r).eql('<p><a target="_blank" href="http://www.google.de/hallo">http://www.google.de/hallo</a> is a synonym for <a target="_blank" href="https://www.google.de/hallo2">this</a></p>\n');
    });
    it("should render a shorted link", function() {
      const r = util.md_render("this is a link #1928 to an article");
      should(r).eql("<p>this is a link <a target=\"_blank\" href=\"https://localhost:35043/article/1928\">#1928</a> to an article</p>\n");
    });
    it("should render user names", function() {
      const r = util.md_render("@thefive is telling @user1 about @user2", { TheFive: "full", user1: "denied", user2: "guest" });
      should(r).eql("<p><a class='bg-success' style='color:black' href=/usert/TheFive>@TheFive</a> is telling <a class='bg-danger' style='color:black' href=/usert/user1>@user1</a> about <a class='bg-warning' style='color:black' href=/usert/user2>@user2</a></p>\n");
    });
    it("should not conflict with if username / language is contained in other username", function() {
      const r = util.md_render("@ende is telling @user1 about @user2", { ende: "full", user1: "denied", user2: "guest", en: "full" });
      should(r).eql("<p><a class='bg-success' style='color:black' href=/usert/ende>@ende</a> is telling <a class='bg-danger' style='color:black' href=/usert/user1>@user1</a> about <a class='bg-warning' style='color:black' href=/usert/user2>@user2</a></p>\n");
    });
    it("should do colour mentions after a linebreak", function() {
      const r = util.md_render("@ende is telling \n@user1 about @user2\n", { ende: "full", user1: "denied", user2: "guest", en: "full" });
      should(r).eql("<p><a class='bg-success' style='color:black' href=/usert/ende>@ende</a> is telling\n<a class='bg-danger' style='color:black' href=/usert/user1>@user1</a> about <a class='bg-warning' style='color:black' href=/usert/user2>@user2</a></p>\n");
    });
  });
  describe("turndown-it-sup", function() {
    it("should convert nested superscript ", function() {
      const md = "It contains [^1^](https://link.somewhere) a link with superscript";
      const html = markdown.render(md);
      const backconvertedMd = turndownService.turndown(html);
      should(backconvertedMd).eql(md);
    });
  });
  describe("mdUtil", function() {
    it("should generate emtpy table", function() {
      const json = [];
      const columns = [{ field: "a", name: "A" }];
      const result = mdUtil.mdTable(json, columns);
      should(result).eql("|A|\n|-|\n");
    });
    it("should handle table", function() {
      const json = [{ a: "v2", b: "v3" }, { a: "v2", b: "v3" }];
      const columns = [{ field: "a", name: "A" }, { field: "b", name: "BEEE" }];
      const result = mdUtil.mdTable(json, columns);
      should(result).eql("|A |BEEE|\n|--|----|\n|v2|v3  |\n|v2|v3  |\n");
    });
    it("should handle missing values", function() {
      const json = [{ a: null, b: "v3" }, { a: "v2" }];
      const columns = [{ field: "a", name: "A" }, { field: "b", name: "BEEE" }];
      const result = mdUtil.mdTable(json, columns);
      should(result).eql("|A |BEEE|\n|--|----|\n|  |v3  |\n|v2|    |\n");
    });
    it("should handle different types", function() {
      const json = [{ a: { d: "3" }, b: "v3" }, { a: "v2", b: 22 }];
      const columns = [{ field: "a", name: "A" }, { field: "b", name: "BEEE" }];
      const result = mdUtil.mdTable(json, columns);
      should(result).eql("|A |BEEE|\n|--|----|\n|[object Object]|v3  |\n|v2|22|\n");
    });
  });
  describe("util.osmbcMarkdown Renderer", function() {
    before(async function(){
      await testutil.clearDB();
      await initialise.initialiseModules();
    });
    it("should render emojies",function() {
      const markdown=mdUtil.osmbcMarkdown();
      should(markdown.render(":smiley: with a shortcut :-)")).eql("<p>😃 with a shortcut 😃</p>\n");

    });
  });
});
