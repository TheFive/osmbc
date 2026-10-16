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

// Article view: Save must be reachable where the user is writing (X2).
describe("uc.article save bar", function() {
  this.timeout(maxTimer);
  let driver;
  let articleId;

  async function barIsAtBottomOfScreen() {
    return driver.executeScript(`
      const bar = document.querySelector(".osmbc-save-bar").getBoundingClientRect();
      return bar.height > 0 && Math.abs(bar.bottom - window.innerHeight) < 2;`);
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
    const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Text DE" });
    articleId = article.id;
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should keep Save at the bottom of a phone screen while writing", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    await driver.get(osmbcLink("/article/" + articleId));
    // the page must not be wider than the phone (language columns, X8)
    should(await driver.executeScript("return document.documentElement.scrollWidth <= window.innerWidth;")).be.True();
    const barSave = await driver.findElement(By.id("saveButtonBar"));
    // one Save only: the buttons at the top are replaced by the bar,
    // and the bar appears only when something is changed
    should(await driver.findElement(By.id("saveButton")).isDisplayed()).be.False();
    should(await barSave.isDisplayed()).be.False();

    // the English text field is far below the top of the form
    const field = await driver.findElement(By.id("markdownEN"));
    await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", field);
    await field.sendKeys("Text EN");
    should(await barSave.isDisplayed()).be.True();
    should(await barIsAtBottomOfScreen()).be.True();

    // click fails if the bar is covered or outside the screen
    await barSave.click();
    await driver.wait(async () => (await articleModule.findById(articleId)).markdownEN === "Text EN", 5000, "text not saved");
  });
  it("should not show the bar on a desktop", async function() {
    driver = await testutil.getNewDriver("TheFive");
    await driver.get(osmbcLink("/article/" + articleId));
    should(await driver.findElement(By.id("saveButtonBar")).isDisplayed()).be.False();
    should(await driver.findElement(By.id("saveButton")).isDisplayed()).be.True();
  });
});
