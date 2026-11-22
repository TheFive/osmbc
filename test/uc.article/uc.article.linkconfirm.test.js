import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import linkCheck from "../../util/linkCheck.js";
import util from "../../util/util.js";
import ArticlePage from "../PageObjectModel/articlePage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;
const blockedUrl = "https://www.reuters.example/world/news-2026-11-13";

// A link behind bot protection is not shown as broken; an editor confirms
// it in the link area, then it looks like a normal link (issue #1183).
describe("uc.article link confirmation", function() {
  this.timeout(maxTimer);
  let driver;
  let articleId;

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    nock("https://www.reuters.example").head("/world/news-2026-11-13").times(99).reply(401, "", { "x-datadome": "protected" });
    linkCheck.cacheFlushAll();
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
    const article = await articleModule.createNewArticle({
      blog: "WN1",
      categoryEN: "Mapping",
      title: "Title",
      collection: blockedUrl,
      markdownDE: `Reuters [berichtet](${blockedUrl}) über Karten.`
    });
    articleId = article.id;
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  async function confirmAndUndo(articlePage) {
    should(await articlePage.getLinkCheckNote(blockedUrl)).match(/can't be checked automatically \(401\)/);
    should(await articlePage.getPreviewLinkMark("DE", blockedUrl)).eql("uncheckable");

    await articlePage.confirmLink(blockedUrl);
    should(await articlePage.getLinkCheckNote(blockedUrl)).match(/✓ confirmed by TheFive/);
    should(await articlePage.getPreviewLinkMark("DE", blockedUrl)).eql("none");

    await articlePage.undoLinkConfirmation(blockedUrl);
    should(await articlePage.getLinkCheckNote(blockedUrl)).match(/can't be checked automatically/);
    should(await articlePage.getPreviewLinkMark("DE", blockedUrl)).eql("uncheckable");
  }

  it("should confirm a blocked link and undo it on a desktop", async function() {
    driver = await testutil.getNewDriver("TheFive");
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    await confirmAndUndo(articlePage);
  });

  it("should confirm a blocked link and undo it on a phone", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    await confirmAndUndo(articlePage);
    should(await articlePage.hasHorizontalScroll()).be.False();
    should(await articlePage.tapTargetsTooSmall("#linkArea .osmbc-linkconfirm button")).eql([]);
  });
});
