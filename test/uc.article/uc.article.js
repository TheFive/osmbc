


import path from "path";
import fs from "fs";
import nock from "nock";
import should from "should";
import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import OsmbcApp from "../../test/PageObjectModel/osmbcApp.js";
import { Key } from "selenium-webdriver";

import util from "../../util/util.js";
import config from "../../config.js";

const osmbcLink = util.osmbcLink;


const maxTimer = 20000;



describe("uc.article", function() {
  this.timeout(10000);
  let driver;
  let articleId;
  let osmbcApp;

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");

    // nock the test data here, so that nock is known
    // when instancing browser
    nock("https://www.test.de")
      .get("/holla")
      .times(5)
      .reply(200, "OK");
    nock("https://www.test.de")
      .head("/holla")
      .times(5)
      .reply(200, "OK");


    testutil.startServerSync();
    await testutil.clearDB();

    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", language: "DE", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "blog" });
    await articleModule.createNewArticle({ blog: "blog", collection: "https://www.test.de/holla", markdownDE: "[Text](https://www.test.de/holla) lorem ipsum dolores.", markdownEN: "[Text](https://www.test.de/holla) lerom upsim deloros." });
    await articleModule.createNewArticle({ blog: "blog", collection: "https://www.tst.äd/holla", markdownDE: "[Text](https://www.tst.äd/holla) ist eine gute Referenz." });
    await articleModule.createNewArticle({ blog: "", collection: "https://www.tst.äd/holla", markdownDE: "[Text](https://www.tst.äd/holla) ist eine gute Referenz." });
    const article = await articleModule.createNewArticle({ blog: "blog", collection: "Link1: https://www.test.de/holla and other" });
    articleId = article.id;
    driver = await testutil.getNewDriver("TheFive");
    osmbcApp = new OsmbcApp(driver);
  });
  afterEach(async function() {
    nock.cleanAll();
    await driver.quit();
    testutil.stopServer();
  });
  describe("Scripting Functions", function() {
    this.timeout(maxTimer);
    beforeEach(async function() {
      await driver.get(osmbcLink("/article/" + articleId));
    });
    it("should isURL work on page", async function() {
      const file =  path.resolve(config.getDirName(), "test", "data", "util.data.json");
      const data = JSON.parse(fs.readFileSync(file));
      for (let i = 0; i < data.isURLArray.length; i++) {
        should(await driver.executeScript("return isURL('" + data.isURLArray[i] + "')")).is.True();
      }
      for (let i = 0; i < data.isNoURLArray.length; i++) {
        should(await driver.executeScript("return isURL('" + data.isNoURLArray[i] + "')")).is.False();
      }
    });

    /* eslint-disable mocha/no-synchronous-tests */
    describe("generateMarkdownLink2", function() {
      it("should past normal text without overwrite", async function() {
        const ap = osmbcApp.getArticlePage();

        await ap.fillMarkdownInput("EN", "Text to be inserted.");
        await ap.fillMarkdownInput("EN", ap.getCtrlA());
        await ap.fillMarkdownInput("EN", Key.chord(Key.COMMAND, "x"));

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 0, 0, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("Text to be inserted.the origin text.");

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 16, 16, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("the origin text.Text to be inserted.");

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 11, 11, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("the origin Text to be inserted.text.");
      });
      it("should past normal text with overwrite", async function() {
        const ap = osmbcApp.getArticlePage();

        await ap.fillMarkdownInput("EN", "Text with replace");
        await ap.fillMarkdownInput("EN", ap.getCtrlA());
        await ap.fillMarkdownInput("EN", Key.chord(Key.COMMAND, "x"));

        await ap.fillMarkdownInput("EN", "ex the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 0, 2, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("Text with replace the origin text.");

        await ap.fillMarkdownInput("EN", "the origin text. TheEnd");
        await ap.selectAndPasteTextInMarkdown("EN", 17, 23, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("the origin text. Text with replace");

        await ap.fillMarkdownInput("EN", "the origin --change here -- text.");
        await ap.selectAndPasteTextInMarkdown("EN", 11, 27, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("the origin Text with replace text.");
      });
      it("should should paste link without overwrite", async function() {
        const ap = osmbcApp.getArticlePage();

        await ap.fillMarkdownInput("EN", "https://Link-to-be-insert.ed");
        await ap.fillMarkdownInput("EN", ap.getCtrlA());
        await ap.fillMarkdownInput("EN", Key.chord(Key.COMMAND, "x"));

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 0, 0, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("[](https://Link-to-be-insert.ed)the origin text.");

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 16, 16, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("the origin text.[](https://Link-to-be-insert.ed)");

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 4, 4, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("the [](https://Link-to-be-insert.ed)origin text.");
      });
      it("should return new value if link is inserted with selection", async function() {
        const ap = osmbcApp.getArticlePage();

        await ap.fillMarkdownInput("EN", "https://Link-to-be-insert.ed");
        await ap.fillMarkdownInput("EN", ap.getCtrlA());
        await ap.fillMarkdownInput("EN", Key.chord(Key.COMMAND, "x"));

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 0, 3, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("[the](https://Link-to-be-insert.ed) origin text.");

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 4, 10, Key.chord(Key.COMMAND, "v"));
        // await ap.waitMarkdownInputToBe("EN", "the [origin](https://Link-to-be-insert.ed) text.");
        // was: by waiting error occurs due to timing isshue
        should(await ap.getMarkdownInput("EN")).eql("the [origin](https://Link-to-be-insert.ed) text.");

        await ap.fillMarkdownInput("EN", "the origin text.");
        await ap.selectAndPasteTextInMarkdown("EN", 11, 16, Key.chord(Key.COMMAND, "v"));

        should(await ap.getMarkdownInput("EN")).eql("the origin [text.](https://Link-to-be-insert.ed)");
      });
    });
    /* eslint-enable mocha/no-synchronous-tests */
  });

  it.skip("should calculate a new height, if to many lines are used", function(bddone) {
    // Function is skipped, it is unclear, how to deal with modified height in zombie.js


    // Simulate a change Event manually

    bddone();
  });
  describe("Change Collection", function() {
    this.timeout(maxTimer * 3);
    beforeEach(async function() {
      nock("https://www.test.de").head("/holla").times(99).reply(200, "OK");
      nock("https://www.openstreetmap.org").head("/a_brilliant_map").times(99).reply(200, "result");
      nock("https://www.site.org").head("/didl?query=some").times(99).reply(200, "result");
      nock("https://www.openstreetmap.org").get("/user/Severák/diary/37681").times(99).reply(200, "result");
      nock("https://productforums.google.com").get("/forum/#!topic/map-maker/Kk6AG2v-kzE").times(99).reply(200, "OK");
      await driver.get(osmbcLink("/article/" + articleId));
    });
    afterEach(async function() {
      nock.cleanAll();
    });
    it("should have converted collection correct", async function() {
      const osmbcApp = new OsmbcApp(driver);
      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://www.test.de/holla")).eql({
        text: "https://www.test.de/holla #(Check for Doublette)",
        warning: true
      });
    });
    it("should ignore brackets in a collection (No Markdown)", async function() {
      const osmbcApp = new OsmbcApp(driver);
      await osmbcApp.getArticlePage().fillCollectionInput("Some collection [link](https://www.openstreetmap.org/a_brilliant_map in Markdown");

      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://www.openstreetmap.org/a_brilliant_map")).eql({
        text: "https://www.openstreetmap.org/a_brilliant_map",
        warning: false
      });
    });

    it("should work on links with queries", async function() {
      const osmbcApp = new OsmbcApp(driver);
      await osmbcApp.getArticlePage().fillCollectionInput("https://www.site.org/didl?query=some");

      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://www.site.org/didl?query=some")).eql({
        text: "https://www.site.org/didl?query=some",
        warning: false
      });
    });
    it("should show multiple links from collection", async function() {
      const osmbcApp = new OsmbcApp(driver);
      await osmbcApp.getArticlePage().fillCollectionInput("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE\nhere: https://www.openstreetmap.org/user/Severák/diary/37681");
      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE")).eql({
        text: "https://productforums.google.com/forum/# . . . v-kzE",
        warning: false
      });
      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://www.openstreetmap.org/user/Severák/diary/37681")).eql({
        text: "https://www.openstreetmap.org/user/Sever . . . 37681",
        warning: false
      });
    });
  });
  describe("QueryParameters", function() {
    this.timeout(maxTimer);
    it("should set markdown to notranslation", async function() {
      let article = await articleModule.findById(articleId);
      article.markdownDE = "Text";
      article.categoryEN = "Picture";
      article.markdownEN = "";
      article.markdownES = "";
      await article.save();
      await driver.get(osmbcLink("/article/" + articleId));
      await osmbcApp.getArticlePage().clickNoTranslationButton();
      article = await articleModule.findById(articleId);
      should(article.markdownDE).eql("Text");
      should(article.markdownEN).eql("no translation");
      should(article.markdownES).eql("");
    });
  });
  describe("onchangeCollection", function() {
    this.timeout(maxTimer * 3);
    beforeEach(async function() {
      await driver.get(osmbcLink("/article/" + articleId));
    });

    it("should show multiple links from collection field under the field", async function() {
      await osmbcApp.getArticlePage().fillCollectionInput("Wumbi told something about https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE \n here: https://www.openstreetmap.org/user/Severák/diary/37681");

      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE")).eql({
        text: "https://productforums.google.com/forum/# . . . v-kzE",
        warning: false
      });
      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://www.openstreetmap.org/user/Severák/diary/37681")).eql({
        text: "https://www.openstreetmap.org/user/Sever . . . 37681",
        warning: false
      });
    });
    it("should show multiple links from collection only separated by carrige return", async function() {
      await osmbcApp.getArticlePage().fillCollectionInput("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE\nhere: https://www.openstreetmap.org/user/Severák/diary/37681");


      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE")).eql({
        text: "https://productforums.google.com/forum/# . . . v-kzE",
        warning: false
      });
      should(await osmbcApp.getArticlePage().getValueFromLinkArea("https://www.openstreetmap.org/user/Severák/diary/37681")).eql({
        text: "https://www.openstreetmap.org/user/Sever . . . 37681",
        warning: false
      });
    });
  });

  describe("onchangeMarkdown", function() {
    this.timeout(maxTimer * 3);
    beforeEach(async function() {
      await driver.get(osmbcLink("/article/" + articleId));
    });
    it("should warn on double links", async function() {
      await osmbcApp.getArticlePage().fillMarkdownInput("DE", "https://a.link is referenced tiwce https://a.link");
      const warning = await osmbcApp.getArticlePage().getWarningMessage("DE");
      should(warning).equal("Link https://a.link is used twice in markdown");
    });
  });

  describe("Comments", function() {
    it("should add and change a comment of an article", async function() {
      await driver.get(osmbcLink("/article/1"));
      const articlePage = osmbcApp.getArticlePage();
      await articlePage.fillCommentInput("Add a test comment");
      await articlePage.clickAddComment();




      let article = await articleModule.findById(1);

      should(article.commentList.length).eql(1);
      should(article.commentList[0].text).eql("Add a test comment");
      should(article.commentList[0].user).eql("TheFive");

      await articlePage.editComment(0, "And Change It");

      article = await articleModule.findById(1);

      should(article.commentList.length).eql(1);
      should(article.commentList[0].text).eql("And Change It");
      should(article.commentList[0].user).eql("TheFive");
    });
  });
  describe("Translate", function() {
    // skipped, as there is only a workaround ignoring internal translation nock
    it.skip("should call and translate an article", async function() {

    });
  });
});

