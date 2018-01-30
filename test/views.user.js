"use strict";

/* jshint ignore:start */

const testutil = require("./testutil.js");
const should  = require("should");
const sinon = require("sinon");

const userModule = require("../model/user.js");
const articleModule = require("../model/article.js");
const mailReceiver = require("../notification/mailReceiver.js");





describe("views/user", function() {
  this.timeout(100000);
  let browser;
  let nockLogin;
  let mailChecker;
  beforeEach(async function() {
    mailChecker = sinon.stub( mailReceiver.for_test_only.transporter,"sendMail")
      .callsFake(function(obj, doit) { return doit(null, {response: "t"}); })
    await testutil.clearDB();
    await userModule.createNewUser({OSMUser: "TheFive", access: "full"});
    await articleModule.createNewArticle({blog: "blog", collection: "test"});
    testutil.startServerSync();
    browser = await testutil.getNewBrowser("TheFive");
  });
  afterEach(function(bddone) {
    mailChecker.restore();
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
    await browser.visit("/usert/1");
    browser.fill("EMail","test@test.org");
    await browser.click("#save");

    should(mailChecker.calledOnce);

    // find valication link in email
    let mail = mailChecker.getCall(0).args[0].text;
    let link = mail.substring(mail.indexOf("/usert"),mail.indexOf("]. This"));

    await browser.visit(link);
    result = await userModule.findById(1);

    // check that validation of email was done
    should(result.OSMUser).eql("TheFive");
    should(result.email).eql("test@test.org");
    should.not.exist(result.emailInvalidation);
  });
  it("should display & sort userlist", async function() {
    await userModule.createNewUser({OSMUser: "Test1", access: "full", mdWeeklyAuthor: "b", color: "green"});
    await userModule.createNewUser({OSMUser: "Test2", access: "full", mdWeeklyAuthor: "[a](https://a.a)", color: "blue"});
    await userModule.createNewUser({OSMUser: "Test3", access: "denied"});
    await browser.visit("/usert/list?access=full");
    await browser.click('a[id="sortWeeklyAuthor"]');
    browser.assert.expectHtmlSync("views","userList.html");
  });
});


/* jshint ignore:end */