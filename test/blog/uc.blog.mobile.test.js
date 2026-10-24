import should from "should";
import nock from "nock";
import { By, Key } from "selenium-webdriver";

import testutil from "../testutil.js";
import { cmdCtrl } from "../PageObjectModel/page.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import BlogPage from "../PageObjectModel/blogPage.js";
import BlogListPage from "../PageObjectModel/blogListPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Inline editor in the blog overview: the most used way to write on a phone.
describe("uc/blog mobile inline editor", function() {
  this.timeout(maxTimer);
  let driver;
  let articleId;

  async function openEditor() {
    await driver.get(osmbcLink("/blog/WN1/overview"));
    // marker survives only if the page is not reloaded
    await driver.executeScript("window.noReloadMarker = true;");
    await new BlogPage(driver).openInlineEditor(articleId);
    const field = await driver.findElement(By.id("markdown" + articleId));
    should(await field.isDisplayed()).be.True();
    return field;
  }

  async function waitForStatus(text) {
    await driver.wait(async function() {
      const status = await driver.findElements(By.id("saveStatus" + articleId));
      return status.length > 0 && (await status[0].getText()) === text;
    }, 5000, "status '" + text + "' not shown");
  }

  // select all and overwrite: unlike clear(), this does not fire "change"
  async function replaceText(field, text, ...keys) {
    await field.sendKeys(Key.chord(cmdCtrl, "a"), text, ...keys);
  }

  async function storedMarkdown() {
    const article = await articleModule.findById(articleId);
    return article.markdownDE;
  }

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
    const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Alter Text" });
    articleId = article.id;
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  describe("on a phone", function() {
    beforeEach(async function() {
      driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    });
    it("should keep the review buttons tap-sized and apart (X10)", async function() {
      const now = new Date().toISOString();
      // review started: an own review comment, and the own review running
      await blogModule.createNewBlog({ OSMUser: "test" }, {
        name: "WN2", status: "edit",
        reviewCommentDE: [{ user: "TheFive", text: "first half ok", timestamp: now }, { user: "TheFive", text: "reviewing...", timestamp: now }]
      });
      const blogPage = new BlogPage(driver);
      await driver.get(osmbcLink("/blog/WN2/overview"));
      should(await blogPage.hasHorizontalScroll()).be.False();
      const buttons = "#reviewButtonDE, #reviewButtonCancelDE, [data-edit-review]";
      should(await blogPage.tapTargetsTooSmall(buttons)).eql([]);
      should(await blogPage.tapTargetsTooClose(buttons)).eql([]);
      await blogPage.clickEditReviewComment("DE", 0);
      should(await blogPage.tapTargetsTooSmall("#reviewButtonDE0")).eql([]);

      await blogPage.clickStopReview("DE");
      const texts = (await blogModule.findOne({ name: "WN2" })).reviewCommentDE.map(c => c.text);
      should(texts).not.containEql("reviewing...");
    });
    it("should list the blogs for the mobile language only (X10)", async function() {
      const blogListPage = new BlogListPage(driver);
      await driver.get(osmbcLink("/blog/list"));
      should(await blogListPage.getLanguageColumns()).eql(["DE"]);
      should(await blogListPage.hasCloseBlogLink()).be.False();
      should(await blogListPage.hasHorizontalScroll()).be.False();
      should(await blogListPage.tapTargetsTooSmall("table td a", { width: 32 })).eql([]);
    });
    it("should hide the optional overview columns", async function() {
      await driver.get(osmbcLink("/blog/WN1/overview"));
      should(new Set(await overviewCellDisplays())).eql(new Set(["none"]));
    });
    it("should keep rows and tabs tap-sized and open the article from its row (X10)", async function() {
      const blogPage = new BlogPage(driver);
      for (const view of ["overview", "review", "full"]) {
        await driver.get(osmbcLink("/blog/WN1/" + view));
        should(await blogPage.hasHorizontalScroll()).be.False();
        should(await blogPage.tapTargetsTooSmall(".osmbc-inline-edit, .osmbc-article-open, .nav-tabs .nav-link, .osmbc-text-link")).eql([]);
        // export is desktop only
        should(await blogPage.isExportMenuShown()).be.False();
      }
      await blogPage.clickOpenArticle(articleId);
      await driver.wait(async () => (await driver.getCurrentUrl()).endsWith("/article/" + articleId), 5000, "article not opened");
    });
    it("should wrap a long word in the article text instead of scrolling sideways", async function() {
      const longWord = "https://wiki.openstreetmap.org/wiki/Pennsylvania/Quadrant_routes_ref:penndot_quadrant_route";
      await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: longWord, markdownDE: "Siehe " + longWord });
      const blogPage = new BlogPage(driver);
      for (const view of ["overview", "review", "full"]) {
        await driver.get(osmbcLink("/blog/WN1/" + view));
        should(await blogPage.hasHorizontalScroll()).be.False(view);
      }
    });
    it("should grow the inline text field with its text", async function() {
      const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Long", markdownDE: Array(15).fill("Eine Zeile Text").join("\n") });
      const blogPage = new BlogPage(driver);
      for (const view of ["overview", "review"]) {
        await driver.get(osmbcLink("/blog/WN1/" + view));
        await blogPage.openInlineEditor(article.id);
        should(await blogPage.isTextFullyShown("markdown" + article.id)).be.True(view + " on open");
        await blogPage.typeInlineText(article.id, "\nnoch eine\nund noch eine\nund noch eine");
        should(await blogPage.isTextFullyShown("markdown" + article.id)).be.True(view + " while typing");
      }
    });
    it("should grow the review comment fields with their text", async function() {
      const now = new Date().toISOString();
      const lines = Array(10).fill("Eine Zeile Review").join("\n");
      await blogModule.createNewBlog({ OSMUser: "test" }, {
        name: "WN2", status: "edit",
        reviewCommentDE: [{ user: "TheFive", text: lines, timestamp: now }, { user: "TheFive", text: "reviewing...", timestamp: now }]
      });
      const blogPage = new BlogPage(driver);
      await driver.get(osmbcLink("/blog/WN2/overview"));
      await blogPage.typeReviewText("DE", lines);
      should(await blogPage.isTextFullyShown("reviewCommentDE")).be.True();
      await blogPage.clickEditReviewComment("DE", 0);
      should(await blogPage.isTextFullyShown("reviewCommentDE0")).be.True();
    });
    it("should save with the Save button without reloading the page", async function() {
      const field = await openEditor();
      await replaceText(field, "Neuer Text");

      // click fails if the button is covered or outside the page
      await driver.findElement(By.id("inlineSave" + articleId)).click();

      await waitForStatus("saved");
      should(await field.isDisplayed()).be.False();
      should(await driver.executeScript("return window.noReloadMarker === true;")).be.True();
      should(await storedMarkdown()).eql("Neuer Text");
    });
    it("should discard the change with Cancel", async function() {
      const field = await openEditor();
      await replaceText(field, "Verworfener Text");

      await driver.findElement(By.id("inlineCancel" + articleId)).click();

      should(await field.isDisplayed()).be.False();
      should(await field.getAttribute("value")).eql("Alter Text");
      // give a wrongly triggered background save the chance to arrive
      await driver.sleep(500);
      should(await storedMarkdown()).eql("Alter Text");
    });
  });
  // cells hidden on phones must still be table cells on a desktop (X6)
  async function overviewCellDisplays() {
    return driver.executeScript("return Array.from(document.querySelectorAll('td.d-md-table-cell')).map(td => getComputedStyle(td).display);");
  }

  describe("on a desktop", function() {
    beforeEach(async function() {
      driver = await testutil.getNewDriver("TheFive");
    });
    it("should show the optional overview columns as table cells", async function() {
      await driver.get(osmbcLink("/blog/WN1/overview"));
      const displays = await overviewCellDisplays();
      should(displays.length).be.above(0);
      should(new Set(displays)).eql(new Set(["table-cell"]));
    });
    it("should still save when leaving the text field, without reloading", async function() {
      const field = await openEditor();
      await replaceText(field, "Text vom Desktop", Key.TAB);

      await waitForStatus("saved");
      should(await driver.executeScript("return window.noReloadMarker === true;")).be.True();
      should(await storedMarkdown()).eql("Text vom Desktop");
    });
    it("should ask before closing a language and keep it open on Cancel", async function() {
      // reviewed and exported: Close is shown
      await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN2", status: "edit", exportedDE: true, reviewCommentDE: [{ user: "TheFive", text: "ok", timestamp: new Date().toISOString() }] });
      await driver.get(osmbcLink("/blog/WN2/overview"));
      await new BlogPage(driver).clickCloseAndCancel("WN2", "DE");
      should((await blogModule.findOne({ name: "WN2" })).closeDE).not.be.True();
    });
  });
});
