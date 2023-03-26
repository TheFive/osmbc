"use strict";

/* jshint ignore:start */


const should   = require("should");
const userModule = require("../../model/user.js");

const testutil = require("../testutil.js");
const { osmbcLink } = require("../../util/util.js");

const { By } = require("selenium-webdriver");




const maxTimer = 50000;


describe("uc/config", function() {
  this.timeout(maxTimer);
  let driver = null;

  beforeEach(async function() {
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full", language: "DE" });
    testutil.startServerSync();
    driver = await testutil.getNewDriver("TheFive");
  });
  afterEach(async function() {
    await driver.quit();
    testutil.stopServer();
  });
  it("should open and not save wrong yaml", async function() {
    await driver.get(osmbcLink("/config/calendartranslation"));
    const textElement = await driver.findElement(By.css("table#resulttable"));
    should(await textElement.getText()).eql("Wo Was Wann Land\nMunich OpenStreetMap Default Meeting 2015-12-15 Germany");
    try {
      await (await driver.findElement(By.id("yaml"))).clear();
      await (await driver.findElement(By.id("yaml"))).sendKeys('"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n  "country":\n  "DE": "LL"');
      await (await driver.findElement(By.css("input[name='OK']"))).click();
    } catch (err) {
      should(err.message).eql("Server returned status code 500 from http://localhost:35043/config/calendartranslation");
    }
    const source = await driver.getPageSource();
    should(source).containEql("YAMLException: duplicated mapping key (8:3)");
  });
  it("should open and save calendartranslation", async function() {
    await driver.get(osmbcLink("/config/calendartranslation"));
    let textElement = await driver.findElement(By.css("table#resulttable"));
    should(await textElement.getText()).eql("Wo Was Wann Land\nMunich OpenStreetMap Default Meeting 2015-12-15 Germany");
    await (await driver.findElement(By.id("yaml"))).clear();
    await (await driver.findElement(By.id("yaml"))).sendKeys('"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n"country":\n  "DE": "LL"');
    await (await driver.findElement(By.css("input[name='OK']"))).click();
    textElement = await driver.findElement(By.css("table#resulttable"));
    should(await textElement.getText()).eql("WW WA WNN LL\nMunich OpenStreetMap Default Meeting 2015-12-15 Germany");
  });
  it("should open and save eventsfilter", async function() {
    await driver.get(osmbcLink("/config/eventsfilter"));
    const textElement = await driver.findElement(By.css("table#resulttable"));
    should(await textElement.getText()).eql("Value DE\ndaysAfterBlogStart 4\nduration 14\nbig_duration 21\nuseGeoNames\nenableCountryFlags\nUSA");
  });
});


/* jshint ignore:end */

