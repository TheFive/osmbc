



import should from "should";
import userModule from "../../model/user.js";
import configModule from "../../model/config.js";

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
    await testutil.safeQuit(driver);
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
    should(source).containEql("YAMLException: duplicated mapping key (8:4)");
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

  it("should render calendarflags preview images for https, wp-content and legacy wp-uploads paths", async function() {
    const cf = await configModule.getConfigObject("calendarflags");
    await cf.setAndSave({ OSMUser: "TheFive" }, {
      version: cf.version,
      yaml: cf.yaml + "\ntest_https: https://example.org/xx.svg\ntest_content: /wp-content/uploads/2024/01/xx.svg\ntest_uploads: /wp-uploads/2016/01/xx.svg\n"
    });
    await driver.get(osmbcLink("/config/calendarflags"));
    const images = await driver.findElements(By.css("img.img-thumbnail"));
    const srcs = await Promise.all(images.map((img) => img.getAttribute("src")));
    should(srcs).containEql("https://example.org/xx.svg");
    should(srcs).containEql("https://weeklyosm.eu/wp-content/uploads/2024/01/xx.svg");
    should(srcs).containEql("https://weeklyosm.eu/wp-content/uploads/2016/01/xx.svg");
  });

  it("should render calendarflags preview without crashing on a null flag value", async function() {
    const cf = await configModule.getConfigObject("calendarflags");
    await cf.setAndSave({ OSMUser: "TheFive" }, {
      version: cf.version,
      yaml: cf.yaml + "\ntest_null:\n"
    });
    await driver.get(osmbcLink("/config/calendarflags"));
    const source = await driver.getPageSource();
    should(source).not.containEql("Cannot read properties of null");
    should(source).containEql("Flag Preview");
    const keys = await Promise.all((await driver.findElements(By.css(".col-sm-2 span"))).map((s) => s.getText()));
    should(keys).containEql("test_null");
  });

  it("should render slacknotification preview without crashing on a null channel or null entry", async function() {
    const cf = await configModule.getConfigObject("slacknotification");
    await cf.setAndSave({ OSMUser: "TheFive" }, {
      version: cf.version,
      yaml: cf.yaml + "\n- slack: osmde\n  channel:\n\n- \n"
    });
    await driver.get(osmbcLink("/config/slacknotification"));
    const source = await driver.getPageSource();
    should(source).not.containEql("Cannot read properties of null");
    should(source).containEql("(invalid entry)");
  });

  it("should render the site header without crashing on a null helpmenu entry", async function() {
    const cf = await configModule.getConfigObject("helpmenu");
    await cf.setAndSave({ OSMUser: "TheFive" }, {
      version: cf.version,
      yaml: cf.yaml + "\n- \n"
    });
    await driver.get(osmbcLink("/osmbc.html"));
    const source = await driver.getPageSource();
    should(source).not.containEql("Cannot read properties of null");
    should(await driver.findElement(By.id("helpDropdown"))).ok();
  });
});



