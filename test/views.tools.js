"use strict";

var async = require("async");
var testutil = require("./testutil.js");
var nock = require("nock");
var should  = require("should");
var path = require("path");
var mockdate = require("mockdate");


var userModule = require("../model/user.js");
var blogModule = require("../model/blog.js");







describe("views/tools", function() {
  this.timeout(20000);
  var browser;
  beforeEach(function(bddone) {
    async.series([
      testutil.clearDB,
      (cb) => { userModule.createNewUser({OSMUser: "TheFive", access: "full",language:"EN"}, cb); },
      (cb) => { blogModule.createNewBlog(
        {OSMUser: "TheFive", access: "full"},
        {status:"edit"},
        cb); },
      testutil.startServer.bind(null, "TheFive")
    ], function(err) {
      browser = testutil.getBrowser();
      bddone(err);
    });
  });
  before(function(bddone) {
    var fileName = path.join(__dirname, "/data/calendarData.wiki");
    mockdate.set("2015-11-05");

    nock("https://wiki.openstreetmap.org")
     .get("/w/api.php?action=query&titles=Template:Calendar&prop=revisions&rvprop=content&format=json")
     .times(3)
     .replyWithFile(200, fileName);
    return bddone();
  });
  after(function(bddone) {
    mockdate.reset();
    return bddone();
  });
  afterEach(function(bddone) {
    testutil.stopServer(bddone);
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
      browser.assert.expectHtml.call(browser, "calendarAllMarkdown.html", bddone);
    });
  });
  it("should use picture tool", function(bddone) {
    var fileName = path.join(__dirname, "/data/picture.jpg");
    nock("https://blog.openstreetmap.org")
      .get("/picture.jpg")
      .times(2)
      .replyWithFile(200, fileName);

    async.series([
      function visitCalendar (cb) {
        browser.visit("/tool/picturetool", cb);
      },
      function fillValues(cb) {
        browser
          .select("pictureLanguage", "EN")
          .fill("pictureAText", "AltText")
          .fill("pictureURL", "https://blog.openstreetmap.org/picture.jpg")
          .fill("pictureMarkup", "test")
          .select("pictureLicense", "CC3")
          .fill("pictureAuthor", "test")
          .pressButton("OK", cb);
      }
    ], function(err) {
      should.not.exist(err);
      should(browser.evaluate("document.getElementById('markdown').value")).eql("![AltText](https://blog.openstreetmap.org/picture.jpg =800x800)\ntest | Picture by test under [CC-BY-SA 3.0](https://creativecommons.org/licenses/by/3.0/)");
      bddone();
    });
  });
  it("should show calendar",function(bddone){
    nock( "http://localhost:33333")
      .get("/fakeCalendar")
      .reply(200,{"copyright": "The data is taken from http://wiki.openstreetmap.org/wiki/Template:Calendar and follows its license rules.",

        "events":
          [{"Big": "true", "EventType": "Mapping Party", "country": "everywhere", "description": "PoliMappers' Adventures: One mapping quest each day", "end": "2015-11-22", "start": "2015-11-20", "state": "", "town": "online"},
            {"Big": "", "EventType": "Conference", "country": "Germany", "description": "OpenStreetMap assembly", "end": "2015-11-10", "start": "2015-11-12", "state": "", "town": "Leipzig"}


          ], "generator": "osmcalender", "time": "Friday, 29. December 2017 04:55PM", "version": 8});
    async.series([
      browser.visit.bind(browser, "/osmbc"),
      (cb) => {browser.assert.text("li.dropdown#tool ul.dropdown-menu li:nth-child(2) a","Calendar Tool (fakeCalendar)");return cb();},
      browser.click.bind(browser,"li.dropdown#tool ul.dropdown-menu li:nth-child(2) a"),
      browser.assert.expectHtml.bind(browser, "calendartool.html")
    ], bddone);
  });
});
