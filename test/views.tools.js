"use strict";

var async = require("async");
var testutil = require("./testutil.js");
var nock = require("nock");
var should  = require("should");
var path = require("path");
var mockdate = require("mockdate");
var moment = require("moment");


var userModule = require("../model/user.js");






describe("views/tools", function() {
  var browser;
  beforeEach(function(bddone) {
    async.series([
      testutil.clearDB,
      function createUser(cb) { userModule.createNewUser({OSMUser: "TheFive", access: "full"}, cb); },
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



  it("should open calendar tool", function(bddone) {
    this.timeout(20000);


    async.series([
      function setLanguage (cb) {
        browser.visit("/osmbc.html", cb);
      },
      function setLanguage (cb) {
        browser.visit("/language?lang=EN", cb);
      },
      function visitCalendar (cb) {
        browser.visit("/tool/calendar2markdown", cb);
      },
      function fillValues(cb) {
        let date = moment("2016-03-10").diff(moment("2015-11-05"), "days");
        browser
          .fill("date", date)
          .fill("duration", "24")
          .pressButton("OK", cb);
      },
      function clickDisabled(cb) {
        browser.evaluate('document.getElementById("disable").checked=false');
        cb();
      }
    ], function(err) {
      should.not.exist(err);
      should(browser.evaluate('document.getElementById("disable").checked')).be.False();

      // first test the result
      should(browser.evaluate("document.getElementById('markdown').value")).eql("|Where   |What                                                                                |When      |Country|\n|--------|------------------------------------------------------------------------------------|----------|-------|\n|Lüneburg|[Mappertreffen Lüneburg](https://wiki.openstreetmap.org/wiki/Lüneburg/Mappertreffen)|03/15/2016|Germany|\n|Bremen  |[Bremer Mappertreffen](https://wiki.openstreetmap.org/wiki/Bremen/Veranstaltungen)  |03/28/2016|Germany|\n");

      // now change the Markdown and check the result again, (spaces should be added)
      browser.fill("markdown", "|Where   |What                                                                                      |When      |Country|\n|--------|------------------------------------------------------------------------------------------|----------|-------|\n|        |[Berlin-Brandenburg Stammtisch](https://wiki.openstreetmap.org/wiki/Berlin/Stammtisch)|03/10/2016|Germany|\n|Lüneburg|[Mappertreffen Lüneburg](https://wiki.openstreetmap.org/wiki/Lüneburg/Mappertreffen)      |03/15/2016|Germany|\n|        |[Stammtisch Karlsruhe](https://wiki.openstreetmap.org/wiki/Karlsruhe#Nächstes%20Treffen)  |03/16/2016|Germany|\n|Bremen  |[Bremer Mappertreffen](https://wiki.openstreetmap.org/wiki/Bremen/Veranstaltungen)        |03/28/2016|Germany|\n");
      browser.wait(100, function() {
        should(browser.evaluate("document.getElementById('markdown').value")).eql("|Where   |What                                                                                    |When      |Country|\n|--------|----------------------------------------------------------------------------------------|----------|-------|\n|        |[Berlin-Brandenburg Stammtisch](https://wiki.openstreetmap.org/wiki/Berlin/Stammtisch)  |03/10/2016|Germany|\n|Lüneburg|[Mappertreffen Lüneburg](https://wiki.openstreetmap.org/wiki/Lüneburg/Mappertreffen)    |03/15/2016|Germany|\n|        |[Stammtisch Karlsruhe](https://wiki.openstreetmap.org/wiki/Karlsruhe#Nächstes%20Treffen)|03/16/2016|Germany|\n|Bremen  |[Bremer Mappertreffen](https://wiki.openstreetmap.org/wiki/Bremen/Veranstaltungen)      |03/28/2016|Germany|\n");

        bddone();
      });
    });
  });
  it("should open new tool", function(bddone) {
    this.timeout(20000);


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
    this.timeout(29000);
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
});
