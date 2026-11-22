import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import db from "../../model/db.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import ArticlePage from "../PageObjectModel/articlePage.js";
import BlogPage from "../PageObjectModel/blogPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;
// no trailing slash: the collection's link regex drops it
const blockedUrl = "https://www.reuters.example/world/news-2026-11-13";
const knownUrl = "https://known.example/page";

// Link check results are stored (table link); the card "Links to check" on
// article and blog page lists the links not known to exist, editors answer
// exists / missing in both directions (issues #1183, #1184).
describe("uc.article link check card", function() {
  this.timeout(maxTimer);
  let driver;
  let articleId;

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    nock("https://www.reuters.example").head("/world/news-2026-11-13").times(99).reply(401, "", { "x-datadome": "protected" });
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

  async function answerUndoAndMissing(page, previewMark) {
    let card = await page.getLinkCard();
    should(card.title).eql("Links to check");
    should(card.check.map(r => r.url)).eql([blockedUrl]);
    should(card.check[0].text).match(/^open\n[\s\S]*link check: can't be checked automatically \(401\)/);
    should(await previewMark()).eql("uncheckable");

    await page.answerLink(blockedUrl, true);
    card = await page.getLinkCard();
    should(card.title).eql("Links: all ok");
    should(card.check).eql([]);
    should(await previewMark()).eql("none");
    const ok = await page.showOkLinks();
    should(ok[0].text).match(/^exists\n[\s\S]*exists, said TheFive/);

    await page.undoLinkAnswer(blockedUrl);
    should((await page.getLinkCard()).check.map(r => r.url)).eql([blockedUrl]);
    await page.answerLink(blockedUrl, false);
    should((await page.getLinkCard()).check[0].text).match(/^missing\n[\s\S]*missing, said TheFive/);
    should(await previewMark()).eql("broken");
  }

  describe("article page", function() {
    it("should answer for a blocked link and undo it on a desktop", async function() {
      driver = await testutil.getNewDriver("TheFive");
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + articleId));
      await answerUndoAndMissing(articlePage, () => articlePage.getPreviewLinkMark("DE", blockedUrl));
    });

    it("should answer for a blocked link and undo it on a phone", async function() {
      driver = await testutil.getNewDriver("TheFive", { device: "phone" });
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + articleId));
      await articlePage.getLinkCard();
      should(await articlePage.tapTargetsTooSmall("#linkCheckCard button")).eql([]);
      should(await articlePage.tapTargetsTooClose("#linkCheckCard button")).eql([]);
      await answerUndoAndMissing(articlePage, () => articlePage.getPreviewLinkMark("DE", blockedUrl));
      should(await articlePage.hasHorizontalScroll()).be.False();
    });

    it("should list a link that is only in the text, not in the collection", async function() {
      const textOnly = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Text only", markdownDE: `Reuters [berichtet](${blockedUrl}) über Karten.` });
      driver = await testutil.getNewDriver("TheFive");
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + textOnly.id));
      const card = await articlePage.getLinkCard();
      should(card.check[0].text).match(/in: berichtet/);
    });

    it("should show a known result without asking and let an editor set an ok link to missing", async function() {
      // stored earlier; there is no nock for known.example, a request would fail
      await new Promise((resolve, reject) => db.query("INSERT INTO link (data) VALUES ($1)",
        [{ url: knownUrl, check: { state: "ok", status: "OK", checkedAt: new Date().toISOString() } }], (err) => err ? reject(err) : resolve()));
      const article = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Known", markdownDE: `Eine [Seite](${knownUrl}).` });
      driver = await testutil.getNewDriver("TheFive");
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + article.id));
      should(await articlePage.getPreviewLinkMark("DE", knownUrl)).eql("none");
      const card = await articlePage.getLinkCard();
      should(card.title).eql("Links: all ok");
      should(await articlePage.getOkLinksToggleText()).eql("Show the link that is ok");
      const ok = await articlePage.showOkLinks();
      should(ok.map(r => r.url)).eql([knownUrl]);
      await articlePage.answerLink(knownUrl, false);
      should(await articlePage.getPreviewLinkMark("DE", knownUrl)).eql("broken");
    });
  });

  describe("blog page", function() {
    // links of the automatically created "Upcoming Events" article
    beforeEach(function() {
      nock("https://wiki.openstreetmap.org").head(/.*/).times(99).reply(200);
      nock("https://thefive.sabic.uberspace.de").head(/.*/).times(99).reply(200);
    });

    it("should take the answer on a desktop", async function() {
      driver = await testutil.getNewDriver("TheFive");
      const blogPage = new BlogPage(driver);
      await driver.get(osmbcLink("/blog/WN1/full"));
      await answerUndoAndMissing(blogPage, async () => (await blogPage.getTextLinkMarks(blockedUrl))[0]);
      should(await blogPage.getTextLinkMarks(blockedUrl)).matchEach("broken");
    });

    it("should take the answer on a phone", async function() {
      driver = await testutil.getNewDriver("TheFive", { device: "phone" });
      const blogPage = new BlogPage(driver);
      await driver.get(osmbcLink("/blog/WN1/full"));
      await blogPage.getLinkCard();
      should(await blogPage.tapTargetsTooSmall("#linkCheckCard button")).eql([]);
      should(await blogPage.tapTargetsTooClose("#linkCheckCard button")).eql([]);
      await answerUndoAndMissing(blogPage, async () => (await blogPage.getTextLinkMarks(blockedUrl))[0]);
      should(await blogPage.hasHorizontalScroll()).be.False();
    });
  });
});
