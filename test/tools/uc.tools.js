"use strict";

/* jshint ignore:start */

const async = require("async");
const testutil = require("../testutil.js");
const nock = require("nock");
const should  = require("should");
const path = require("path");
const mockdate = require("mockdate");


const userModule = require("../../model/user.js");
const blogModule = require("../../model/blog.js");







describe("views/tools", function() {
  this.timeout(70000);
  var browser;
  beforeEach(async function() {
    await testutil.clearDB();
    await userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "EN",email:"a@b.c"});
    await blogModule.createNewBlog({OSMUser: "TheFive", access: "full"}, {status: "edit"});
    testutil.startServerSync();
    browser = await testutil.getNewBrowser("TheFive");
  });
  before(async function() {
    let fileName = path.join(__dirname, "calendarData.wiki");
    mockdate.set("2015-11-05");
    nock("https://wiki.openstreetmap.org")
      .get("/w/api.php?action=query&titles=Template:Calendar&prop=revisions&rvprop=content&format=json")
      .times(3)
      .replyWithFile(200, fileName);
  });
  after(async function() {
    mockdate.reset();
  });
  afterEach(async function() {
    testutil.stopServer();
  });
  it("should use picture tool", async function() {
    let fileName = path.join(__dirname, "picture.jpg");
    nock("https://blog.openstreetmap.org")
      .get("/picture.jpg")
      .times(5)
      .replyWithFile(200, fileName);
    await browser.visit("/tool/picturetool");
    await browser.select("pictureLanguage", "EN");
    await browser.fill("pictureAText", "AltText")
      .fill("pictureURL", "https://blog.openstreetmap.org/picture.jpg")
      .fill("pictureMarkup", "test")
      .fill("pictureAuthor", "test")
    await browser.select("pictureLicense", "CC3");


    await browser.pressButton("OK");
    should(browser.evaluate("document.getElementById('markdown').value")).eql("![AltText](https://blog.openstreetmap.org/picture.jpg =800x800)\ntest | Picture by test under [CC-BY-SA 3.0](https://creativecommons.org/licenses/by/3.0/)");

  });
});

/* jshint ignore:end */
