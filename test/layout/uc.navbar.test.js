import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule from "../../model/user.js";
import blogModule from "../../model/blog.js";
import MainPage from "../PageObjectModel/mainPage.js";

const maxTimer = 30000;

// From Bootstrap's lg breakpoint on the menu is a bar across the top.
describe("uc/navbar on large screens", function() {
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
    driver = await testutil.getNewDriver("TheFive");
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should show every entry vertically centred in the bar", async function() {
    const mainPage = new MainPage(driver);
    await mainPage.assertPage();
    should(await mainPage.navbarEntriesOffCenter()).eql([]);
  });

  it("should show the running version at the end of the Help menu", async function() {
    const mainPage = new MainPage(driver);
    await mainPage.assertPage();
    // tests run with the placeholder version T.V.S (routes/layout.js)
    should(await mainPage.getVersionFromHelpMenu()).eql("OSMBC T.V.S");
  });
});
