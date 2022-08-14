"use strict";

/* jshint ignore:start */

const config = require("../../config.js");
var testutil = require("../testutil.js");
var should  = require("should");
var nock = require("nock");

var userModule = require("../../model/user.js");
var articleModule = require("../../model/article.js");
var blogModule = require("../../model/blog.js");

const initialise = require("../../util/initialise.js");

var mockdate = require("mockdate");

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');


const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();



describe("uc/index", function() {
  this.timeout(12000);
  var browser;
  beforeEach(async function() {
   // mockdate.set(new Date("2016-05-25T20:00"));
    
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    await testutil.clearDB();
    await initialise.initialiseModules();
    await userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "DE", email: "a@b.c"});
    await userModule.createNewUser({OSMUser: "OldUser", access: "full", lang: "EN", email: "d@e.f", lastAccess: "2016-02-25T20:00"});
    await userModule.createNewUser({OSMUser: "OldUserAway", access: "denied", email: "g@h.i", lastAccess: "2016-02-25T20:00"});
    testutil.startServerSync();

   // browser = await testutil.getNewBrowser("TheFive");
    await articleModule.createNewArticle({blog: "blog", collection: "test", markdownEN: "test"});
    await blogModule.createNewBlog({OSMUser: "test"}, {name: "blog", status: "edit"});
  });

  afterEach(function(bddone) {
   // mockdate.reset();
    testutil.stopServer(bddone);
  });

  describe("Known User", function() {
    let driver;
    beforeEach(async function(){
      driver = await new Builder().forBrowser(Browser.CHROME).build();
      await driver.manage().setTimeouts( { implicit: 5000 } );
      try {
        await driver.get(baseLink + "/osmbc");
        
        const button = await driver.findElement(By.id('htaccesLoginButton'));
        await button.click();
        
        await driver.findElement(By.id("username")).sendKeys("TheFive");
        await driver.findElement(By.id("password")).sendKeys("TheFive");
        await driver.findElement(By.id("submitbutton")).click();
      } finally {};
    });
    afterEach(async function() {
      await driver.quit();
    });
    describe("Homepage", function() {

      it("should find welcome text on Homepage", async function() {

        const div = await driver.findElement(By.xpath('//h2[contains(text(), "Welcome to OSM BC")]'));
        should.exist(div);
      });
    });
    describe("Admin Homepage", function() {
      it("should show it", async function() {
        await driver.get(baseLink + "/osmbc/admin");
        await driver.findElement(By.xpath('//h1[contains(text(), "Configuration")]'));
        
        const source = await driver.getPageSource();
        testutil.expectHtmlSync(source, "index", "admin_home");
      });
    });
    describe("Not Defined Page", function() {
      it("should throw an error message", async function() {
        try {
          await browser.visit("/notdefined.html");
        } catch (err) {
          should(err.message).eql("Server returned status code 404 from http://localhost:35043/notdefined.html");
        }
        browser.assert.text("h1", "Page Not Found /notdefined.html");
      });
    });
    describe("LanguageSetter", function() {
      it("should set the language", async function() {
        await browser.visit("/osmbc");
        await browser.click("a#lang_EN");
        // this call is necessary, as zombie looks to make troulbe
        // with 2 calls to a link going back to referrer in seriex
        await browser.visit("/osmbc");
        await browser.click("a#lang_DE");
        browser.assert.expectHtmlSync("index", "switchedToEnglishAndGerman");
      });
      it("should set the language both equal", async function() {
        await browser.visit("/osmbc");
        await browser.click("a#lang_EN");
        // this call is necessary, as zombie looks to make troulbe
        // with 2 calls to a link going back to referrer in seriex

        // test has to be optimised, as two languages are now longer supported in index 
        await browser.visit("/osmbc");
        await browser.assert.elements("a#lang_EN",0);
        browser.assert.expectHtmlSync("index", "switchedToEnglishAndEnglish");
      });
      it("should store a language set", async function() {
        await browser.visit("/osmbc");
        await browser.click("a#lang_EN");
        // this call is necessary, as zombie looks to make troulbe
        // with 2 calls to a link going back to referrer in seriex

        // test has to be optimised, as two languages are now longer supported in index 
        await browser.visit("/osmbc");
        await browser.click("a#lang_DE");
        browser.fill("#newSetToBeSaved","A Name To Save");
        await browser.click("#saveNewSet");
        let user = await userModule.findOne({OSMUser:"TheFive"});
        should(user.languageSet).eql("A Name To Save");
        should(user.getLanguages()).deepEqual([ 'DE' ]);
        browser.assert.expectHtmlSync("index", "savedANewLanguageSet");
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
        await browser.visit("/osmbc");
      } catch (err) {
        // ignore error, expect is a 403 error, but the
        // browser html has to be tested
      }
      browser.assert.expectHtmlSync("index", "denied user");
      browser.html().should.containEql("OSM User &gt;OldUserAway&lt; has no access rights");
    });
  });
});
/* jshint ignore:end */
