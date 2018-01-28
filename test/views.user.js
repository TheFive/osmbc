"use strict";

var async = require("async");
var testutil = require("./testutil.js");
var should  = require("should");
var nock = require("nock");

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");
var passportStub = require("./passport-stub.js");





describe("views/user", function() {
  this.timeout(100000);
  let browser;
  let nockLogin;
  beforeEach(async function() {
    await testutil.clearDB();
    await userModule.createNewUser({OSMUser: "TheFive", access: "full"});
    await articleModule.createNewArticle({blog: "blog", collection: "test"});
    testutil.startServerSync();
    browser = await testutil.getNewBrowser("TheFive");
  });
  afterEach(function(bddone) {
    testutil.stopServer(bddone);
  });


  it("should not change username, if user logged in", async function() {
    await userModule.createNewUser({OSMUser: "test", lastAccess: (new Date()).toISOString()});
    await browser.visit("/usert/1");
    await browser.wait(100);
    browser.assert.text('input[readonly="readonly"][name="OSMUser"]');
  });
  it("should have bootstrap.js loaded", async function() {
    await browser.visit("/osmbc");
    should(browser.evaluate("(typeof $().modal == 'function'); ")).be.True();
  });
  it("should save userdata and calculate WN User", async function() {
    await browser.visit("/usert/create");
    await browser
      .fill("OSMUser", "TestUser")
      .fill("EMail", "")
      .fill("mdWeeklyAuthor", "mdWeeklyAuthor")
      .pressButton("OK");
    let result = await userModule.findById(2);
    should(result.OSMUser).eql("TestUser");
    should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
    should(result.mailComment).eql([]);
    should(result.mailBlogLanguageStatusChange).eql([]);
  });
  it("should save single Options for Mail & Blog Notifications", async function() {
    await browser.visit("/usert/create");
    browser.evaluate("document.getElementById('mailComment_DE').checked = true");
    browser.evaluate("document.getElementById('mailBlogLanguageStatusChange_DE').checked = true");
    await browser
      .fill("OSMUser", "TestUser")
      .fill("EMail", "")
      .fill("mdWeeklyAuthor", "mdWeeklyAuthor")
      .pressButton("OK");
    let result = await userModule.findById(2);
    should(result.OSMUser).eql("TestUser");
    should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
    should(result.mailComment).eql(["DE"]);
    should(result.mailBlogLanguageStatusChange).eql(["DE"]);
  });
  it("should save two Options for Mail & Blog Notifications", async function() {
    await browser.visit("/usert/create");
    browser.evaluate("document.getElementById('mailComment_DE').checked = true");
    browser.evaluate("document.getElementById('mailBlogLanguageStatusChange_DE').checked = true");
    browser.evaluate("document.getElementById('mailComment_EN').checked = true");
    browser.evaluate("document.getElementById('mailBlogLanguageStatusChange_EN').checked = true");
    await browser
      .fill("OSMUser", "TestUser")
      .fill("EMail", "")
      .fill("mdWeeklyAuthor", "mdWeeklyAuthor")
      .pressButton("OK");
    let result = await userModule.findById(2);
    should(result.OSMUser).eql("TestUser");
    should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
    should(result.mailComment).eql(["DE", "EN"]);
    should(result.mailBlogLanguageStatusChange).eql(["DE", "EN"]);
  });
  it("should not validate a usermail if wrong user logged in", async function() {
    await userModule.createNewUser({OSMUser: "TestValidate", emailInvalidation: "test@test.org", emailValidationKey: "123456789"});
    try {
      await browser.visit("/usert/2?validation=123456789");
    } catch(err) {
      // catch, as server is throwing 500 er error.
    }
    should(browser.html("body")).match(/Wrong User: expected &gt;TestValidate&lt; given &gt;TheFive&lt;/);
  });
  it("should validate a usermail if correct user logged in", async function() {
    let result = await userModule.find({OSMUser: "TheFive"});
    let user = result[0];
    user.emailInvalidation = "test@test.org";
    user.emailValidationKey = "123456789";

    // save is not async await save !!!!!!!!!!!!!!!!
    ###############################################
    await user.save();
    await browser.visit("/usert/1?validation=123456789");
    result = await userModule.findById(1);
    should(result.OSMUser).eql("TheFive");
    should(result.email).eql("test@test.org");
    should.not.exist(result.emailInvalidation);
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
