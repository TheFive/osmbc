import should from "should";
import nock from "nock";
import sinon from "sinon";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import blogModule from "../../model/blog.js";
import articleModule from "../../model/article.js";
import firstDraft from "../../model/firstDraft.js";
import util from "../../util/util.js";
import SearchAndCollectPage from "../PageObjectModel/searchAndCollectPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;
const link = "https://news.example.org/party";
const draft = "Die Bonner Gruppe hat alle Bänke im Stadtpark [kartiert](https://news.example.org/party).";

// First Draft while collecting: the collector knows the page and decides
// right away whether the draft fits. Only for users in
// FirstDraftConfig.visibleFor (config.test.yaml: TestUser).
describe("uc/collect with First Draft", function() {
  this.timeout(maxTimer);
  let driver;
  let create;

  async function articleOfLink() {
    const articles = await articleModule.find({ collection: link });
    should(articles.length).eql(1);
    return articles[0];
  }

  beforeEach(async function() {
    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    // the page is read for the title and for the draft
    nock("https://news.example.org").get("/party").times(2)
      .reply(200, "<html><head><title>Bench party</title></head><body><article><p>The Bonn group mapped all benches in the city park, forty people joined.</p></article></body></html>", { "Content-Type": "text/html" });
    create = sinon.stub().resolves({ stop_reason: "end_turn", content: [{ type: "text", text: draft }] });
    firstDraft.fortestonly.setClient({ beta: { messages: { create: create } } });
    testutil.startServerSync();
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TestUser", access: "full", mainLang: "DE", secondLang: "EN", email: "t@b.c" });
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN", email: "a@b.c" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "open" });
  });
  afterEach(async function() {
    nock.cleanAll();
    firstDraft.fortestonly.setClient(null);
    sinon.restore();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should show a draft for a new link on a phone and save it with the link", async function() {
    driver = await testutil.getNewDriver("TestUser", { device: "phone" });
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    await collectPage.fillAndStartSearch(link);
    should(await collectPage.waitForDraft()).eql(draft);
    should(await collectPage.getDraftPreview()).eql("Die Bonner Gruppe hat alle Bänke im Stadtpark kartiert.");
    should(await collectPage.hasHorizontalScroll()).be.False();
    should(await collectPage.tapTargetsTooSmall("#OK, #OKWithDraft")).eql([]);
    should(await collectPage.tapTargetsTooClose("#OK, #OKWithDraft")).eql([]);

    await collectPage.editDraft("Angepasster Entwurf.");
    await collectPage.clickSaveWithDraft();
    const article = await articleOfLink();
    should(article.markdownDE).eql("Angepasster Entwurf.");
    should(article.title).eql("Bench party");
  });
  it("should save the link only", async function() {
    driver = await testutil.getNewDriver("TestUser");
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    await collectPage.fillAndStartSearch(link);
    await collectPage.waitForDraft();
    await collectPage.clickSaveLinkOnly();
    should((await articleOfLink()).markdownDE).be.undefined();
  });
  it("should make the draft only on request for a link that was found", async function() {
    await articleModule.createNewArticle({ blog: "WN1", title: "Party", collection: link });
    driver = await testutil.getNewDriver("TestUser");
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    await collectPage.fillAndStartSearch(link);
    should(await collectPage.isStartDraftShown()).be.True();
    should(create.called).be.False();
    await collectPage.clickStartDraft();
    should(await collectPage.waitForDraft()).eql(draft);
  });
  it("should not offer a draft to other users", async function() {
    driver = await testutil.getNewDriver("TheFive");
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    await collectPage.fillAndStartSearch(link);
    should(await collectPage.isDraftAreaShown()).be.False();
    should(create.called).be.False();
  });
});
