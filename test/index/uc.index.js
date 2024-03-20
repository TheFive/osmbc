

import testutil from "../testutil.js";
import should from "should";
import nock from "nock";

import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";

import initialiseModules from "../../util/initialise.js";
import MainPage from "../../test/PageObjectModel/mainPage.js";
import AdminPage from "../../test/PageObjectModel/adminPage.js";

import mockdate from "mockdate";

import { By } from "selenium-webdriver";


import util from "../../util/util.js";
const osmbcLink = util.osmbcLink;
const sleep = util.sleep;


describe("uc/index", function() {
  this.timeout(12000);
  beforeEach(async function() {
    mockdate.set(new Date("2016-05-25T20:00"));

    nock("https://missingmattermost.example.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    await testutil.clearDB();
    await initialiseModules();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", language: "DE", email: "a@b.c" });
    await userModule.createNewUser({ OSMUser: "OldUser", access: "full", lang: "EN", email: "d@e.f", lastAccess: "2016-02-25T20:00" });
    await userModule.createNewUser({ OSMUser: "OldUserAway", access: "denied", email: "g@h.i", lastAccess: "2016-02-25T20:00" });
    testutil.startServerSync();

    // browser = await testutil.getNewBrowser("TheFive");
    await articleModule.createNewArticle({ blog: "blog", collection: "test", markdownEN: "test" });
    await blogModule.createNewBlog({ OSMUser: "test" }, { name: "blog", status: "edit" });
  });

  afterEach(function(bddone) {
    mockdate.reset();
    testutil.stopServer(bddone);
  });

  describe("Known User", function() {
    let driver;
    beforeEach(async function() {
      driver = await testutil.getNewDriver("TheFive");
    });
    afterEach(async function() {
      if (this.currentTest.state !== "failed") await driver.quit();
    });
    describe("Homepage", function() {
      it("should find welcome text on Homepage", async function() {
        const mainPage = new MainPage(driver);
        await mainPage.assertPage();
        should(await mainPage.getFirstHeader()).eql("Welcome to OSM BC");
      });
    });
    describe("Admin Homepage", function() {
      it("should show it", async function() {
        nock("https://api.deepl.com",
          {
            headers: {
              accept: "application/json, text/plain, */*",
              authorization: "DeepL-Auth-Key APIKEY",
              "user-agent": "axios/1.6.2",
              "accept-encoding": "gzip, compress, deflate, br"
            }
          })
          .get("/v2/usage")
          .reply(200, { character_count: 10, character_limit: 100 });

        const mainPage = new MainPage(driver);
        await mainPage.assertPage();
        await mainPage.clickLinkToAdminPage();

        const adminPage = new AdminPage(driver);
        await adminPage.assertPage();
        should(await adminPage.getFirstHeader()).eql("Configuration");

        await testutil.expectHtml(driver, "index", "admin_home");
      });
    });
    describe("Not Defined Page", function() {
      it("should throw an error message", async function() {
        try {
          await driver.get(osmbcLink("/notdefined.html"));
        } catch (err) {
          should(err.message).eql("Server returned status code 404 from http://localhost:35043/notdefined.html");
        }
        const header = await driver.findElement(By.xpath("//h1"));
        // browser.assert.text("h1", "Page Not Found /notdefined.html");
        should(await header.getText()).eql("Page Not Found /notdefined.html");

        // browser.assert.text("h1", "Page Not Found /notdefined.html");
      });
    });
    describe("LanguageSetter", function() {
      it("should set the language", async function() {
        await driver.get(osmbcLink("/osmbc"));

        await (await driver.findElement(By.id("language"))).click();
        await (await driver.findElement(By.id("lang_EN"))).click();
        await sleep(1000);

        await (await driver.findElement(By.id("language"))).click();

        await (await driver.findElement(By.id("lang_DE"))).click();
        await sleep(1000);

        await testutil.expectHtml(driver, "index", "switchedToEnglishAndGerman");
      });
      it("should set the language both equal", async function() {
        await driver.get(osmbcLink("/osmbc"));

        await (await driver.findElement(By.id("language"))).click();
        await (await driver.findElement(By.id("lang_EN"))).click();
        await sleep(1000);

        await (await driver.findElement(By.id("language"))).click();
        try {
          await driver.findElement(By.id("lang_EN"));
        } catch (err) {
          should(err.message).containEql('no such element: Unable to locate element: {\"method\":\"css selector\",\"selector\":\"*[id=\"lang_EN\"]\"}');
        }

        await sleep(1000);

        await testutil.expectHtml(driver, "index", "switchedToEnglishAndEnglish");
      });
      it("should store a language set", async function() {
        await driver.get(osmbcLink("/osmbc"));
        await (await driver.findElement(By.id("language"))).click();
        await (await driver.findElement(By.id("lang_EN"))).click();
        await sleep(1000);


        // test has to be optimised, as two languages are now longer supported in index
        await (await driver.findElement(By.id("language2"))).click();
        await (await driver.findElement(By.id("newSetToBeSaved"))).sendKeys("A Name To Save");
        await (await driver.findElement(By.id("saveNewSet"))).click();
        await sleep(300);

        const user = await userModule.findOne({ OSMUser: "TheFive" });
        should(user.languageSet).eql("A Name To Save");
        should(user.getLanguages()).deepEqual(["EN"]);

        await testutil.expectHtml(driver, "index", "savedANewLanguageSet");
      });
    });
  });
  describe("Unkown User", function() {
    let driver;

    afterEach(async function() {
      if (this.currentTest.state !== "failed") await driver.quit();
    });
    it("should throw an error if user not exits", async function() {
      driver = await testutil.getNewDriver("TheFiveNotExist");
      await driver.get(osmbcLink("/osmbc"));
      await (await driver).findElement(By.xpath('//span[contains(text(),"You are logged in as guest. ")]'));
      const user = await userModule.findOne({ OSMUser: "TheFiveNotExist" });
      should(user).eql({
        OSMUser: "TheFiveNotExist",
        access: "guest",
        id: "4",
        lastAccess: "2016-05-25T18:00:00.000Z",
        mdWeeklyAuthor: "anonymous",
        version: 1
      });
    });
    it("should throw an error if user is denied", async function() {
      driver = null;
      try {
        driver = await testutil.getNewDriver("OldUserAway");

        await driver.get(osmbcLink("/osmbc"));
      } catch (err) {
        // ignore error, expect is a 403 error, but the
        // browser html has to be tested
      }



      // await errorPage.assertPage();
      // should(await errorPage.getErrorText()).eql("OSM User &gt;OldUserAway&lt; has no access rights");
      await testutil.expectHtml(driver, "index", "denied user");
    });
  });
});
