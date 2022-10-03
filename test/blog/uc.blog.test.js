"use strict";

/* jshint ignore:start */


const nock       = require("nock");
const should     = require("should");
const mockdate   = require("mockdate");
const yaml       = require("js-yaml");
const fs         = require("fs");
const path       = require("path");
const URL        = require("url").URL;
const testutil   = require("../../test/testutil.js");

const { sleep }    = require("../../util/util.js");

const OsmbcApp  = require("../../test/PageObjectModel/osmbcApp.js");



const initialise = require("../../util/initialise.js");
const userModule  = require("../../model/user.js");






describe("uc/blog", function() {
  this.timeout(1000 * 60);

  before(async function() {
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    process.env.TZ = "Europe/Amsterdam";
    mockdate.set(new Date("2016-05-25T19:00:00Z"));
    await testutil.clearDB();
    await initialise.initialiseModules();

    testutil.startServerSync();
  });
  after(async function() {
    mockdate.reset();
    testutil.stopServer();
  });
  const nocklist = [];
  beforeEach(async function() {
    const list = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname, "..", "blog", "DataWN290LinkList.txt"), "UTF8"));
    list.forEach(function(item) {
      const url = new URL(item);
      let path = url.pathname;
      if (url.search) path = path + url.search;

      const n = nock(url.protocol + "//" + url.host)
        .get(path)
        .times(99)
        .reply(201, "OK");
      nocklist.push(n);
    });
  });
  afterEach(async function() {
    nock.cleanAll();
  });

  describe("status Functions", function() {
    beforeEach(async function() {
      await testutil.importData({
        clear: true,
        blog: [],
        user: [{ OSMUser: "TheFive", access: "full", mainLang: "DE", email: "a@b.c" },
          { OSMUser: "User1", access: "full", mainLang: "EN", email: "d@e.f" }]
      });
      nock("https://osmcal.org").get("/api/v2/events/").times(10).reply(200, []);
    });
    it("should be able to manage a blog lifetime", async function() {
      const errors = [];
      const driverTheFive = await testutil.getNewDriver("TheFive");
      const osmbcAppTheFive = new OsmbcApp(driverTheFive);

      await osmbcAppTheFive.openAdminPage();

      await osmbcAppTheFive.getAdminPage().clickCreateBlogMenu({ confirm: true });
      await sleep(300);

      await osmbcAppTheFive.getBlogListPage().clickBlogInList("WN251");

      await testutil.expectHtml(driverTheFive, errors, "blog", "WN251OpenMode");
      const blogPage = osmbcAppTheFive.getBlogPage();
      await blogPage.clickEditBlogDetail();

      const blogDetailPage = osmbcAppTheFive.getBlogDetailPage();

      await blogDetailPage.clickEdit();
      await blogDetailPage.selectStatus("edit");
      await blogDetailPage.clickOK();

      await blogDetailPage.clickBlogMenu("WN251");






      // go to the blog view with the articles

      await testutil.expectHtml(driverTheFive, errors, "blog", "WN251EditMode");


      // Start Review for blog
      await blogPage.clickReadyReview("WN251", "DE");

      // start personal review
      await blogPage.clickStartPersonalReview("DE");


      // Do a first review comment
      await blogPage.typeReviewText("DE", "1rst Review Text for DE");
      await blogPage.clickStoreReviewText("DE");

      // do a second review comment, and cancel that
      await blogPage.clickStartPersonalReview("DE");
      await blogPage.typeReviewText("DE", "2nd Review Text for DE");
      await blogPage.clickStoreReviewText("DE");


      await testutil.expectHtml(driverTheFive, errors, "blog", "WN251Reviewed");



      await blogPage.clickDidExport("DE");





      await testutil.expectHtml(driverTheFive, errors, "blog", "WN251Exported");
      await blogPage.clickClose("WN251", "DE");



      await testutil.expectHtml(driverTheFive, errors, "blog", "WN251Closed");

      const driverUser1 = await testutil.getNewDriver("User1");
      const osmbcAppUser1 = new OsmbcApp(driverUser1);

      // await driverTheOther.get("/blog/WN251");
      await osmbcAppUser1.getMainPage().clickBlogMenu("WN251");
      const blogPageUser1 = osmbcAppUser1.getBlogPage();






      // Start Review for blog in english
      // await driverTheOther.click("button#readyreview");
      await blogPageUser1.clickReadyReview("WN251", "EN");


      // start personal review
      // await driverTheOther.click("button#reviewButtonEN");
      await blogPageUser1.clickStartPersonalReview("EN");

      // driverTheOther.fill("textarea#reviewCommentEN", "1rst Review Text for EN");
      await blogPageUser1.typeReviewText("EN", "1rst Review Text for EN");
      // simulate keyup to enable button for click.

      // await driverTheOther.click("button#reviewButtonEN");
      await blogPageUser1.clickStoreReviewText("EN");

      // in difference to DE language, here no export should appear.
      await blogPageUser1.clickClose("WN251", "EN");
      should(errors).eql([]);
      await driverTheFive.quit();
      await driverUser1.quit();
    });
  });
  describe("Test with Blog Data", function() {
    let driver;
    beforeEach(async function() {
      await testutil.importData("blog/DataWN290.json");
      await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c", translationServices: ["deeplPro"] });
      driver = await testutil.getNewDriver("TheFive");
    });
    afterEach(async function() {
      if (this.currentTest.state !== "failed") await driver.quit();
    });
    describe("Blog Display", function() {
      it("should show Overview and Edit Article", async function() {
        const errors = [];
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();

        await testutil.expectHtml(driver, errors, "blog", "blog_wn290_overview");

        await blogPage.clickShowVisibleLanguagesCheckbox();
        await sleep(500);
        await blogPage.clickShowNumbersCheckbox();
        await sleep(500);
        await blogPage.clickShowCollectorCheckbox();
        await sleep(500);
        await blogPage.clickShowEditorCheckbox();
        await sleep(500);
        await blogPage.clickShowColoredUserCheckbox();
        await sleep(500);
        await blogPage.clickShowLanguagesCheckbox();
        await sleep(500);

        await testutil.expectHtml(driver, errors, "blog", "blog_wn290_overview_withglab");




        await blogPage.clickOnArticle("jeden Tag...");
        sleep(1000);

        await blogPage.typeEditForm("jeden Tag...", "Changed Text");
        sleep(500);

        await blogPage.clickOnArticle("jeden Tag...");

        await blogPage.clickBlogMenu("WN290");
        sleep(750);

        should((await blogPage.getEditForm("jeden Tag..."))).eql("Changed Text");

        should(errors).eql([]);
      });
      it("should show Full View", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();
        await blogPage.cickMode("Full");

        await testutil.expectHtml(driver, "blog", "blog_wn290_full");

        const previousText = `Belgian Mapper of the Month:`;

        await blogPage.clickOnArticle(previousText);

        await blogPage.typeEditForm(previousText, "Changed Text in full review");
        // should(1).eql(0);
        sleep(1000);
        await blogPage.clickOnArticle("Digitalcourage suggests");
        sleep(500);

        should((await blogPage.getEditForm("Changed Text"))).eql("Changed Text in full review");
      });
      it("should show Review View", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();
        await blogPage.cickMode("Review");



        const previousText = `Der belgische Mapper der Monats ist`;

        await blogPage.clickOnArticle(previousText);

        await blogPage.typeEditForm(previousText, "Changed Text in Review review");
        // should(1).eql(0);
        sleep(1000);
        await blogPage.clickOnArticle("Im Forum wird darüber");
        sleep(500);

        should((await blogPage.getEditForm("Changed Text"))).eql("Changed Text in Review review");
      });
      it("should show Statistic View", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();
        await blogPage.clickStatisticView();

        await testutil.expectHtml(driver, "blog", "blog_wn290_stat");
      });
      it("should show edit View", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();
        await blogPage.clickEditView();
        await testutil.expectHtml(driver, "blog", "blog_wn290_edit");
      });
      it("should show the Blog List", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogList();

        await testutil.expectHtml(driver, "blog", "blog_list");
      });
    });
  });
});

/* jshint ignore:end */
