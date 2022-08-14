
"use strict";
/* jshint ignore:start */

const config = require("../../config.js");
var testutil = require("../testutil.js");
var should  = require("should");
var nock = require("nock");

var userModule = require("../../model/user.js");
var articleModule = require("../../model/article.js");
var blogModule = require("../../model/blog.js");
const sleep = require("../../test/testutil.js").sleep;

const initialise = require("../../util/initialise.js");

var mockdate = require("mockdate");

const {Builder, Browser, By, Key, until} = require('selenium-webdriver');


const baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();



describe("uc/index", function() {
  this.timeout(12000);
  beforeEach(async function() {
    mockdate.set(new Date("2016-05-25T20:00"));
    
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
     mockdate.reset();
    testutil.stopServer(bddone);
  });

  describe("Known User", function() {
    let driver;
    beforeEach(async function(){
      driver = await testutil.getNewDriver("TheFive");
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
          await driver.get(baseLink + "/notdefined.html");
        } catch (err) {
          should(err.message).eql("Server returned status code 404 from http://localhost:35043/notdefined.html");
        }
        let header = await driver.findElement(By.xpath('//h1'));
        // browser.assert.text("h1", "Page Not Found /notdefined.html");
        should(await header.getText()).eql("Page Not Found /notdefined.html");

        // browser.assert.text("h1", "Page Not Found /notdefined.html");
      });
    });
    describe("LanguageSetter", function() {
      it("should set the language", async function() {
        await driver.get(baseLink + "/osmbc");
        
        await (await driver.findElement(By.id("language"))).click();
        await (await driver.findElement(By.id("lang_EN"))).click();
        await sleep(1000);
        
        await (await driver.findElement(By.id("language"))).click();
        
        await (await driver.findElement(By.id("lang_DE"))).click();
        await sleep(1000);
        let source = await driver.getPageSource();
        testutil.expectHtmlSync(source, "index", "switchedToEnglishAndGerman");
      });
      it("should set the language both equal", async function() {
        await driver.get(baseLink + "/osmbc");
        
        await (await driver.findElement(By.id("language"))).click();
        await (await driver.findElement(By.id("lang_EN"))).click();
        await sleep(1000);
        
        await (await driver.findElement(By.id("language"))).click();
        try {
           await driver.findElement(By.id("lang_EN"));
        } catch (err) {
          should(err.message).eql('no such element: Unable to locate element: {\"method\":\"css selector\",\"selector\":\"*[id=\"lang_EN\"]\"}\n  (Session info: chrome=104.0.5112.79)');
        }
        
        await sleep(1000);
        let source = await driver.getPageSource();
        testutil.expectHtmlSync(source, "index", "switchedToEnglishAndEnglish");
      });
      it("should store a language set", async function() {
        await driver.get(baseLink + "/osmbc");
        await (await driver.findElement(By.id("language"))).click();
        await (await driver.findElement(By.id("lang_EN"))).click();
        await sleep(1000);
        

        // test has to be optimised, as two languages are now longer supported in index 
        await (await driver.findElement(By.id("language2"))).click();
        await (await driver.findElement(By.id("newSetToBeSaved"))).sendKeys("A Name To Save");
        await (await driver.findElement(By.id("saveNewSet"))).click();
        await sleep(300);
       
        let user = await userModule.findOne({OSMUser:"TheFive"});
        should(user.languageSet).eql("A Name To Save");
        should(user.getLanguages()).deepEqual([ 'EN' ]);
        let source = await driver.getPageSource();
        testutil.expectHtmlSync(source, "index", "savedANewLanguageSet");
      });
    });
  });
  describe("Unkown User", function() {
    let driver;
   
    afterEach(async function() {
      await driver.quit();
    });
    it("should throw an error if user not exits", async function() {
      driver = await testutil.getNewDriver("TheFiveNotExist");
      await driver.get(baseLink + "/osmbc");
      await (await driver).findElement(By.xpath('//span[contains(text(),"You are logged in as guest. ")]'));
      let user = await userModule.findOne({OSMUser:"TheFiveNotExist"});
      should(user).eql({
        "OSMUser": "TheFiveNotExist",
        "access": "guest",
        "id": "4",
        "lastAccess": "2016-05-25T18:00:00.000Z",
        "mdWeeklyAuthor": "anonymous",
        "version": 1
        });
    });
    it("should throw an error if user is denied", async function() {
      try {
        driver = await testutil.getNewDriver("OldUserAway");
        
        await driver.get(baselink + "/osmbc");
      } catch (err) {
        // ignore error, expect is a 403 error, but the
        // browser html has to be tested
      }
      let source = await driver.getPageSource();

      testutil.expectHtmlSync(source, "index", "denied user");
      source.should.containEql("OSM User &gt;OldUserAway&lt; has no access rights");
    });
  });
});
/* jshint ignore:end */
