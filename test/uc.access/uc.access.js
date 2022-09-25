"use strict";

/* jshint ignore:start */

const mockdate   = require("mockdate");
const testutil   = require("../testutil.js");
const OsmbcApp   = require("../../test/PageObjectModel/osmbcApp.js");
const { sleep }  = require("../../util/util.js");
const should     = require("should");




var userModule = require("../../model/user.js");
const initialise = require("../../util/initialise.js");




describe("uc.access", function() {
  this.timeout(30000);
  let driverTheFive = null;
  let driverGuest = null;
  beforeEach(async function() {
    await testutil.clearDB();
    await initialise.initialiseModules();
    testutil.startServerSync();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", language: "EN", email: "a@g.c" });
    await userModule.createNewUser({ OSMUser: "GuestUser", access: "guest", language: "EN", email: "guest@guest.guest" });
    driverTheFive = await testutil.getNewDriver("TheFive");
  });
  before(function(bddone) {
    mockdate.set("2015-11-05");
    return bddone();
  });
  after(function(bddone) {
    mockdate.reset();
    return bddone();
  });
  afterEach(async function() {
    if (this.currentTest.state !== "failed") {
      await driverTheFive.quit();
      if (driverGuest) await driverGuest.quit();
    }
    driverGuest = null;
    driverTheFive = null;
    testutil.stopServer();
  });


  it("should do a use case short", async function() {
    const errors = [];

    const osmbcAppTheFive = new OsmbcApp(driverTheFive);

    await testutil.expectHtml(driverTheFive, errors, "uc.access", "fullStartPage");

    // Click on admin link and compare what full user can see
    await osmbcAppTheFive.getMainPage().clickLinkToAdminPage();

    testutil.expectHtml(driverTheFive, errors, "uc.access", "fullAdminPage");


    // create a new blog and compare bloglist
    await osmbcAppTheFive.getAdminPage().clickCreateBlogMenu({ confirm: true });
    testutil.expectHtml(driverTheFive, errors, "uc.access", "fullBlogList");

    // Collect an article, search input before
    await osmbcAppTheFive.getBlogListPage().clickCollect();

    const sacPageTheFive = osmbcAppTheFive.getSearchAndCollectPage();
    await sacPageTheFive.fillAndStartSearch("new Info");


    await testutil.expectHtml(driverTheFive, errors, "uc.access", "fullCollectPage");

    await sacPageTheFive.fillTitleInput("This is a title of a full collected article");
    await sacPageTheFive.fillCollectionInput("This is the collection text");
    await sacPageTheFive.clickOK();

    const articlePageTheFive = osmbcAppTheFive.getArticlePage();

    await articlePageTheFive.fillTitleInput("This is a title of a full collected article");
    await articlePageTheFive.selectCategory("Mapping");
    await articlePageTheFive.fillMarkdownInput("EN", "This is the written text.");


    await articlePageTheFive.clickSave();
    await testutil.expectHtml(driverTheFive, errors, "uc.access", "fullArticlePage");

    await articlePageTheFive.fillCommentInput("This is a comment for @EN");
    await articlePageTheFive.clickAddComment();

    await sleep(500);


    await articlePageTheFive.fillCommentInput("This is a comment for @GuestUser");
    await articlePageTheFive.clickAddComment();



    // Guest user comes and collects an article
    driverGuest = await testutil.getNewDriver("GuestUser");
    const osmbcAppGuest = new OsmbcApp(driverGuest);
    await sleep(1000);

    await testutil.expectHtml(driverGuest, errors, "uc.access", "guestStartPage");

    // Click on admin link and compare what full user can see
    should(await osmbcAppGuest.getMainPage().hasLinkToAdminPage()).be.false();

    // Collect an article, search input before
    await osmbcAppGuest.getMainPage().clickCollect();

    const sacPageGuest = osmbcAppGuest.getSearchAndCollectPage();
    await sacPageGuest.fillAndStartSearch("new Info");


    await testutil.expectHtml(driverGuest, errors, "uc.access", "guestCollectPage");

    await sacPageGuest.fillTitleInput("This is a title of a guest collected article");
    await sacPageGuest.fillCollectionInput("This is the collection text (guest collector)");
    await sacPageGuest.clickOK();


    const articlePageGuest = osmbcAppGuest.getArticlePage();

    await articlePageGuest.fillTitleInput("This is a title of a guest collected article");
    await articlePageGuest.selectCategory("Mapping");
    await articlePageGuest.fillMarkdownInput("EN", "This is the written text.");
    await articlePageGuest.clickSave();



    await articlePageGuest.fillCommentInput("This is a comment for @EN");
    await articlePageGuest.clickAddComment();

    await sleep(500);

    await articlePageGuest.fillCommentInput("This is a comment for @TheFive");
    await articlePageGuest.clickAddComment();

    await sleep(500);

    await testutil.expectHtml(driverGuest, errors, "uc.access", "guestArticlePage");

    // Check The Five Inbox

    await articlePageTheFive.clickInboxMenu();
    await testutil.expectHtml(driverTheFive, errors, "uc.access", "fullUserInbox");

    // Check Guest Users Inbox
    await articlePageGuest.clickInboxMenu();


    testutil.expectHtml(driverGuest, errors, "uc.access", "guestUserInbox");

    await osmbcAppGuest.getInboxPage().clickFirstArticleShown();

    testutil.expectHtml(driverGuest, errors, "uc.access", "guestArticle-id3-Page");
    should(errors).eql([]);
  });
  it.("should create a new guest user, if he logs in", async function() {
    const errors = [];

    let browser = await testutil.getNewBrowser();
    // visiting /osmbc with unkown user shoud show login page

    await  browser.visit("/osmbc");
    browser.assert.expectHtmlSync(errors, "uc.access", "loginPage");
    testutil.fakeNextPassportLogin("UnkownGuest");
    await  browser.click("#login");
    browser.assert.expectHtmlSync(errors, "uc.access", "UnkownGuestStartPage");

    // Collect an article, search input before
    await browser.click("#collect");
    browser.fill("input#searchField", "new Info");
    await browser.click("button[name='SearchNow']");

    // Fill out collect screen click OK
    // add some further information on article screen
    // and compare results
    // bGuestUser.fill("select#categoryEN","Mapping /");
    browser.fill("#title", "This is a title of a guest collected article");
    browser.fill("textarea[name='collection']", "This is the collection text (guest collector)");
    await browser.click("input#OK");


    // check with TheFive user, wether guest is registered
    await bTheFive.visit("/osmbc");
    bTheFive.assert.expectHtmlSync(errors, "uc.access","Home Page with Unknowm Guest");
    should(errors).eql([]);
  });
});
/* jshint ignore:end */