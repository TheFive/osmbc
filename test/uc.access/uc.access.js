"use strict";

/* jshint ignore:start */

const mockdate = require("mockdate");
const testutil = require("../testutil.js");


var userModule = require("../../model/user.js");
const initialise = require("../../util/initialise.js");




describe("uc.access", function() {
  this.timeout(30000);
  let bTheFive = null;
  let bGuestUser = null;
  beforeEach(async function() {
    await testutil.clearDB();
    await initialise.initialiseModules();
    testutil.startServerSync("TheFive");
    await userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "EN",email:"a@g.c"});
    await userModule.createNewUser({OSMUser: "GuestUser", access: "guest", language: "EN"});
    bTheFive = await testutil.getNewBrowser("TheFive");
    bGuestUser = await testutil.getNewBrowser("GuestUser");
  });
  before(function(bddone) {
    mockdate.set("2015-11-05");
    return bddone();
  });
  after(function(bddone) {
    mockdate.reset();
    return bddone();
  });
  afterEach(function(bddone) {
    testutil.stopServer(bddone);
  });


  it("should do a use case short async/await version", async function() {
    let errors = [];
    let b = testutil.getBrowser();
    let homePage = "/osmbc";
    let adminLinkSelect = "a#adminlink";
    await bTheFive.visit(homePage);
    bTheFive.assert.expectHtmlSync(errors, "uc.access", "fullStartPage");

    // Click on admin link and compare what full user can see
    await bTheFive.click(adminLinkSelect);
    bTheFive.assert.expectHtmlSync(errors, "uc.access", "fullAdminPage");


    // create a new blog and compare bloglist
    await bTheFive.click("a#createblog");
    await bTheFive.click("button.btn.btn-primary[type='button']");
    bTheFive.assert.expectHtmlSync(errors, "uc.access", "fullBlogList");

    // Collect an article, search input before
    await bTheFive.click("ul.nav.navbar-nav.pull-left li a");
    bTheFive.fill("input#searchField", "new Info");
    await bTheFive.click("button[name='SearchNow']");
    bTheFive.assert.expectHtmlSync(errors, "uc.access", "fullCollectPage");

    // Fill out collect screen click OK
    // add some further information on article screen
    // and compare results

    // b.fill("select#categoryEN","Mapping /");
    bTheFive.fill("#title", "This is a title of a full collected article");
    bTheFive.fill("textarea[name='collection']", "This is the collection text");

    await bTheFive.click("input#OK");
    bTheFive.select("select#categoryEN", "Mapping");
    bTheFive.fill("#title", "This is a title of a full collected article");
    bTheFive.fill("textarea[name='markdownEN']", "This is the written text.");

    await bTheFive.click("button#saveButton");
    bTheFive.assert.expectHtmlSync(errors, "uc.access", "fullArticlePage");




    // Add two comments, one for guest user, and one for @EN
    await bTheFive.fill("textarea#comment", "This is a comment for @EN");
    await bTheFive.click("button[name='AddComment']");


    bTheFive.fill("textarea#comment", "This is a comment for @GuestUser");
    await bTheFive.click("button[name='AddComment']"),



    // Guest user comes and collects an article
    await bGuestUser.visit("/osmbc");
    bGuestUser.assert.expectHtmlSync(errors, "uc.access", "guestStartPage");

    // Click on admin link and compare what full user can see
    await bGuestUser.assert.elements(adminLinkSelect, 0);

    // Collect an article, search input before
    await bGuestUser.click("ul.nav.navbar-nav.pull-left li a");
    bGuestUser.fill("input#searchField", "new Info");
    await bGuestUser.click("button[name='SearchNow']");
    bGuestUser.assert.expectHtmlSync(errors, "uc.access", "guestCollectPage");

    // Fill out collect screen click OK
    // add some further information on article screen
    // and compare results
    // bGuestUser.fill("select#categoryEN","Mapping /");
    bGuestUser.fill("#title", "This is a title of a guest collected article");
    bGuestUser.fill("textarea[name='collection']", "This is the collection text (guest collector)");
    await bGuestUser.click("input#OK");
    bGuestUser.select("select#categoryEN", "Mapping");
    bGuestUser.fill("#title", "This is a title of a guest collected article");
    bGuestUser.fill("textarea[name='markdownEN']", "This is the written text.");
    await bGuestUser.click("button#saveButton");
    // Add two comments, one for guest user, and one for @EN
    bGuestUser.fill("textarea#comment", "This is a comment for @EN");
    await bGuestUser.click("button[name='AddComment']");
    bGuestUser.fill("textarea#comment", "This is a comment for @TheFive");
    await bGuestUser.click("button[name='AddComment']");
    bGuestUser.assert.expectHtmlSync(errors, "uc.access", "guestArticlePage");

    // --------------------------------

    await bTheFive.click("a#inbox");
    bTheFive.assert.expectHtmlSync(errors, "uc.access","fullUserInbox");
    await bGuestUser.click("a#inbox");
    bGuestUser.assert.expectHtmlSync(errors, "uc.access","guestUserInbox");
    await bGuestUser.visit("/article/3");
    bGuestUser.assert.expectHtmlSync(errors, "uc.access","guestArticle-id3-Page");
    should(errors).eql([]);
  });
  it("should create a new guest user, if he logs in",async function(){
    let errors=[];
    let browser = await testutil.getNewBrowser();
    // visiting /osmbc with unkown user shoud show login page

    await  browser.visit("/osmbc");
    browser.assert.expectHtmlSync(errors, "uc.access", "loginPage");
    testutil.fakeNextPassportLogin("UnkownGuest");
    await  browser.click("#login");
    browser.assert.expectHtmlSync(errors, "uc.access", "UnkownGuestStartPage");

    // Collect an article, search input before
    await browser.click("ul.nav.navbar-nav.pull-left li a");
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