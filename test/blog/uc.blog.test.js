



import nock from "nock";
import should from "should";
import { set, reset } from "mockdate";
import { load } from "js-yaml";
import * as fs from "fs";
import { resolve } from "path";
import { URL } from "url";
import testutil from "../../test/testutil.js";

import config from "../../config.js";


import OsmbcApp from "../../test/PageObjectModel/osmbcApp.js";



import initialiseModules from "../../util/initialise.js";
import userModule from "../../model/user.js";






describe("uc/blog", function() {
  this.timeout(2000 * 10);

  before(async function() {
    process.env.TZ = "Europe/Amsterdam";
    set(new Date("2016-05-25T19:00:00Z"));
    await testutil.clearDB();
    await initialiseModules();

    testutil.startServerSync();
  });
  after(async function() {
    reset();
    testutil.stopServer();
  });
  beforeEach(async function() {
    const list = load(fs.readFileSync(resolve(config.getDirName(), "test", "blog", "DataWN290LinkList.txt"), "UTF8"));
    list.forEach(function(item) {
      const url = new URL(item);
      let path = url.pathname;
      if (url.search) path = path + url.search;

      nock(url.protocol + "//" + url.host)
        .head(path)
        .times(99)
        .reply(201, "OK");
      nock("https://missingmattermost.example.com/")
        .post(/\/services\/.*/)
        .times(999)
        .reply(200, "ok");
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
      this.timeout(4000 * 10);
      const errors = [];
      const driverTheFive = await testutil.getNewDriver("TheFive");
      const osmbcAppTheFive = new OsmbcApp(driverTheFive);

      await osmbcAppTheFive.openAdminPage();

      await osmbcAppTheFive.getAdminPage().clickCreateBlogMenu({ confirm: true });

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

      // view review count on start page
      await osmbcAppTheFive.openMainPage();

      await osmbcAppTheFive.getMainPage().waitForInitialisation();
      await testutil.expectHtml(driverTheFive, errors, "blog", "IndexWithOneReview");

      await osmbcAppTheFive.getMainPage().clickBlogInList("WN251");

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
      await driver.quit();
    });
    describe("Blog Display", function() {
      it("should show Full View", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();
        await blogPage.cickMode("Full");
        await blogPage.waitForPageReload();

        await testutil.expectHtml(driver, "blog", "blog_wn290_full");

        const previousText = `Belgian Mapper of the Month:`;

        await blogPage.clickOnArticle(previousText);

        await blogPage.typeEditForm(previousText, "Changed Text in full review");
        await blogPage.clickOnArticle("Digitalcourage suggests");
        should((await blogPage.getEditForm("Changed Text"))).eql("Changed Text in full review");
      });
      it("should show Overview and Edit Article", async function() {
        const errors = [];
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();

        await testutil.expectHtml(driver, errors, "blog", "blog_wn290_overview");

        await blogPage.clickShowVisibleLanguagesCheckbox();
        await blogPage.waitForPageReload();
        await blogPage.clickShowNumbersCheckbox();
        await blogPage.waitForPageReload();
        await blogPage.clickShowCollectorCheckbox();
        await blogPage.waitForPageReload();
        await blogPage.clickShowEditorCheckbox();
        await blogPage.waitForPageReload();
        await blogPage.clickShowColoredUserCheckbox();
        await blogPage.waitForPageReload();
        await blogPage.clickShowLanguagesCheckbox();
        await blogPage.waitForPageReload();

        await testutil.expectHtml(driver, errors, "blog", "blog_wn290_overview_withglab");



        await blogPage.clickOnArticle("jeden Tag...");

        // democote to take a screenshot => to be migrated to testutil.
        // const data = await driver.takeScreenshot();
        // const base64Data = data.replace(/^data:image\/png;base64,/, "");
        // fs.writeFileSync("out.png", base64Data, "base64");

        await blogPage.typeEditForm("jeden Tag...", "Changed Text");

        await blogPage.clickOnArticle("jeden Tag...");

        await blogPage.clickBlogMenu("WN290");

        should((await blogPage.getEditForm("jeden Tag..."))).eql("Changed Text");

        should(errors).eql([]);
      });
      it("should show Review View", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();
        await blogPage.cickMode("Review");



        const previousText = `Der belgische Mapper der Monats ist`;

        await blogPage.clickOnArticle(previousText);

        await blogPage.typeEditForm(previousText, "Changed Text in Review review");
        await blogPage.clickOnArticle("Im Forum wird darüber");

        should((await blogPage.getEditForm("Changed Text"))).eql("Changed Text in Review review");
      });
      it("should show Statistic View", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();
        await blogPage.clickStatisticView();

        await testutil.expectHtml(driver, "blog", "blog_wn290_stat");
        const statisticViewPage = osmbcApp.getStatisticPage();
        await statisticViewPage.clickStatisticItem("WN290", "Katja Ulbert", "collection");
        await testutil.expectHtml(driver, "blog", "blog_wn290_stat_detail");
      });
      it("should show edit View", async function() {
        const osmbcApp = new OsmbcApp(driver);
        await osmbcApp.getMainPage().clickBlogInList("WN290");
        const blogPage = osmbcApp.getBlogPage();
        await blogPage.clickEditView();
        await blogPage.waitForPageReload();
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

