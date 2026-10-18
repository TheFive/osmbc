import should from "should";
import nock from "nock";
import { By } from "selenium-webdriver";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import ArticlePage from "../PageObjectModel/articlePage.js";

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

    // mobile mode shows one language (the user's main language DE);
    // its text field is far below the top of the form
    const field = await driver.findElement(By.id("markdownDE"));
    await driver.executeScript("arguments[0].scrollIntoView({block: 'center'});", field);
    await field.sendKeys(" more");
    should(await barSave.isDisplayed()).be.True();
    should(await barIsAtBottomOfScreen()).be.True();

    // click fails if the bar is covered or outside the screen
    await barSave.click();
    await driver.wait(async () => (await articleModule.findById(articleId)).markdownDE === "Text DE more", 5000, "text not saved");
  });
  it("should insert a collection link and its translation link by tapping (X7)", async function() {
    const linked = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Text DE", collection: "https://example.com/news" });
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + linked.id));
    // select "Text": the link is put around it
    await articlePage.setMarkdownSelection("DE", 0, 4);
    await articlePage.clickInsertLink();
    should(await articlePage.getMarkdownInput("DE")).eql("[Text](https://example.com/news) DE");

    await articlePage.setMarkdownSelection("DE", "end");
    await articlePage.clickInsertTranslatedLink();
    should(await articlePage.getMarkdownInput("DE"))
      .eql("[Text](https://example.com/news) DE:??-s: >   [:DE-t:](https://example-com.translate.goog/news?_x_tr_sl=auto&_x_tr_tl=DE)");
    should(await articlePage.isSaveBarShown()).be.True();
  });
  it("should not show the insert buttons on a desktop", async function() {
    const linked = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Text DE", collection: "https://example.com/news" });
    driver = await testutil.getNewDriver("TheFive");
    await driver.get(osmbcLink("/article/" + linked.id));
    should(await new ArticlePage(driver).isInsertLinkShown()).be.False();
  });
  it("should insert a dropped text where it is dropped, not at the cursor", async function() {
    driver = await testutil.getNewDriver("TheFive");
    await driver.get(osmbcLink("/article/" + articleId));
    // what the browser does on a drop: the cursor stays at the start, the
    // dragged translation link lands at the end of the text
    const dropped = ":??-s: >   [:DE-t:](https://example-com.translate.goog/news?_x_tr_sl=auto&_x_tr_tl=DE)";
    await driver.executeScript(`
      const f = document.getElementById("markdownDE");
      f.value = "https://example.com/news";
      f.setSelectionRange(0, 0);
      f.dispatchEvent(new Event("drop"));
      f.value = f.value + arguments[0];
      f.setSelectionRange(f.value.length, f.value.length);`, dropped);
    await driver.sleep(100);
    should(await driver.findElement(By.id("markdownDE")).getAttribute("value")).eql("https://example.com/news" + dropped);

    // a dropped url still becomes a markdown link
    await driver.executeScript(`
      const f = document.getElementById("markdownDE");
      f.value = "See  here";
      f.setSelectionRange(0, 0);
      f.dispatchEvent(new Event("drop"));
      f.value = "See https://example.com/news here";
      f.setSelectionRange(f.value.length, f.value.length);`);
    await driver.sleep(100);
    should(await driver.findElement(By.id("markdownDE")).getAttribute("value")).eql("See [](https://example.com/news) here");
  });
  it("should not show the bar on a desktop", async function() {
    driver = await testutil.getNewDriver("TheFive");
    await driver.get(osmbcLink("/article/" + articleId));
    should(await driver.findElement(By.id("saveButtonBar")).isDisplayed()).be.False();
    should(await driver.findElement(By.id("saveButton")).isDisplayed()).be.True();
  });
});
