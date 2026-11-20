import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import blogModule from "../../model/blog.js";
import articleModule from "../../model/article.js";
import util from "../../util/util.js";
import SearchAndCollectPage from "../PageObjectModel/searchAndCollectPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Collect on a phone: search field and button in one row, OK and Cancel
// tap-sized and apart (X10).
describe("uc/collect on small screens", function() {
  this.timeout(maxTimer);
  let driver;

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
  });
  // desktop pair stays DE/EN, the phone works in this language
  async function setMobileLang(lang) {
    const user = await userModule.findOne({ OSMUser: "TheFive" });
    await new Promise((resolve, reject) => user.setAndSave({ OSMUser: "test" }, { mobileLang: lang }, (err) => err ? reject(err) : resolve()));
  }
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should search and show OK and Cancel as tap targets", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    should(await collectPage.isSearchButtonBesideField()).be.True();
    await collectPage.fillAndStartSearch("https://example.com/news");
    should(await collectPage.hasHorizontalScroll()).be.False();
    should(await collectPage.tapTargetsTooSmall("#searchField, #searchButton, #OK, #OK + a.btn")).eql([]);
    should(await collectPage.tapTargetsTooClose("#OK, #OK + a.btn")).eql([]);
  });
  it("should enable OK for a title from the phone keyboard without key events", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    await collectPage.fillAndStartSearch("https://example.com/news");
    await collectPage.clearTitle();
    should(await collectPage.isOKEnabled()).be.False();
    await collectPage.appendTitleWithPhoneKeyboard("A suggested title");
    should(await collectPage.isOKEnabled()).be.True();
  });
  // the phone language is kept apart from the desktop pair: collect shows
  // categories and found texts in it, not in the desktop pair (#1176)
  it("should show categories and found texts in the phone language", async function() {
    await setMobileLang("EN");
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Picture", title: "Old", collection: "https://example.com/news", markdownDE: "Text DE", markdownEN: "Text EN" });
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    await collectPage.fillAndStartSearch("https://example.com/news");
    should(await collectPage.getCategoryOptionTexts()).containEql("Picture");
    should(await collectPage.getCategoryOptionTexts()).not.containEql("Bild / Picture");
    should(await collectPage.getFoundArticleTexts()).eql(["Text EN"]);
  });
  it("should show categories and found texts in the desktop pair on a desktop", async function() {
    await setMobileLang("EN");
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Picture", title: "Old", collection: "https://example.com/news", markdownDE: "Text DE", markdownEN: "Text EN" });
    driver = await testutil.getNewDriver("TheFive");
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    await collectPage.fillAndStartSearch("https://example.com/news");
    should(await collectPage.getCategoryOptionTexts()).containEql("Bild / Picture");
    should(await collectPage.getFoundArticleTexts()).eql(["Text DE", "Text EN"]);
  });
});
