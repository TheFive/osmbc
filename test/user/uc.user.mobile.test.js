import should from "should";
import nock from "nock";

import testutil from "../testutil.js";
import userModule, { avatarTest } from "../../model/user.js";
import util from "../../util/util.js";
import UserPage from "../PageObjectModel/userPage.js";

const osmbcLink = util.osmbcLink;

const maxTimer = 30000;

// User page on a phone: the normal layout (menu panel, compact header), no
// sideways scrolling, a tap-sized Save (X10).
describe("uc/user on small screens", function() {
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
  });
  afterEach(async function() {
    nock.cleanAll();
    await testutil.safeQuit(driver);
    testutil.stopServer();
  });

  it("should fit the phone and save with a tap-sized button", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const userPage = new UserPage(driver);
    await driver.get(osmbcLink("/usert/self"));
    should(await userPage.isMobileMode()).be.True();
    should(await userPage.hasHorizontalScroll()).be.False();
    should(await userPage.tapTargetsTooSmall("#save, .navbar-toggler")).eql([]);
    await userPage.fillMdWeeklyAuthor("Mobile Author");
    await userPage.clickSave();
    await driver.wait(async () => (await userModule.findOne({ OSMUser: "TheFive" })).mdWeeklyAuthor === "Mobile Author", 5000, "not saved");
  });
  it("should show the placeholder for an avatar that does not load", async function() {
    driver = await testutil.getNewDriver("TheFive", { device: "phone" });
    const userPage = new UserPage(driver);
    await driver.get(osmbcLink("/usert/self"));
    // menu and user page
    should(await userPage.getAvatarSources()).eql([avatarTest.placeholder, avatarTest.placeholder]);
    await userPage.setAvatarSources(osmbcLink("/images/no-such-avatar.png"));
    await driver.wait(async () => (await userPage.getAvatarSources()).every(src => src.endsWith(avatarTest.placeholder)), 5000, "placeholder not shown");
  });
});
