"use strict";

const testutil = require("../testutil.js");
const should   = require("should");
const nock = require("nock");
const userModule = require("../../model/user.js");




const maxTimer = 50000;


describe("uc/config", function() {
  this.timeout(maxTimer);
  let browser;
  let nockLoginPage;
  beforeEach(async function() {
    nockLoginPage = testutil.nockLoginPage();
    await testutil.clearDB();
    await userModule.createNewUser({OSMUser: "TheFive", access: "full", "language": "DE"});
    testutil.startServerSync();
    browser = await testutil.getNewBrowser("TheFive");
  });
  afterEach(async function() {
    nock.removeInterceptor(nockLoginPage);
    testutil.stopServer();
  });
  it("should open and not save wrong yaml", async function() {
    await browser.visit("/config/calendartranslation");
    await browser.wait(10);
    browser.assert.text("table#resulttable", "Wo Was Wann Land Munich OpenStreetMap Default Meeting 2015-12-15 Germany");
    try {
      await browser
        .fill("yaml", '"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n  "country":\n  "DE": "LL"')
        .pressButton("OK");
    } catch (err) {
      should(err.message).eql("Server returned status code 500 from http://localhost:35043/config/calendartranslation");
    }
    should(browser.html()).containEql("YAMLException: duplicated mapping key at line 8, column 3:");
  });
  it("should open and save calendartranslation", async function() {
    await browser.visit("/config/calendartranslation");
    browser.assert.text("table#resulttable", "Wo Was Wann Land Munich OpenStreetMap Default Meeting 2015-12-15 Germany");
    await browser
      .fill("yaml", '"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n"country":\n  "DE": "LL"')
      .pressButton("OK");
    browser.assert.text("table#resulttable", "WW WA WNN LL Munich OpenStreetMap Default Meeting 2015-12-15 Germany");
  });
});
