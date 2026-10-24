import should from "should";
import nock from "nock";
import { By } from "selenium-webdriver";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import ArticlePage from "../PageObjectModel/articlePage.js";
import firstDraft from "../../model/firstDraft.js";
import sinon from "sinon";

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
    should(await new ArticlePage(driver).hasHorizontalScroll()).be.False();
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
  it("should keep long collection links within a phone screen, with tap-sized buttons (X10)", async function() {
    const longLink = "https://example.com/a/rather/long/path/to/some/news/article-about-mapping?id=12345";
    // a second article with the same link: the link is marked as doublette
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Other", collection: longLink });
    const linked = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Text DE", collection: longLink + "\nhttps://example.com/news" });
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + linked.id));
    should(await articlePage.isMobileMode()).be.True();
    // the link check appends its result to the links: the widest state
    await articlePage.waitForBackgroundRequests();
    should((await articlePage.getValueFromLinkArea(longLink)).warning).be.True();
    should(await articlePage.hasHorizontalScroll()).be.False();
    should(await articlePage.tapTargetsTooSmall("#linkArea button, .navbar-toggler, .osmbc-text-link")).eql([]);
    // the flags are desktop only
    should(await articlePage.isLanguageFlagsShown()).be.False();
    // the other link actions are in a menu (translated pages may carry a link check result)
    const entries = await articlePage.openLinkMenu();
    should(entries.slice(0, 2)).eql(["Readable text", "Page content"]);
    should(entries.slice(2).map(e => e.split(" #")[0])).eql(["Translated page (DE)", "Translated page (EN)"]);
  });
  it("should keep the vote buttons apart and vote by tapping (X10)", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    should(await articlePage.tapTargetsTooSmall("#voteButtons button")).eql([]);
    should(await articlePage.tapTargetsTooClose("#voteButtons button, #predecessorId")).eql([]);
    await articlePage.clickTopVote(0);
    await driver.wait(async () => {
      const votes = (await articleModule.findById(articleId)).votes;
      return votes && Object.values(votes).some(users => users.includes("TheFive"));
    }, 5000, "vote not stored");
    // redrawn: still apart
    should(await articlePage.tapTargetsTooClose("#voteButtons button")).eql([]);
  });
  it("should keep the comment actions tap-sized and apart (X10)", async function() {
    const now = new Date().toISOString();
    // the first comment is read (commentRead 0), the second is not
    const commented = await articleModule.createNewArticle({
      blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Text DE",
      commentList: [{ user: "TheFive", text: "first", timestamp: now }, { user: "Other", text: "second", timestamp: now }],
      commentRead: { TheFive: 0 }
    });
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + commented.id));
    should(await articlePage.countUnreadComments()).eql(1);
    const actions = "#commentArea button";
    should(await articlePage.tapTargetsTooSmall(actions)).eql([]);
    should(await articlePage.tapTargetsTooClose(actions)).eql([]);

    await articlePage.clickMarkFirstUnreadCommentRead();
    should(await articlePage.countUnreadComments()).eql(0);
    await articlePage.tapAddComment("third");
    should((await articleModule.findById(commented.id)).commentList.map(c => c.text)).eql(["first", "second", "third"]);
  });
  it("should grow the comment fields with their text", async function() {
    const lines = Array(12).fill("Eine Zeile Kommentar").join("\n");
    const commented = await articleModule.createNewArticle({
      blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Text DE",
      commentList: [{ user: "TheFive", text: lines, timestamp: new Date().toISOString() }]
    });
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + commented.id));
    await articlePage.typeCommentText(lines);
    should(await articlePage.isTextFullyShown("comment")).be.True();
    // the edit form comes with the redrawn comment area
    await articlePage.openEditComment(0);
    should(await articlePage.isTextFullyShown("editComment")).be.True();
  });
  it("should hide the hint texts on a phone (X12)", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + articleId));
    should(await articlePage.getShownHelpTexts()).eql([]);
  });
  describe("First Draft", function() {
    let draftArticle;
    beforeEach(async function() {
      // only users in FirstDraftConfig.visibleFor (config.test.yaml) see it
      await userModule.createNewUser({ OSMUser: "TestUser", access: "full", mainLang: "DE", secondLang: "EN", email: "t@b.c" });
      draftArticle = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Party", collection: "https://news.example.org/party" });
      firstDraft.fortestonly.setClient({ beta: { messages: { create: sinon.stub().resolves({ stop_reason: "end_turn", content: [{ type: "text", text: "Die Bonner Gruppe hat Bänke kartiert." }] }) } } });
      nock("https://news.example.org").get("/party")
        .reply(200, "<html><body><article><p>The Bonn group mapped all benches in the city park, forty people joined.</p></article></body></html>", { "Content-Type": "text/html" });
    });
    afterEach(function() {
      firstDraft.fortestonly.setClient(null);
      sinon.restore();
    });
    it("should offer First Draft at the empty text field on a phone", async function() {
      driver = await testutil.getNewDriver("TestUser", { device: "phone" });
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + draftArticle.id));
      should(await articlePage.isFirstDraftMenuShown()).be.False();
      should(await articlePage.getFirstDraftButtons()).eql(["DE https://news.example.org/party"]);
      should(await articlePage.tapTargetsTooSmall("button.firstDraftItem")).eql([]);
      should(await articlePage.hasHorizontalScroll()).be.False();
      await articlePage.tapFirstDraft("DE");
      should(await articlePage.getMarkdown("DE")).eql("Die Bonner Gruppe hat Bänke kartiert.");
    });
    it("should keep the First Draft menu on a desktop", async function() {
      driver = await testutil.getNewDriver("TestUser");
      const articlePage = new ArticlePage(driver);
      await driver.get(osmbcLink("/article/" + draftArticle.id));
      should(await articlePage.isFirstDraftMenuShown()).be.True();
      should(await articlePage.getFirstDraftButtons()).eql([]);
    });
  });
  it("should not show the insert buttons on a desktop", async function() {
    const linked = await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Title", markdownDE: "Text DE", collection: "https://example.com/news" });
    driver = await testutil.getNewDriver("TheFive");
    const articlePage = new ArticlePage(driver);
    await driver.get(osmbcLink("/article/" + linked.id));
    should(await articlePage.isMobileMode()).be.False();
    should(await articlePage.isInsertLinkShown()).be.False();
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
