import should from "should";
import nock from "nock";
import { By, Key } from "selenium-webdriver";

import testutil from "../testutil.js";
import { cmdCtrl } from "../PageObjectModel/page.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";

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
    await driver.findElement(By.xpath(`//div[contains(@onclick, "'div${articleId}'")]`)).click();
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
  describe("on a desktop", function() {
    beforeEach(async function() {
      driver = await testutil.getNewDriver("TheFive");
    });
    it("should still save when leaving the text field, without reloading", async function() {
      const field = await openEditor();
      await replaceText(field, "Text vom Desktop", Key.TAB);

      await waitForStatus("saved");
      should(await driver.executeScript("return window.noReloadMarker === true;")).be.True();
      should(await storedMarkdown()).eql("Text vom Desktop");
    });
  });
});
