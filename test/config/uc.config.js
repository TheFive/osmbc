



import should from "should";
import userModule from "../../model/user.js";

import testutil from "../testutil.js";
import util from "../../util/util.js";

import { By, until } from "selenium-webdriver";

const osmbcLink = util.osmbcLink;




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
    should(await textElement.getText()).eql("Wo Was Wann Land\nMunich OpenStreetMap Default Meeting online 2015-12-15 Germany");
    try {
      await (await driver.findElement(By.id("yaml"))).clear();
      await (await driver.findElement(By.id("yaml"))).sendKeys('"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n  "country":\n  "DE": "LL"');
      const inputOK = await driver.findElement(By.css("input[name='OK']"));
      await (inputOK).click();
      await driver.wait(until.stalenessOf(inputOK));
    } catch (err) {
      should(err.message).eql("Server returned status code 500 from http://localhost:35043/config/calendartranslation");
    }
    const source = await driver.getPageSource();
    should(source).containEql("YAMLException: duplicated mapping key (8:3)");
  });
  it("should open and save calendartranslation", async function() {
    await driver.get(osmbcLink("/config/calendartranslation"));
    let textElement = await driver.findElement(By.css("table#resulttable"));
    should(await textElement.getText()).eql("Wo Was Wann Land\nMunich OpenStreetMap Default Meeting online 2015-12-15 Germany");
    await (await driver.findElement(By.id("yaml"))).clear();
    await (await driver.findElement(By.id("yaml"))).sendKeys('"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n"country":\n  "DE": "LL"');
    const inputOK = await driver.findElement(By.css("input[name='OK']"));
    await (inputOK).click();
    await (driver.wait(until.stalenessOf(inputOK)));
    textElement = await driver.findElement(By.css("table#resulttable"));
    should(await textElement.getText()).eql("WW WA WNN LL\nMunich OpenStreetMap Default Meeting online 2015-12-15 Germany");
  });
  it("should open and save eventsfilter", async function() {
    await driver.get(osmbcLink("/config/eventsfilter"));
    const textElement = await driver.findElement(By.css("table#resulttable"));
    should(await textElement.getText()).eql("Value DE\ndaysAfterBlogStart 4\nduration 14\nbig_duration 21\nenableCountryFlags\nUSA");
  });
});



