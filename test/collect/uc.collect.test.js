"use strict";

/* jshint ignore:start */


const async = require("async");
const nock = require("nock");
const cheerio = require("cheerio");
const should = require("should");
const testutil = require("../testutil.js");
const userModule = require("../../model/user.js");
const articleModule = require("../../model/article.js");
const blogModule = require("../../model/blog.js");






describe("uc/collect", function() {
  this.timeout(120000);
  let browser;
  let nockLoginPage;
  before(async function() {
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
  });

  beforeEach(async function() {
    nockLoginPage = testutil.nockLoginPage();
    await testutil.clearDB();
    await userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "DE", mainLang: "DE", secondLang: "EN"});
    await blogModule.createNewBlog({OSMUser: "test"}, {name: "blog",status:"edit"});
    await articleModule.createNewArticle({
      blog: "blog",
      collection: "http://www.test.dä/holla",
      markdownDE: "[Text](http://www.test.dä/holla) lorem ipsum dolores.",
      markdownEN: "[Text](http://www.test.dä/holla) lerom upsim deloros."});
    await articleModule.createNewArticle({
      blog: "blog",
      collection: "http://www.tst.äd/holla",
      markdownDE: "[Text](http://www.tst.äd/holla) ist eine gute Referenz."});
    await articleModule.createNewArticle({blog: "blog", collection: "Link1: http://www.test.dä/holla and other"});
    testutil.startServerSync();
    browser = await testutil.getNewBrowser("TheFive");
  });
  afterEach(function(bddone) {
    nock.removeInterceptor(nockLoginPage);
    testutil.stopServer(bddone);
  });

  after(async function() {
    nock.cleanAll();
  });

  describe("Menu Fuctions", function() {
    it("should call search with test", async function() {
      this.timeout(5000);
      await browser.visit("/article/search");
      browser.fill("search", "http://www.test.dä/holla");
      await browser.pressButton("SearchNow");
      browser.assert.text("p#articleCounter", "Display 2 of 2 articles.");
    });
  });
  describe("Collect", function() {
    it("should search and store collected article", async function() {
      await browser.visit("/article/create");
      await browser
        .fill("search", "searchfor")
        .pressButton("SearchNow");
      await browser
        .fill("title", "Test Title for Article")
        .pressButton("OK");
      browser.assert.expectHtmlSync("collect","editPageAfterCollect");
    });
    it("should search and find existing article", async function() {
      await browser.visit("/article/create");
      await browser
        .fill("search", "http://www.test.dä/holla")
        .pressButton("SearchNow");
      browser.assert.expectHtmlSync("collect","foundAnArticle");
    });
    it("should search and store collected article for one language", async function() {
      await browser.visit("/osmbc");
      await browser.click("a#lang2_EN");
      await browser.visit("/article/create");
      await browser
        .fill("search", "searchfor")
        .pressButton("SearchNow");

      await  browser
        .fill("title", "Test Title for Article")
        .click("button[id=OKLang]");
      browser.assert.expectHtmlSync("collect","editPageWithOneLanguage");


    });
  });
});

/* jshint ignore:end */

