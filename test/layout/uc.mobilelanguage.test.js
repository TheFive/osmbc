import should from "should";
import nock from "nock";
import { By } from "selenium-webdriver";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Small screens work in one language, stored separately from the desktop
// languages (X4/X8/X9 in docs/mobile/platform-matrix.md).
describe("uc/mobile language", function() {
  this.timeout(maxTimer);
  let driver;

  async function isShown(id) {
    const elements = await driver.findElements(By.id(id));
    return elements.length > 0 && await elements[0].isDisplayed();
  }
  async function user() {
    return userModule.findOne({ OSMUser: "TheFive" });
  }
  async function chooseMobileLanguage(lang) {
    await driver.findElement(By.id("mobileLangMenu")).click();
    const entry = await driver.findElement(By.id("mobileLang_" + lang));
    await entry.click();
    // the page reloads: the menu found may be gone before getText
    await driver.wait(async () => {
      try {
        return (await driver.findElement(By.id("mobileLangMenu")).getText()) === lang;
      } catch (err) {
        if (err.name === "StaleElementReferenceError") return false;
        throw err;
      }
    }, 5000, "language not switched");
  }

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c", translationServices: ["copy"] });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
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
    it("should show one language, the main language by default", async function() {
      const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", markdownDE: "Text DE" });
      await driver.get(osmbcLink("/article/" + article.id));
      should(await driver.findElement(By.id("mobileLangMenu")).getText()).eql("DE");
      should(await driver.findElement(By.css("a.navbar-brand")).getText()).eql("WN1");
      should(await isShown("markdownDE")).be.True();
      should(await isShown("markdownEN")).be.False();
    });
    it("should switch the language, translate and save, without changing the desktop languages", async function() {
      const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", markdownDE: "Text DE" });
      await driver.get(osmbcLink("/article/" + article.id));
      await chooseMobileLanguage("EN");
      should(await isShown("markdownEN")).be.True();
      should(await isShown("markdownDE")).be.False();

      await driver.findElement(By.css("button.translateDEEN")).click();
      await driver.wait(async () => (await driver.findElement(By.id("markdownEN")).getAttribute("value")) === "Text DE", 5000, "not translated");
      await driver.findElement(By.id("saveButtonBar")).click();
      await driver.wait(async () => (await articleModule.findById(article.id)).markdownEN === "Text DE", 5000, "not saved");
      // the hidden source text must not be saved along
      should((await articleModule.findById(article.id)).markdownDE).eql("Text DE");

      const u = await user();
      should(u.mobileLang).eql("EN");
      should(u.getMainLang()).eql("DE");
      should(u.getSecondLang()).eql("EN");
    });
    it("should offer translations from all languages with text, English first", async function() {
      const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", markdownDE: "Text DE", markdownEN: "Text EN" });
      // FR is active as soon as an article of an open issue has French text
      await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", markdownFR: "Texte FR" });
      await driver.get(osmbcLink("/article/" + article.id));
      await chooseMobileLanguage("FR");
      const buttons = await driver.findElements(By.css("button[class*='translate'][class$='FR']"));
      const texts = [];
      for (const b of buttons) texts.push(await b.getText());
      should(texts).eql(["Translate from EN", "Translate from DE"]);
    });
    it("should show review and close for the mobile language in the blog", async function() {
      await driver.get(osmbcLink("/blog/WN1/overview"));
      await chooseMobileLanguage("EN");
      should(await driver.findElement(By.id("readyreview")).getText()).match(/\(EN\)/);
    });
  });
  describe("on a desktop", function() {
    beforeEach(async function() {
      driver = await testutil.getNewDriver("TheFive");
    });
    it("should keep the language pair and show no mobile language", async function() {
      const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", markdownDE: "Text DE" });
      await driver.get(osmbcLink("/article/" + article.id));
      should(await isShown("markdownDE")).be.True();
      should(await isShown("markdownEN")).be.True();
      should(await isShown("mobileLangMenu")).be.False();
    });
  });
});
