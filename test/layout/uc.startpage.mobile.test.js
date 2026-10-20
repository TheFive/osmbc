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

// Start page on a phone: the blogs to work on as a list for the mobile
// language, tap-sized (X10).
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
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "WN1", status: "edit" });
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "One", markdownDE: "Text" });
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Two" });
    await articleModule.createNewArticle({ blog: "WN1", categoryEN: "Mapping", title: "Three" });
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should list the blogs with the numbers of the mobile language", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const mainPage = new MainPage(driver);
    await driver.get(osmbcLink("/"));
    // the numbers are the ones of the desktop table (a new blog brings its
    // own placeholder articles), here only their labels matter
    const entries = await mainPage.getBlogStatusEntries();
    should(entries.length).eql(1);
    should(entries[0]).match(/^WN1\nDE\n\d+ open\n1 written$/);
    should(await mainPage.hasHorizontalScroll()).be.False();
    should(await mainPage.tapTargetsTooSmall(".osmbc-blog-status-list a")).eql([]);
    // admin is desktop only
    should(await mainPage.hasLinkToAdminPage()).be.False();
    await mainPage.clickOpenArticlesOf("WN1");
    await driver.wait(async () => (await driver.getCurrentUrl()).endsWith("/article/list?blog=WN1&unwrittenLang=DE"), 5000, "list not opened");
  });
  it("should keep the table on a desktop", async function() {
    driver = await testutil.getNewDriver("TheFive");
    const mainPage = new MainPage(driver);
    await driver.get(osmbcLink("/"));
    should(await mainPage.getBlogStatusEntries()).eql([]);
    should(await mainPage.hasLinkToAdminPage()).be.True();
  });
});
