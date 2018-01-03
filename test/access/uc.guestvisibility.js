"use strict";

var async = require("async");
var nock = require("nock");
var should  = require("should");
var path = require("path");
var mockdate = require("mockdate");
var testutil = require("../testutil.js");


var userModule = require("../../model/user.js");
var blogModule = require("../../model/blog.js");
var articleModule = require("../../model/article.js");




describe("us/guest visibility", function() {
  this.timeout(20000);
  var browser;
  let article = null;
  let bTheFive = null;
  let bGuestUser = null;
  beforeEach(function(bddone) {
    async.series([
      testutil.clearDB,
      testutil.startServer.bind(null, "TheFive"),
      (cb) => { userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "EN"}, cb); },
      (cb) => { userModule.createNewUser({OSMUser: "GuestUser", access: "guest", language: "EN"}, cb); },
      (cb) => { testutil.getNewBrowser("TheFive", function(err, b) { should.not.exist(err); bTheFive = b; return cb(); }); },
      (cb) => { testutil.getNewBrowser("GuestUser", function(err, b) { should.not.exist(err); bGuestUser = b; return cb(); }); }
    ], function(err) {
      browser = testutil.getBrowser();

      bddone(err);
    });
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


  it("should do a use case", function(bddone) {
    let b = testutil.getBrowser();
    let homePage = "/osmbc";
    let adminLinkSelect = "a#adminlink";

    async.series([

      // Visit Homepage and compare what full user can see
      b.visit.bind(bTheFive, homePage),
      b.assert.expectHtml.bind(bTheFive, "access", "fullStartPage.html"),

      // Click on admin link and compare what full user can see
      b.click.bind(bTheFive, adminLinkSelect),
      b.assert.expectHtml.bind(bTheFive, "access", "fullAdminPage.html"),

      // create a new blog and compare bloglist
      b.click.bind(bTheFive, "a#createblog"),
      b.click.bind(bTheFive, "button.btn.btn-primary[type='button']"),
      b.assert.expectHtml.bind(bTheFive, "access", "fullBlogList.html"),

      // Collect an article, search input before
      b.click.bind(bTheFive, "ul.nav.navbar-nav.pull-left li a"),
      (cb) => { bTheFive.fill("input#searchField", "new Info"); return cb(); },
      b.click.bind(bTheFive, "button[name='SearchNow']"),
      b.assert.expectHtml.bind(bTheFive, "access", "fullCollectPage.html"),

      // Fill out collect screen click OK
      // add some further information on article screen
      // and compare results
      (cb) => {
        // b.fill("select#categoryEN","Mapping /");
        bTheFive.fill("#title", "This is a title of a full collected article");
        bTheFive.fill("textarea[name='collection']", "This is the collection text");
        return cb();
      },



      b.click.bind(bTheFive, "input#OK"),
      (cb) => {
        bTheFive.select("select#categoryEN", "Mapping"),
        bTheFive.fill("#title", "This is a title of a full collected article");
        bTheFive.fill("textarea[name='markdownEN']", "This is the written text.");
        return cb();
      },
      b.click.bind(bTheFive, "button#saveButton"),
      b.assert.expectHtml.bind(bTheFive, "access", "fullArticlePage.html"),




      // Add two comments, one for guest user, and one for @EN
      (cb) => { bTheFive.fill("textarea#comment", "This is a comment for @EN"); return cb(); },
      b.click.bind(bTheFive, "button[name='AddComment']"),


      (cb) => { bTheFive.fill("textarea#comment", "This is a comment for @GuestUser"); return cb(); },
      b.click.bind(bTheFive, "button[name='AddComment']"),



      // Guest user comes and collects an article
      b.visit.bind(bGuestUser, "/osmbc"),
      b.assert.expectHtml.bind(bGuestUser, "access", "guestStartPage.html"),

      // Click on admin link and compare what full user can see
      b.assert.elements.bind(bGuestUser, adminLinkSelect,0),

    /*        // Collect an article, search input before
            b.click.bind(bGuestUser, "ul.nav.navbar-nav.pull-left li a"),
            (cb) => { bGuestUser.fill("input#searchField", "new Info"); return cb(); },
            b.click.bind(bGuestUser, "button[name='SearchNow']"),
            b.assert.expectHtml.bind(bGuestUser, "access", "guestCollectPage.html"),

            // Fill out collect screen click OK
            // add some further information on article screen
            // and compare results
            (cb) => {
              // b.fill("select#categoryEN","Mapping /");
              bGuestUser.fill("#title", "This is a title of a guest collected article");
              bGuestUser.fill("textarea[name='collection']", "This is the collection text (guest collector)");
              return cb();
            },



            b.click.bind(bGuestUser, "input#OK"),
            (cb) => {
              bGuestUser.select("select#categoryEN", "Mapping"),
              bGuestUser.fill("#title", "This is a title of a full collected article");
              bGuestUser.fill("textarea[name='markdownEN']", "This is the written text.");
              return cb();
            },
            b.click.bind(bGuestUser, "button#saveButton"),
            b.assert.expectHtml.bind(bGuestUser, "access", "guestArticlePage.html"),




            // Add two comments, one for guest user, and one for @EN
            (cb) => { bGuestUser.fill("textarea#comment", "This is a comment for @EN"); return cb(); },
            b.click.bind(bGuestUser, "button[name='AddComment']"),


            (cb) => { bGuestUser.fill("textarea#comment", "This is a comment for @TheFive"); return cb(); },
            b.click.bind(bGuestUser, "button[name='AddComment']"),




            b.assert.expectHtml.bind(bGuestUser, "access", "tempresult.html") */
    ], bddone);
  });
});
