import should from "should";
import nock from "nock";
import { By, until } from "selenium-webdriver";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Below Bootstrap's lg breakpoint the menu is a side panel (offcanvas).
describe("uc/navbar on small screens", function() {
  this.timeout(maxTimer);
  let driver;

  async function panel() {
    return driver.findElement(By.id("navbarSupportedContent"));
  }
  async function openPanel() {
    await driver.findElement(By.css("button.navbar-toggler")).click();
    await driver.wait(async () => (await (await panel()).getAttribute("class")).includes("show"), 3000, "menu panel did not open");
  }
  async function waitPanelClosed() {
    await driver.wait(async () => !(await (await panel()).getAttribute("class")).includes("show"), 3000, "menu panel did not close");
  }
  // the first element below the navbar must start below it
  async function contentStartsBelowNavbar() {
    return driver.executeScript(`
      const nav = document.getElementById("fixedNavbar").getBoundingClientRect();
      const content = document.querySelector("body > .container-fluid").getBoundingClientRect();
      return content.top >= nav.bottom;`);
  }

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", mobileLang: "EN", email: "a@b.c", translationServices: ["copy"] });
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
    it("should open the menu as a side panel and follow an entry", async function() {
      await driver.get(osmbcLink("/osmbc"));
      should(await contentStartsBelowNavbar()).be.True();
      should(await driver.findElement(By.id("collect")).isDisplayed()).be.False();

      await openPanel();
      // click fails if the entry is covered or outside the screen
      await driver.findElement(By.id("collect")).click();

      await driver.wait(until.urlContains("/article/create"), 3000);
    });
  });
  describe("in the desktop view of a phone browser", function() {
    beforeEach(async function() {
      driver = await testutil.getNewDriver("TheFive", { device: "desktopView" });
    });
    it("should translate and save without the menu covering anything (#1155)", async function() {
      const article = await articleModule.createNewArticle({ blog: "WN1", markdownDE: "Text DE" });
      await driver.get(osmbcLink("/article/" + article.id));
      should(await contentStartsBelowNavbar()).be.True();

      // the desktop view is mobile mode too: one language (EN), Translate
      // at the text field, Save in the bar at the bottom
      await driver.findElement(By.css("button.translateDEEN")).click();
      await driver.wait(async () => (await driver.findElement(By.id("markdownEN")).getAttribute("value")) === "Text DE", 3000);
      // click fails if the button is covered
      await driver.findElement(By.id("saveButtonBar")).click();
      await driver.wait(async () => (await articleModule.findById(article.id)).markdownEN === "Text DE", 3000, "translation not saved");
    });
    it("should close the menu panel after choosing an entry", async function() {
      await driver.get(osmbcLink("/osmbc"));
      await openPanel();
      await driver.findElement(By.id("articleMenuDropdown")).click();
      // a script action keeps the page: the panel must close by itself
      await driver.executeScript("document.getElementById('articleMenuSearch').setAttribute('href', '#');");
      await driver.findElement(By.id("articleMenuSearch")).click();
      await waitPanelClosed();
    });
  });
});
