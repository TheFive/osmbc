"use strict";

/* jshint ignore:start */

var nock = require("nock");
var should  = require("should");
var path = require("path");
var mockdate = require("mockdate");
var testutil = require("../testutil.js");


var userModule = require("../../model/user.js");
var blogModule = require("../../model/blog.js");
var articleModule = require("../../model/article.js");




describe("uc/guest visibility", function() {
  this.timeout(20000);
  let article = null;
  let bTheFive = null;
  let bGuestUser = null;
  var nockLogin;
  beforeEach(async function() {
    await testutil.clearDB();
    testutil.startServerSync("TheFive");
    let theFive = await userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "EN"});
    let guestUser = await userModule.createNewUser({OSMUser: "GuestUser", access: "guest", language: "EN"});
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
    nock.cleanAll();
    testutil.stopServer(bddone);
  });


  it("should do a use case short async/await version", async function() {
    let b = testutil.getBrowser();
    let homePage = "/osmbc";
    let adminLinkSelect = "a#adminlink";
    await bTheFive.visit(homePage);
    bTheFive.assert.expectHtmlSync("access", "fullStartPage.html");

    // Click on admin link and compare what full user can see
    await bTheFive.click(adminLinkSelect);
    bTheFive.assert.expectHtmlSync("access", "fullAdminPage.html");


    // create a new blog and compare bloglist
    await bTheFive.click("a#createblog");
    await bTheFive.click("button.btn.btn-primary[type='button']");
    bTheFive.assert.expectHtmlSync("access", "fullBlogList.html");

    // Collect an article, search input before
    await bTheFive.click("ul.nav.navbar-nav.pull-left li a");
    bTheFive.fill("input#searchField", "new Info");
    await bTheFive.click("button[name='SearchNow']");
    bTheFive.assert.expectHtmlSync("access", "fullCollectPage.html");

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
    bTheFive.assert.expectHtmlSync("access", "fullArticlePage.html");




    // Add two comments, one for guest user, and one for @EN
    await bTheFive.fill("textarea#comment", "This is a comment for @EN");
    await bTheFive.click("button[name='AddComment']");


    bTheFive.fill("textarea#comment", "This is a comment for @GuestUser");
    await bTheFive.click("button[name='AddComment']"),



    // Guest user comes and collects an article
    await bGuestUser.visit("/osmbc");
    bGuestUser.assert.expectHtmlSync("access", "guestStartPage.html");

    // Click on admin link and compare what full user can see
    await bGuestUser.assert.elements(adminLinkSelect, 0);

    // Collect an article, search input before
    await bGuestUser.click("ul.nav.navbar-nav.pull-left li a");
    bGuestUser.fill("input#searchField", "new Info");
    await bGuestUser.click("button[name='SearchNow']");
    bGuestUser.assert.expectHtmlSync("access", "guestCollectPage.html");

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
    bGuestUser.assert.expectHtmlSync("access", "guestArticlePage.html");
    // Add two comments, one for guest user, and one for @EN
    bGuestUser.fill("textarea#comment", "This is a comment for @EN");
    await bGuestUser.click("button[name='AddComment']");
    bGuestUser.fill("textarea#comment", "This is a comment for @TheFive");
    await bGuestUser.click("button[name='AddComment']");

    // --------------------------------

    await bTheFive.click("a#inbox");
    bTheFive.assert.expectHtmlSync("access","fullUserInbox.html");
    await bGuestUser.click("a#inbox");
    bGuestUser.assert.expectHtmlSync("access","guestUserInbox.html");
    await bGuestUser.visit("/article/3");
    bGuestUser.assert.expectHtmlSync("access","guestArticle-id3-Page.html");


    // bGuestUser.assert.expectHtmlSync("access", "tempresult.html");
  });
  it("should create a new guest user, if he logs in",async function(){
    let browser = await  testutil.getNewBrowser();
    // visiting /osmbc with unkown user shoud show login page
    await  browser.visit("/osmbc");
    browser.assert.expectHtmlSync("access", "loginPage.html");
    testutil.fakeNextPassportLogin("UnkownGuest");
    await  browser.click("#login");
    browser.assert.expectHtmlSync("access", "UnkownGuestStartPage.html");

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
    bTheFive.assert.expectHtmlSync("access","Home Page with Unknowm Guest.html");
  });
});
/* jshint ignore:end */