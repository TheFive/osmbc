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

// The unpublish reason is asked right where the category is set to
// --unpublished-- (issue #1171), on every screen size.
describe("uc.article unpublish reason", function() {
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

  async function unpublish(articlePage) {
    should(await articlePage.isUnpublishReasonShown()).be.False();
    await articlePage.selectCategory("--unpublished--");
    should(await articlePage.isUnpublishReasonShown()).be.True();
    // directly below the category, not somewhere further down the form
    const gap = await articlePage.getUnpublishReasonGapToCategory();
    should(gap).be.within(0, 60);
    await articlePage.selectUnpublishReason("doublette", "see the other article");
  }

  it("should ask for the reason below the category on a desktop", async function() {
    driver = await testutil.getNewDriver("TheFive");
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    await unpublish(articlePage);
    await articlePage.clickSave();
    const article = await articleModule.findById(articleId);
    should(article.categoryEN).eql("--unpublished--");
    should(article.unpublishReason).eql("doublette");
    should(article.unpublishReference).eql("see the other article");
  });

  it("should ask for the reason below the category on a phone", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    await unpublish(articlePage);
    should(await articlePage.hasHorizontalScroll()).be.False();
    await articlePage.clickSaveBar();
    await driver.wait(async () => (await articleModule.findById(articleId)).unpublishReason === "doublette", 5000, "unpublish reason not saved");
    const article = await articleModule.findById(articleId);
    should(article.categoryEN).eql("--unpublished--");
    should(article.unpublishReference).eql("see the other article");
  });
});
