"use strict";

/* jshint ignore:start */

const mockdate   = require("mockdate");
const testutil   = require("../testutil.js");
const OsmbcApp   = require("../../test/PageObjectModel/osmbcApp.js");
const { sleep }  = require("../../util/util.js");
const should     = require("should");




const userModule = require("../../model/user.js");
const initialise = require("../../util/initialise.js");




describe("uc.access", function() {
  this.timeout(30000);
  beforeEach(async function() {
    await testutil.clearDB();
    await initialise.initialiseModules();
    testutil.startServerSync();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", language: "EN", email: "a@g.c" });
    await userModule.createNewUser({ OSMUser: "GuestUser", access: "guest", language: "EN", email: "guest@guest.guest" });
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
    testutil.stopServer();
  });


  it("should do a use case short", async function() {
    const driverTheFive = await testutil.getNewDriver("TheFive");
    const errors = [];

    const osmbcAppTheFive = new OsmbcApp(driverTheFive);

    await testutil.expectHtml(driverTheFive, errors, "uc.access", "fullStartPage");

    // Click on admin link and compare what full user can see
    await osmbcAppTheFive.getMainPage().clickLinkToAdminPage();

    await testutil.expectHtml(driverTheFive, errors, "uc.access", "fullAdminPage");


    // create a new blog and compare bloglist
    await osmbcAppTheFive.getAdminPage().clickCreateBlogMenu({ confirm: true });
    await testutil.expectHtml(driverTheFive, errors, "uc.access", "fullBlogList");

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
    const driverGuest = await testutil.getNewDriver("GuestUser");
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
    await sleep(300);


    await testutil.expectHtml(driverGuest, errors, "uc.access", "guestUserInbox");

    await osmbcAppGuest.getInboxPage().clickFirstArticleShown();

    await testutil.expectHtml(driverGuest, errors, "uc.access", "guestArticle-id3-Page");
    should(errors).eql([]);
    await driverTheFive.quit();
    await driverGuest.quit();
  });
  it("should create a new guest user, if he logs in", async function() {
    // use TestUserNewGuest (allowed in test_pwd, not created as user)
    const driver = await testutil.getNewDriver("TestUserNewGuest");
    const osmbcApp = new OsmbcApp(driver);
    await osmbcApp.getMainPage().clickUserIcon();
    should(await osmbcApp.getUserPage().getUserName()).eql("TestUserNewGuest");
    await driver.quit();
  });
});
/* jshint ignore:end */
