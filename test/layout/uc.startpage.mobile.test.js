import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import MainPage from "../PageObjectModel/mainPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Start page on a phone: the status table of the blogs to work on with
// tap-sized links (X10).
describe("uc/start page on small screens", function() {
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
    // as in production: about three blogs to work on
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN2", status: "edit" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN3", status: "open" });
    // a text in EN: a second language in the status table
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "One", markdownDE: "Text", markdownEN: "Text" });
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Two" });
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should show the status table with tap-sized links", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const mainPage = new MainPage(driver);
    await driver.get(osmbcLink("/"));
    should(await mainPage.hasHorizontalScroll()).be.False();
    // blog names and the numbers of the mobile language (DE) are tap targets:
    // 44px high, narrower (32px) so a cell's numbers stay together; the other
    // languages stay compact for reading
    should(await mainPage.tapTargetsTooSmall(".blog-status-header a, .osmbc-mobile-lang-row a", { width: 32 })).eql([]);
    const heights = await mainPage.getStatusRowHeights();
    should(heights.DE).be.aboveOrEqual(44);
    should(heights.EN).be.below(32);
    // admin is desktop only
    should(await mainPage.hasLinkToAdminPage()).be.False();
    // the legend opens on demand
    should(await mainPage.isBadgeLegendShown()).be.False();
    await mainPage.clickBadgeLegend();
    should(await mainPage.isBadgeLegendShown()).be.True();
    await mainPage.clickUnwrittenArticles("WN1", "DE");
    await driver.wait(async () => (await driver.getCurrentUrl()).endsWith("/article/list?blog=WN1&unwrittenLang=DE"), 5000, "list not opened");
  });
  it("should show the admin link on a desktop", async function() {
    driver = await testutil.getNewDriver("TheFive");
    const mainPage = new MainPage(driver);
    await driver.get(osmbcLink("/"));
    should(await mainPage.hasLinkToAdminPage()).be.True();
    should(await mainPage.isBadgeLegendShown()).be.True();
  });
});
