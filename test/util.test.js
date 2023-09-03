

import should from "should";
import path from "path";
import fs from "fs";
import turndown from "turndown";
import config from "../config.js";

import turndownItSup from "../util/turndown-it-sup.js";
import turndownItImsize from "../util/turndown-it-imsize.js";

import markdownIt from "markdown-it";
import markdownItImsize from "markdown-it-imsize";

import mdUtil from "../util/md_util.js";
import initialiseModules from "../util/initialise.js";
import testutil from "../test/testutil.js";
import InternalCache from "../util/internalCache.js";


import util from "../util/util.js";
const turndownService = turndown();

turndownService.use(turndownItSup);
turndownService.use(turndownItImsize);
const markdown = markdownIt();
markdown.use(markdownItImsize);
const sleep = util.sleep;


/* eslint-disable mocha/no-synchronous-tests */
describe("util", function() {
  let data;
  before(async function() {
    const file =  path.resolve(config.getDirName(), "test", "data", "util.data.json");
    data = JSON.parse(fs.readFileSync(file));
  });
  describe("shorten", function () {
    it("should return empty string for undefined", function(bddone) {
      should(util.shorten()).equal("");
      let t;
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
      for (let i = 0; i < data.isURLArray.length; i++) {
        should(util.isURL(data.isURLArray[i])).is.True();
      }
    });
    it("should sort Not Urls out", function() {
      for (let i = 0; i < data.isNoURLArray.length; i++) {
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
      for (let i = 0; i < data.isURLArray.length; i++) {
        const url = data.isURLArray[i];
        should(util.getAllURL(url)).eql([url]);
        should(util.getAllURL(url + "\n ")).eql([url]);
        should(util.getAllURL(" \n" + url)).eql([url]);
      }
    });
    it("should return several url for a 'collection'", function() {
      for (let i = 0; i < data.isURLArray.length - 1; i++) {
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
    function mdRenderInline(text, accessMap) {
      const osmbcMarkdown = mdUtil.osmbcMarkdown({ target: "editor" }, accessMap);
      return osmbcMarkdown.render(text ?? "");
    }
    before(async function() {
      await testutil.clearDB();
      await initialiseModules();
    });
    it("should render emty texts", function() {
      should(mdRenderInline(null)).eql("");
    });
    it("should convert a simple link", function() {
      const r = mdRenderInline("http://www.google.de/hallo");
      should(r).eql('<p><a href=\"http://www.google.de/hallo\" target=\"_blank\" rel=\"noopener\">http://www.google.de/hallo</a></p>\n');
    });
    it("should convert a simple link at the end", function() {
      const r = mdRenderInline("*italic* http://www.google.de/hallo");
      should(r).eql("<p><em>italic</em> <a href=\"http://www.google.de/hallo\" target=\"_blank\" rel=\"noopener\">http://www.google.de/hallo</a></p>\n");
    });
    it("should convert a simple link at the start and ignore a MD LInk", function() {
      const r = mdRenderInline("http://www.google.de/hallo is a synonym for [this](https://www.google.de/hallo2)");
      should(r).eql('<p><a href=\"http://www.google.de/hallo\" target=\"_blank\" rel=\"noopener\">http://www.google.de/hallo</a> is a synonym for <a href=\"https://www.google.de/hallo2\" target=\"_blank\" rel=\"noopener\">this</a></p>\n');
    });
    it("should render a shorted link", function() {
      const r = mdRenderInline("this is a link #1928 to an article", {});
      should(r).eql("<p>this is a link <a href=\"http://localhost:35043/article/1928\" target=\"_blank\" rel=\"noopener\">#1928</a> to an article</p>\n");
    });
    it("should render user names", function() {
      const r = mdRenderInline("@thefive is telling @user1 about @user2", { TheFive: "full", user1: "denied", user2: "guest" });
      should(r).eql('<p><a href="http://localhost:35043/usert/thefive" class="bg-success" style="color:black" target="_blank" rel="noopener">@thefive</a> is telling <a href="http://localhost:35043/usert/user1" class="bg-danger" style="color:black" target="_blank" rel="noopener">@user1</a> about <a href="http://localhost:35043/usert/user2" class="bg-warning" style="color:black" target="_blank" rel="noopener">@user2</a></p>\n');
    });
    it("should not render mentions as user name if not in accessMap", function() {
      const r = mdRenderInline("@EN has to do something here, what can be relevant for @DE", { TheFive: "full", user1: "denied", user2: "guest" });
      should(r).eql("<p>@EN has to do something here, what can be relevant for @DE</p>\n");
    });
    it("should not conflict with if username / language is contained in other username", function() {
      const r = mdRenderInline("@ende is telling @user1 about @user2", { ende: "full", user1: "denied", user2: "guest", en: "full" });
      should(r).eql('<p><a href="http://localhost:35043/usert/ende" class="bg-success" style="color:black" target="_blank" rel="noopener">@ende</a> is telling <a href="http://localhost:35043/usert/user1" class="bg-danger" style="color:black" target="_blank" rel="noopener">@user1</a> about <a href="http://localhost:35043/usert/user2" class="bg-warning" style="color:black" target="_blank" rel="noopener">@user2</a></p>\n');
    });
    it("should do colour mentions after a linebreak", function() {
      const r = mdRenderInline("@ende is telling \n@user1 about @user2\n", { ende: "full", user1: "denied", user2: "guest", en: "full" });
      should(r).eql('<p><a href="http://localhost:35043/usert/ende" class="bg-success" style="color:black" target="_blank" rel="noopener">@ende</a> is telling\n<a href="http://localhost:35043/usert/user1" class="bg-danger" style="color:black" target="_blank" rel="noopener">@user1</a> about <a href="http://localhost:35043/usert/user2" class="bg-warning" style="color:black" target="_blank" rel="noopener">@user2</a></p>\n');
    });
  });
  describe("turndown-it", function() {
    it("should convert nested superscript ", function() {
      const md = "It contains [^1^](https://link.somewhere) a link with superscript";
      const html = markdown.render(md);
      const backconvertedMd = turndownService.turndown(html);
      should(backconvertedMd).eql(md);
    });
    it("should turndown imsize markdown ", function() {
      const md = "It contains ![onki](https://link.to.somehow =1000x500) a link with size and one ![](https://someOtherStuff.bonk) without";
      const html = markdown.render(md);
      console.dir(html);
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
    it("should eliminate pipe symbols", function() {
      const json = [{ a: { d: "3" }, b: "something | with pipe" }, { a: "v2", b: 22 }];
      const columns = [{ field: "a", name: "A" }, { field: "b", name: "BEEE" }];
      const result = mdUtil.mdTable(json, columns);
      should(result).eql("|A |BEEE                 |\n|--|---------------------|\n|[object Object]|something   with pipe|\n|v2|22|\n");
    });
  });
  describe("util.osmbcMarkdown Renderer", function() {
    before(async function() {
      await testutil.clearDB();
      await initialiseModules();
    });
    it("should render emojies", function() {
      const markdown = mdUtil.osmbcMarkdown();
      should(markdown.render(":smiley: with a shortcut :-)")).eql("<p>😃 with a shortcut 😃</p>\n");
    });
    it("should render imsize links", function() {
      const markdown = mdUtil.osmbcMarkdown();
      should(markdown.render("This is a link with size ![text](https://a.picture =20x30)")).eql('<p>This is a link with size <img src="https://a.picture" alt="text" width="20" height="30"></p>\n');
    });
    it("should render superscript", function() {
      const markdown = mdUtil.osmbcMarkdown();
      should(markdown.render("29^th^")).eql('<p>29<sup>th</sup></p>\n');
    });
    it("should render superscript with links", function() {
      const markdown = mdUtil.osmbcMarkdown();
      should(markdown.render("29^[2](https://a.link)^")).eql('<p>29<sup>[2](https://a.link)</sup></p>\n');
    });
  });
  describe("internal cache", function() {
    let internalCache = null;
    beforeEach(function(bddone) {
      fs.unlink(path.join(config.getDirName(), "..", "cache", "testCache.json"), function() {
        internalCache = new InternalCache({ file: "testCache.json" });
        bddone();
      });
    });
    it("should store a key", async function() {
      should(internalCache.get("key")).eql(undefined);
      internalCache.set("key", "value");
      should(internalCache.get("key")).eql("value");
    });
    it("should store a key persistent", async function() {
      should(internalCache.get("key")).eql(undefined);
      internalCache.set("key", "value");
      await (sleep(1200));
      const differentCache = internalCache = new InternalCache({ file: "testCache.json" });

      should(differentCache.get("key")).eql("value");
    });
  });
});
