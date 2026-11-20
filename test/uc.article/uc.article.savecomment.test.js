import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import ArticlePage from "../PageObjectModel/articlePage.js";
import ErrorPage from "../PageObjectModel/errorPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Save stores the comment field together with the article (#914): a failed
// save keeps no comment, so going back and saving again cannot store it
// twice. A missing unpublish reason is reported at the field, before any
// request is sent.
describe("uc.article save with a comment", function() {
  this.timeout(maxTimer);
  let driver;
  let articleId;

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

  async function commentTexts() {
    const article = await articleModule.findById(articleId);
    return (article.commentList || []).map((c) => c.text);
  }

  it("should ask for the unpublish reason before saving the comment on a desktop", async function() {
    driver = await testutil.getNewDriver("TheFive");
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    await articlePage.selectCategory("--unpublished--");
    await articlePage.fillCommentInput("duplicate of the other one");
    await articlePage.clickSaveStaysOnPage();
    should(await articlePage.isUnpublishReasonMarkedMissing()).be.True();
    should(await commentTexts()).eql([]);

    await articlePage.selectUnpublishReason("doublette", "");
    should(await articlePage.isUnpublishReasonMarkedMissing()).be.False();
    await articlePage.clickSave();
    should(await commentTexts()).eql([
      "duplicate of the other one",
      "#solved because set to --unpublished--.\n\nReason: doublette"
    ]);
  });

  it("should ask for the unpublish reason before saving the comment on a phone", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    await articlePage.selectCategory("--unpublished--");
    await articlePage.fillCommentInput("duplicate of the other one");
    await articlePage.clickSaveBar();
    should(await articlePage.isUnpublishReasonMarkedMissing()).be.True();
    should(await articlePage.hasHorizontalScroll()).be.False();
    should(await commentTexts()).eql([]);

    await articlePage.selectUnpublishReason("doublette", "");
    await articlePage.clickSaveBar();
    await driver.wait(async () => (await commentTexts()).length === 2, 5000, "comments not saved");
    should((await commentTexts())[0]).eql("duplicate of the other one");
  });

  it("should keep no comment when the save fails and the editor goes back", async function() {
    driver = await testutil.getNewDriver("TheFive");
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));

    // someone else changes the title meanwhile, so this save conflicts
    const other = await articleModule.findById(articleId);
    await new Promise((resolve, reject) => other.setAndSave({ OSMUser: "other" }, { title: "Other title", version: other.version }, (err) => err ? reject(err) : resolve()));

    await articlePage.fillTitleInput("My title");
    await articlePage.fillCommentInput("my comment");
    await articlePage.clickSave();
    const errorPage = new ErrorPage(driver);
    should(await errorPage.getErrorTitle()).eql("Field title already changed in DB");
    should(await commentTexts()).eql([]);

    await errorPage.clickGoBack();
    // the text is not lost, the editor can save it again
    should(await articlePage.getCommentInput()).eql("my comment");
    should(await commentTexts()).eql([]);
  });
});
