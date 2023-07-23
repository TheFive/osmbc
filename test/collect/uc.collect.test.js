"use strict";

/* jshint ignore:start */


const nock = require("nock");
const mockdate = require("mockdate");
const should = require("should");
const testutil = require("../testutil.js");
const userModule = require("../../model/user.js");
const articleModule = require("../../model/article.js");
const blogModule = require("../../model/blog.js");


const { osmbcLink } = require("../../util/util.js");

const { By } = require("selenium-webdriver");



describe("uc/collect", function() {
  this.timeout(120000);
  let driver = null;
  before(async function() {
    mockdate.set(new Date("2016-05-25T19:00:00Z"));
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
  });
  after(async function() {
    mockdate.reset();
    nock.cleanAll();
  });

  beforeEach(async function() {
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", language: "DE", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
    await blogModule.createNewBlog({ OSMUser: "test", email: "d@e.f" }, { name: "blog", status: "edit" });
    await articleModule.createNewArticle({
      blog: "blog",
      collection: "http://www.test.dä/holla",
      markdownDE: "[Text](http://www.test.dä/holla) lorem ipsum dolores.",
      markdownEN: "[Text](http://www.test.dä/holla) lerom upsim deloros."
    });
    await articleModule.createNewArticle({
      blog: "blog",
      collection: "http://www.tst.äd/holla",
      markdownDE: "[Text](http://www.tst.äd/holla) ist eine gute Referenz."
    });
    await articleModule.createNewArticle({ blog: "blog", collection: "Link1: http://www.test.dä/holla and other" });
    testutil.startServerSync();
    driver = await testutil.getNewDriver("TheFive");
  });
  afterEach(async function() {
    if (this.currentTest.state !== "failed") await driver.quit();
    await testutil.stopServer();
  });

  describe("Menu Fuctions", function() {
    it("should call search with test", async function() {
      this.timeout(6000);
      await driver.get(osmbcLink("/article/search"));
      await (await driver.findElement(By.id("searchField"))).sendKeys("http://www.test.dä/holla");
      await (await driver.findElement(By.name("SearchNow"))).click();

      should(await (await driver.findElement(By.css("p[id='articleCounter']"))).getText()).eql("Displaying 2 of 2 results.");
    });
  });
  describe("Collect", function() {
    it("should search and store collected article", async function() {
      await driver.get(osmbcLink("/article/create"));
      await (driver.findElement(By.id("searchField"))).sendKeys("searchfor");
      await (await driver.findElement(By.name("SearchNow"))).click();

      await (driver.findElement(By.name("title"))).sendKeys("Test Title for Article");
      await (await driver.findElement(By.id("OK"))).click();
      // wait for page to be loaded use language 2 as indicator
      await driver.findElement(By.css("a#language2"));

      await testutil.expectHtml(driver, "collect", "editPageAfterCollect");
    });
    it("should search and find existing article", async function() {
      await driver.get(osmbcLink("/article/create"));
      nock("http://www.test.dä")
        .get("/holla")
        .reply(200, "<html><head><title>HTML Title for test</title></head><body>The content of the document......</body></html>");
      await (driver.findElement(By.id("searchField"))).sendKeys("http://www.test.dä/holla");
      await (await driver.findElement(By.name("SearchNow"))).click();
      await (driver.findElement(By.id("OK")));

      await testutil.expectHtml(driver, "collect", "foundAnArticle");
    });
  });
});

/* jshint ignore:end */

