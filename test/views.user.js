"use strict";

var async = require("async");
var testutil = require("./testutil.js");
var should  = require("should");

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");



var maxTimer = 50000;


describe("views/user", function() {
  this.timeout(maxTimer);
  var browser;
  beforeEach(function(bddone) {
    async.series([
      testutil.clearDB,
      function createUser(cb) { userModule.createNewUser({OSMUser: "TheFive", access: "full"}, cb); },
      function createArticle(cb) {
        articleModule.createNewArticle({blog: "blog", collection: "test"}, function(err) {
          cb(err);
        });
      },
      testutil.startServer.bind(null, "TheFive")
    ], function(err) {
      browser = testutil.getBrowser();
      bddone(err);
    });
  });
  afterEach(function(bddone) {
    testutil.stopServer(bddone);
  });


  it("should not change username, if user logged in", function(bddone) {
    async.series([
      function createUser(cb) {
        userModule.createNewUser({OSMUser: "test", lastAccess: (new Date()).toISOString()}, cb);
      },
      function visitUser (cb) {
        browser.visit("/usert/1", cb);
      },
      function waitALittle(cb) {
        browser.wait(10, cb);
      }
    ], function(err) {
      should.not.exist(err);
      browser.assert.text('input[readonly="readonly"][name="OSMUser"]');
      bddone();
    });
  });
  it("should have bootstrap.js loaded", function(bddone) {
    browser.visit("/osmbc", function(err) {
      should.not.exist(err);

      // test wether bootstrap.js is loaded or not
      // see http://stackoverflow.com/questions/13933000/how-to-check-if-twitter-bootstrap-is-loaded
      should(browser.evaluate("(typeof $().modal == 'function'); ")).be.True();
      bddone();
    });
  });
  it("should save userdata and calculate WN User", function(bddone) {
    async.series([
      function visitUser (cb) {
        browser.visit("/usert/create", cb);
      },
      function fillForm (cb) {
        browser
          .fill("OSMUser", "TestUser")
          .fill("EMail", "")
          .fill("mdWeeklyAuthor", "mdWeeklyAuthor")
          .pressButton("OK", cb);
      }
    ], function(err) {
      should.not.exist(err);
      userModule.findById(2, function(err, result) {
        should.not.exist(err);
        should(result.OSMUser).eql("TestUser");
        should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
        should(result.mailComment).eql([]);
        should(result.mailBlogLanguageStatusChange).eql([]);
        bddone();
      });
    });
  });
  it("should save single Options for Mail & Blog Notifications", function(bddone) {
    this.timeout(maxTimer);
    async.series([
      function visitUser (cb) {
        browser.visit("/usert/create", cb);
      },
      function fillForm (cb) {
        browser.evaluate("document.getElementById('mailComment_DE').checked = true");
        browser.evaluate("document.getElementById('mailBlogLanguageStatusChange_DE').checked = true");
        browser
          .fill("OSMUser", "TestUser")
          .fill("EMail", "")
          .fill("mdWeeklyAuthor", "mdWeeklyAuthor")
          .pressButton("OK", cb);
      }
    ], function(err) {
      should.not.exist(err);
      userModule.findById(2, function(err, result) {
        should.not.exist(err);
        should(result.OSMUser).eql("TestUser");
        should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
        should(result.mailComment).eql(["DE"]);
        should(result.mailBlogLanguageStatusChange).eql(["DE"]);
        bddone();
      });
    });
  });
  it("should save two Options for Mail & Blog Notifications", function(bddone) {
    async.series([
      function visitUser (cb) {
        browser.visit("/usert/create", cb);
      },
      function fillForm (cb) {
        browser.evaluate("document.getElementById('mailComment_DE').checked = true");
        browser.evaluate("document.getElementById('mailBlogLanguageStatusChange_DE').checked = true");
        browser.evaluate("document.getElementById('mailComment_EN').checked = true");
        browser.evaluate("document.getElementById('mailBlogLanguageStatusChange_EN').checked = true");
        browser
          .fill("OSMUser", "TestUser")
          .fill("EMail", "")
          .fill("mdWeeklyAuthor", "mdWeeklyAuthor")
          .pressButton("OK", cb);
      }
    ], function(err) {
      should.not.exist(err);
      userModule.findById(2, function(err, result) {
        should.not.exist(err);
        should(result.OSMUser).eql("TestUser");
        should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
        should(result.mailComment).eql(["DE", "EN"]);
        should(result.mailBlogLanguageStatusChange).eql(["DE", "EN"]);
        bddone();
      });
    });
  });

  it("should not validate a usermail if wrong user logged in", function(bddone) {
    this.timeout(maxTimer);
    async.series([
      function createUser(cb) {
        userModule.createNewUser({OSMUser: "TestValidate", emailInvalidation: "test@test.org", emailValidationKey: "123456789"}, cb);
      },
      function visitUser (cb) {
        browser.visit("/usert/2?validation=123456789", cb);
      }
    ], function(err) {
      should.exist(err);
      should(browser.html("body")).match(/Wrong User: expected &gt;TestValidate&lt; given &gt;TheFive&lt;/);
      bddone();
    });
  });
  it("should validate a usermail if correct user logged in", function(bddone) {

    async.series([
      function createUser(cb) {
        userModule.find({OSMUser: "TheFive"}, function(err, result) {
          should.not.exist(err);
          var user = result[0];
          user.emailInvalidation = "test@test.org";
          user.emailValidationKey = "123456789";
          user.save(cb);
        });
      },
      function visitUser (cb) {
        browser.visit("/usert/1?validation=123456789", cb);
      }
    ], function(err) {
      should.not.exist(err);
      userModule.findById(1, function(err, result) {
        should.not.exist(err);
        should(result.OSMUser).eql("TheFive");
        should(result.email).eql("test@test.org");
        should.not.exist(result.emailInvalidation);
        bddone();
      });
    });
  });
  it("should display & sort userlist", function(bddone) {
    async.series([
      function createUser1(cb) { userModule.createNewUser({OSMUser: "Test1", access: "full", mdWeeklyAuthor: "b", color: "green"}, cb); },
      function createUser2(cb) { userModule.createNewUser({OSMUser: "Test2", access: "full", mdWeeklyAuthor: "[a](https://a.a)", color: "blue"}, cb); },
      function createUser2(cb) { userModule.createNewUser({OSMUser: "Test3", access: "denied"}, cb); },
      function visitUser (cb) {
        browser.visit("/usert/list?access=full", cb);
      },
      function clickOnwnWeeklyAuthor(cb) {
        browser.click('a[id="sortWeeklyAuthor"]', cb);
      }
    ], function(err) {
      should.not.exist(err);
      var r = browser.html();
      r = r.substring(r.indexOf("<table"), r.indexOf("</table"));
      should(testutil.equalHtml(r, '<table class="table table-striped table-responsive">\n' +
        "              <thead>\n" +
        "                <tr>\n" +
        "                  <th>color</th>\n" +
        '                  <th><a href="/usert/list?access=full&amp;sort=OSMUser">Name</a></th>\n' +
        "                  <th>OSM</th>\n" +
        '                  <th><a id="sortWeeklyAuthor" href="/usert/list?access=full&amp;sort=mdWeeklyAuthor">WeeklyAuthor</a></th>\n' +
        '                  <th><a id="sortOSMBCChanges" href="/usert/list?access=full&amp;sort=OSMBC-changes">OSMBC Changes</a></th>\n' +
        "                  <th>Email</th>\n" +
        "                  <th>Collection</th>\n" +
        "                  <th>AllComment</th>\n" +
        "                  <th>Comment</th>\n" +
        "                  <th>Status</th>\n" +
        '                  <th><a href="/usert/list?access=full&amp;sort=language">Language</a></th>\n' +
        "                  <th>access</th>\n" +
        '                  <th><a href="/usert/list?access=full&amp;sort=lastAccess&amp;desc=true">lastAccess</a></th>\n' +
        "                </tr>\n" +
        "              </thead>\n" +
        "              <tbody>\n" +
        "                <tr>\n" +
        '                  <td><span style="background-color:blue" class="label osmbclabel-collect">Test2</span></td>\n' +
        '                  <td><a href="/usert/3">Test2</a>\n' +
        "                  </td>\n" +
        '                  <td><a href="http://www.openstreetmap.org/user/Test2">[OSM]</a></td>\n' +
        '                  <td><a href="https://a.a">a</a>\n' +
        "                  </td>\n" +
        '                  <td><a href="/changes/log?user=Test2">(0)</a></td>\n' +
        "                  <td>\n" +
        "                  </td>\n" +
        "                  <td>\n" +
        "                    <p> </p>\n" +
        "                  </td>\n" +
        "                  <td>\n" +
        "                    <p> </p>\n" +
        "                  </td>\n" +
        "                  <td></td>\n" +
        "                  <td></td>\n" +
        "                  <td></td>\n" +
        "                  <td>full</td>\n" +
        "                  <td>Never</td>\n" +
        "                </tr>\n" +
        "                <tr>\n" +
        '                  <td><span style="background-color:green" class="label osmbclabel-collect">Test1</span></td>\n' +
        '                  <td><a href="/usert/2">Test1</a>\n' +
        "                  </td>\n" +
        '                  <td><a href="http://www.openstreetmap.org/user/Test1">[OSM]</a></td>\n' +
        "                  <td>b\n" +
        "                  </td>\n" +
        '                  <td><a href="/changes/log?user=Test1">(0)</a></td>\n' +
        "                  <td>\n" +
        "                  </td>\n" +
        "                  <td>\n" +
        "                    <p> </p>\n" +
        "                  </td>\n" +
        "                  <td>\n" +
        "                    <p> </p>\n" +
        "                  </td>\n" +
        "                  <td></td>\n" +
        "                  <td></td>\n" +
        "                  <td></td>\n" +
        "                  <td>full</td>\n" +
        "                  <td>Never</td>\n" +
        "                </tr>\n" +
        "                <tr>\n" +
        '                  <td><span style="background-color:undefined" class="label osmbclabel-collect">TheFive</span></td>\n' +
        '                  <td><a href="/usert/1">TheFive</a>\n' +
        "                  </td>\n" +
        '                  <td><a href="http://www.openstreetmap.org/user/TheFive">[OSM]</a></td>\n' +
        "                  <td>\n" +
        "                  </td>\n" +
        '                  <td><a href="/changes/log?user=TheFive">(0)</a></td>\n' +
        "                  <td>\n" +
        "                  </td>\n" +
        "                  <td>\n" +
        "                    <p> </p>\n" +
        "                  </td>\n" +
        "                  <td>\n" +
        "                    <p> </p>\n" +
        "                  </td>\n" +
        "                  <td></td>\n" +
        "                  <td></td>\n" +
        "                  <td></td>\n" +
        "                  <td>full</td>\n" +
        "                  <td>a few seconds ago</td>\n" +
        "                </tr>\n" +
        "              </tbody>")).be.True();

      bddone();
    });
  });
});
