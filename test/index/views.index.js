"use strict";

var async = require("async");
var testutil = require("../testutil.js");
var should  = require("should");
var nock = require("nock");

var userModule = require("../../model/user.js");
var articleModule = require("../../model/article.js");
var blogModule = require("../../model/blog.js");

var mockdate = require("mockdate");






describe("views/index", function() {
  this.timeout(12000);
  var browser;
  beforeEach(async function() {
    mockdate.set(new Date("2016-05-25T20:00"));
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    await testutil.clearDB();
    await userModule.createNewUser({OSMUser: "TheFive", access: "full",language:"DE"});
    await userModule.createNewUser({OSMUser: "OldUser", access: "full",lang:"EN",lastAccess:"2016-02-25T20:00"});
    await userModule.createNewUser({OSMUser: "OldUserAway", access: "denied",lastAccess:"2016-02-25T20:00"});
    testutil.startServerSync();

    browser = await testutil.getNewBrowser("TheFive");
    await articleModule.createNewArticle({blog: "blog", collection: "test", markdownEN: "test"});
    await blogModule.createNewBlog({OSMUser:"test"},{name: "blog", status: "edit"});
  });

  afterEach(function(bddone){
    mockdate.reset();
    testutil.stopServer(bddone);
  });

  describe("Known User", function() {



    describe("Homepage", function() {
      it("should find welcome text on Homepage", async function() {
        await browser.visit("/osmbc");
        browser.assert.text("h2", "Welcome to OSM BCOSM BC");
      });
      it("should have bootstrap.js loaded",async function() {
        this.timeout(6000);
        await browser.visit("/osmbc");
        should(browser.evaluate("(typeof $().modal == 'function'); ")).be.True();
      });
    });
    describe("Admin Homepage", function() {
      it("should show it", async function() {
        await browser.visit("/osmbc/admin");
        browser.assert.expectHtmlSync("index", "admin_home.html")
      });
    });
    describe("Not Defined Page", function() {
      it("should throw an error message", async function() {
        try {
          await browser.visit("/notdefined.html");
        } catch (err) {
          should(err.message).eql("Server returned status code 404 from http://localhost:35043/notdefined.html");
        }
        browser.assert.text("h1", "Not Found");
      });
    });
    describe("LanguageSetter", function() {
      it("should set the language", async function() {
        await browser.visit("/osmbc");
        await browser.click("a#lang_EN");
        // this call is necessary, as zombie looks to make troulbe
        // with 2 calls to a link going back to referrer in seriex
        await browser.visit("/osmbc");
        await browser.click("a#lang2_DE");
        browser.assert.expectHtmlSync("index", "switchedToEnglishAndGerman.html");
      });
      it("should set the language both equal", async function() {
        await browser.visit("/osmbc");
        await browser.click("a#lang_EN");
        // this call is necessary, as zombie looks to make troulbe
        // with 2 calls to a link going back to referrer in seriex
        await browser.visit("/osmbc");
        await browser.click("a#lang2_EN");
        browser.assert.expectHtmlSync("index", "switchedToEnglishAndEnglish.html");
      });
    });
  });
  describe("Unkown User", function() {
    it("should throw an error if user not exits", async function() {

      browser = await testutil.getNewBrowser("TheFiveNotExist");

      await browser.visit("/osmbc");
      browser.html().should.containEql("You are logged in as guest");
    });
    it("should throw an error if user is denied", async function() {
      try {
        browser = await testutil.getNewBrowser("OldUserAway");
        //await browser.visit("/osmbc");
      } catch (err) {
        should.not.exist(err);
      }
      browser.assert.expectHtmlSync("index","wusel.html")
      browser.html().should.containEql("OSM User >OldUserAway< has no access rights");
    });
  });
});
