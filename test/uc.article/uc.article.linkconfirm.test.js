import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import linkCheck from "../../util/linkCheck.js";
import util from "../../util/util.js";
import ArticlePage from "../PageObjectModel/articlePage.js";
import BlogPage from "../PageObjectModel/blogPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;
// no trailing slash: the collection's link regex drops it
const blockedUrl = "https://www.reuters.example/world/news-2026-11-13";

// A link behind bot protection is not shown as broken; an editor answers
// whether it exists, in the article's link area or in the list on the blog
// page (issue #1183).
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
      markdownDE: `Reuters [berichtet](${blockedUrl}) über Karten.`,
      markdownEN: `Reuters [reports](${blockedUrl}) on maps.`
    });
    articleId = article.id;
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  describe("article page", function() {
    async function answerAndUndo(articlePage) {
      const rows = await articlePage.getUncheckableLinks();
      should(rows.length).eql(1);
      should(rows[0].text).match(/can't be checked automatically \(401\)/);
      should(await articlePage.getPreviewLinkMark("DE", blockedUrl)).eql("uncheckable");

      await articlePage.answerUncheckableLink(blockedUrl, true);
      should((await articlePage.getUncheckableLinks())[0].text).match(/✓ exists, said TheFive/);
      should(await articlePage.getPreviewLinkMark("DE", blockedUrl)).eql("none");

      await articlePage.undoUncheckableLink(blockedUrl);
      should(await articlePage.getPreviewLinkMark("DE", blockedUrl)).eql("uncheckable");

      await articlePage.answerUncheckableLink(blockedUrl, false);
      should((await articlePage.getUncheckableLinks())[0].text).match(/✗ missing, said TheFive/);
      should(await articlePage.getPreviewLinkMark("DE", blockedUrl)).eql("broken");
    }

    it("should answer for a blocked link and undo it on a desktop", async function() {
      driver = await testutil.getNewDriver("TheFive");
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + articleId));
      await answerAndUndo(articlePage);
    });

    it("should answer for a blocked link and undo it on a phone", async function() {
      driver = await testutil.getNewDriver("TheFive", { device: "phone" });
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + articleId));
      should(await articlePage.getUncheckableLinks()).have.length(1);
      should(await articlePage.tapTargetsTooSmall("#uncheckableLinks button")).eql([]);
      await answerAndUndo(articlePage);
      should(await articlePage.hasHorizontalScroll()).be.False();
    });

    it("should list a link that is only in the text, not in the collection", async function() {
      const textOnly = await articleModule.createNewArticle({
        blog: "WN1",
        categoryEN: "Mapping",
        title: "Text only",
        markdownDE: `Reuters [berichtet](${blockedUrl}) über Karten.`
      });
      driver = await testutil.getNewDriver("TheFive");
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + textOnly.id));
      const rows = await articlePage.getUncheckableLinks();
      should(rows.length).eql(1);
      should(rows[0].text).match(/in: berichtet/);
      await articlePage.answerUncheckableLink(blockedUrl, true);
      should(await articlePage.getPreviewLinkMark("DE", blockedUrl)).eql("none");
    });
  });

  describe("blog page", function() {
    async function answerInList(blogPage) {
      let rows = await blogPage.getUncheckableLinks();
      should(rows.length).eql(1);
      should(rows[0].url).eql(blockedUrl);
      should(rows[0].text).match(/can't be checked automatically \(401\)/);
      should(rows[0].text).match(/berichtet/);
      should(await blogPage.getTextLinkMarks(blockedUrl)).matchEach("uncheckable");

      await blogPage.answerUncheckableLink(blockedUrl, false);
      rows = await blogPage.getUncheckableLinks();
      should(rows[0].text).match(/✗ missing, said TheFive/);
      should(await blogPage.getTextLinkMarks(blockedUrl)).matchEach("broken");

      await blogPage.undoUncheckableLink(blockedUrl);
      await blogPage.answerUncheckableLink(blockedUrl, true);
      should(await blogPage.getTextLinkMarks(blockedUrl)).matchEach("none");
    }

    it("should list the blocked link and take the answer on a desktop", async function() {
      driver = await testutil.getNewDriver("TheFive");
      const blogPage = new BlogPage(driver);
      await driver.get(osmbcLink("/blog/WN1/full"));
      await answerInList(blogPage);
    });

    it("should list the blocked link and take the answer on a phone", async function() {
      driver = await testutil.getNewDriver("TheFive", { device: "phone" });
      const blogPage = new BlogPage(driver);
      await driver.get(osmbcLink("/blog/WN1/full"));
      should(await blogPage.getUncheckableLinks()).have.length(1);
      should(await blogPage.tapTargetsTooSmall("#uncheckableLinks button")).eql([]);
      should(await blogPage.tapTargetsTooClose("#uncheckableLinks button")).eql([]);
      await answerInList(blogPage);
      should(await blogPage.hasHorizontalScroll()).be.False();
    });
  });
});
