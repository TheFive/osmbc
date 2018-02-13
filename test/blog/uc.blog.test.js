"use strict";

const async = require("async");
const testutil = require("../testutil.js");
const nock = require("nock");
const should  = require("should");
const request   = require("request");
const path = require("path");
const fs = require("fs");
const mockdate = require("mockdate");
const initialise = require("../../util/initialise.js");

const config = require("../../config.js");

const blogModule   = require("../../model/blog.js");
const userModule   = require("../../model/user.js");





describe("uc/blog", function() {
  this.timeout(100000);
  let jar  = null;
  let nockLoginPage;
  beforeEach(async function() {
    jar = request.jar();
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    nockLoginPage = testutil.nockLoginPage();
    process.env.TZ = "Europe/Amsterdam";
    await initialise.initialiseModules();
    testutil.startServerSync();
  });
  afterEach(async function() {
    nock.cleanAll();
    testutil.stopServer();
  });

  describe("status Functions", function() {
    beforeEach(function(bddone) {
      mockdate.set(new Date("2016-05-25T19:00:00Z"));

      async.series([
        testutil.importData.bind(null, {clear: true, blog: [{name: "blog"}], user: [{OSMUser: "TheFive", access: "full", mainLang: "DE"}]}),
        testutil.startServerWithLogin.bind(null, "TheFive", jar)
      ], bddone);
    });
    afterEach(function(bddone) {
      mockdate.reset();
      return bddone();
    });
    it("should be able to manage a blog lifetime", async function() {
      let b = await testutil.getNewBrowser("TheFive");

      await b.visit("/osmbc");

      // go to admin page and create a new blog
      await b.click("a#adminlink");


      await b.click("a#createblog");
      // Confirm that you really want to create a blog
      await b.click("button#createBlog");

      // click on the second blog in the table (thats the WN251 new created)
      await b.click("tbody>tr:nth-child(2)>td>a");

      // Have a look at the blog
      b.assert.expectHtmlSync("blog", "WN251OpenMode");

      // Edit the blog, select EDIT status and stave it
      await b.click("a#editBlogDetail");
      await b.click("a.btn.btn-primary#edit");
      await b.select("status", "edit");
      await b.click("input[value='OK']");

      // go to the blog view with the articles
      await b.click("a[href='/blog/WN251']");
      b.assert.expectHtmlSync("blog", "WN251EditMode");

      // Start Review for blog
      await b.click("button#readyreview");

      // start personal review
      await b.click("button#reviewButtonDE");

      b.fill("input#reviewCommentDE", "1rst Review Text for DE");
      // simulate keyup to enable button for click.
      b.keyUp("input#reviewCommentDE", 30);
      await b.click("button#reviewButtonDE");

      b.fill("input#reviewCommentDE", "2nd Review Text for DE");
      // simulate keyup to enable button for click.
      b.keyUp("input#reviewCommentDE", 30);
      await b.click("button#reviewButtonDE");
      b.assert.expectHtmlSync("blog", "WN251Reviewed");

      await b.click("button#didexport");

      b.assert.expectHtmlSync("blog", "WN251Exported");

      await b.click("button#closebutton");

      b.assert.expectHtmlSync("blog", "WN251Closed");
    });
  });
  describe("browser tests", function() {
    var browser;
    beforeEach(async function() {
      mockdate.set(new Date("2016-05-25T19:00:00Z"));
      await testutil.importData("blog/DataWN290.json");
      await userModule.createNewUser({OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN"});
      testutil.startServerSync();
      browser = await testutil.getNewBrowser("TheFive");
    });
    afterEach(async function() {
      mockdate.reset();
    });
    describe("Blog Display", function() {
      it("should show Overview with some configurations", async function() {
        let errors=[];
        await browser.visit("/blog/WN290");
        browser.assert.expectHtmlSync(errors, "blog", "blog_wn290_overview"),
        await browser.click('span[name="choose_showNumbers"]'),
        //await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click('span[name="choose_showMail"]'),
        //await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click('span[name="choose_showVisibleLanguages"]'),
        //await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click('span[name="choose_showCollector"]'),
        //await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click('span[name="choose_showEditor"]'),
        //await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click('span[name="choose_showColoredUser"]'),
        //await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click('span[name="choose_showLanguages"]'),
        //await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        //await browser.visit("/blog/WN290"),
        //await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        browser.assert.expectHtmlSync(errors, "blog", "blog_wn290_overview_withglab");

        //
        let selector = "table>tbody>tr:nth-child(11)>td:nth-child(3)>div>div>ul>li";
        // ensure that selector shows correct article
        browser.assert.text(selector,"jeden Tag...");
        // Open the edit box
        await browser.click(selector);
        browser.assert.text(selector,"jeden Tag...");
        browser.dump();
        browser.assert.element("textarea#markdown24");
        browser.fill("textarea#markdown24","Fixed Text");
        browser.assert.element(selector);
        browser.assert.text(selector,"jeden Tag...");
        await browser.click(selector);
        should(errors).eql([]);
      });
      it("should show Full View", async function() {
        await browser.visit("/blog/WN290?tab=full");
        browser.assert.expectHtmlSync("blog","blog_wn290_full");
      });
      it("should show Review View",async function() {
        await browser.visit("/blog/WN290?tab=review");
        browser.assert.expectHtmlSync("blog","blog_wn290_review");
      });
      it("should show Statistic View", async function() {
        await browser.visit("/blog/WN290/stat");
        browser.assert.expectHtmlSync("blog","blog_wn290_stat");
      });
      it("should show edit View", async function() {
        await browser.visit("/blog/edit/WN290");
        browser.assert.expectHtmlSync("blog","blog_wn290_edit");
      });
      it("should show the Blog List", async function() {
        await browser.visit("/blog/list?status=edit");
        browser.assert.expectHtmlSync("blog","blog_list");
      });
    });
  });
});
