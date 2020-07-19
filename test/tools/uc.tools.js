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
  it.skip("should open new tool", function(bddone) {
    async.series([
      function setLanguage (cb) {
        browser.visit("/osmbc.html", cb);
      },
      function setLanguage (cb) {
        browser.visit("/language?lang=EN", cb);
      },
      function visitCalendar (cb) {
        browser.visit("/tool/calendarAllLang", cb);
      }
    ], function(err) {
      should.not.exist(err);
      browser.assert.expectHtml.call(browser, "calendarAllMarkdown", bddone);
    });
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
  it("should show calendar", async function() {
    nock("http://127.0.0.1:33333")
      .get("/fakeCalendar")
      .reply(200, {"copyright": "The data is taken from http://wiki.openstreetmap.org/wiki/Template:Calendar and follows its license rules.",

        "events":
          [{"Big": "true", "EventType": "Mapping Party", "country": "everywhere", "description": "PoliMappers' Adventures: One mapping quest each day", "end": "2015-11-22", "start": "2015-11-20", "state": "", "town": "online"},
            {"Big": "", "EventType": "Conference", "country": "Germany", "description": "OpenStreetMap assembly", "end": "2015-11-10", "start": "2015-11-12", "state": "", "town": "Leipzig"}


          ],
        "generator": "osmcalender",
        "time": "Friday, 29. December 2017 04:55PM",
        "version": 8});
    await browser.visit("/osmbc");

    browser.assert.text("li.dropdown#tool ul.dropdown-menu li:nth-child(2) a", "Calendar Tool (fakeCalendar)");
    await browser.click("li.dropdown#tool ul.dropdown-menu li:nth-child(2) a");
    browser.assert.expectHtmlSync("tools", "calendartool");
  });
});

/* jshint ignore:end */
