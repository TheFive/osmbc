import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import blogModule from "../../model/blog.js";
import util from "../../util/util.js";
import SearchAndCollectPage from "../PageObjectModel/searchAndCollectPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// Collect on a phone: search field and button in one row, OK and Cancel
// tap-sized and apart (X10).
describe("uc/collect on small screens", function() {
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
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should search and show OK and Cancel as tap targets", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const collectPage = new SearchAndCollectPage(driver);
    await driver.get(osmbcLink("/article/create"));
    should(await collectPage.isSearchButtonBesideField()).be.True();
    await collectPage.fillAndStartSearch("https://example.com/news");
    should(await collectPage.hasHorizontalScroll()).be.False();
    should(await collectPage.tapTargetsTooSmall("#searchField, #searchButton, #OK, #OK + a.btn")).eql([]);
    should(await collectPage.tapTargetsTooClose("#OK, #OK + a.btn")).eql([]);
  });
});
