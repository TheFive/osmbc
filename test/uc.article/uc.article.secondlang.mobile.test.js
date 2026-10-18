import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import ArticlePage from "../PageObjectModel/articlePage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Small screens: the second language of the desktop pair on demand (X11).
describe("uc.article second language on a phone", function() {
  this.timeout(maxTimer);
  let driver;
  let articlePage;

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c", translationServices: ["copy"] });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    articlePage = new ArticlePage(driver);
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should write in one language and translate to the second in one tap", async function() {
    const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Title" });
    await driver.get(osmbcLink("/article/" + article.id));
    should(await articlePage.isMarkdownShown("EN")).be.False();
    should(await articlePage.isTranslateToSecondLanguageShown()).be.False();

    // the text is not saved yet: the button follows the typing. Typed in two
    // parts with different numbers of key events: a button that toggles
    // on every event instead of following the text fails one of them.
    await articlePage.appendMarkdownInput("DE", "Text");
    should(await articlePage.isTranslateToSecondLanguageShown()).be.True();
    await articlePage.appendMarkdownInput("DE", " DE");
    should(await articlePage.isTranslateToSecondLanguageShown()).be.True();

    await articlePage.clickTranslateToSecondLanguage();
    await articlePage.waitMarkdownInputToBe("EN", "Text DE");
    should(await articlePage.isMarkdownShown("EN")).be.True();
    should(await articlePage.isTranslateToSecondLanguageShown()).be.False();

    // the second language is editable and saved with the first
    await articlePage.appendMarkdownInput("EN", " EN");
    await articlePage.clickSaveBar();
    await driver.wait(async () => (await articleModule.findById(article.id)).markdownEN === "Text DE EN", 3000, "not saved");
    should((await articleModule.findById(article.id)).markdownDE).eql("Text DE");
  });
  it("should show and hide the second language, and remember it", async function() {
    const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Text DE", markdownEN: "Text EN" });
    await driver.get(osmbcLink("/article/" + article.id));
    // both texts exist: nothing to translate
    should(await articlePage.isTranslateToSecondLanguageShown()).be.False();
    should(await articlePage.getToggleSecondLanguageText()).eql("Show EN");
    await articlePage.clickToggleSecondLanguage();
    should(await articlePage.isMarkdownShown("EN")).be.True();
    should(await articlePage.getMarkdownInput("EN")).eql("Text EN");
    should(await articlePage.getToggleSecondLanguageText()).eql("Hide EN");

    await driver.navigate().refresh();
    should(await articlePage.isMarkdownShown("EN")).be.True();
    await articlePage.clickToggleSecondLanguage();
    should(await articlePage.isMarkdownShown("EN")).be.False();
    should(await articlePage.getToggleSecondLanguageText()).eql("Show EN");
  });
});
