"use strict";

/* jshint ignore:start */

const testutil = require("../testutil.js");
const should  = require("should");
const sinon = require("sinon");
const mockdate = require("mockdate");
const fs = require("fs");


const userModule = require("../../model/user.js");
const articleModule = require("../../model/article.js");
const mailReceiver = require("../../notification/mailReceiver.js");






describe("views/user", function() {
  this.timeout(300000);
  let browser;
  let mailChecker;
  beforeEach(async function() {
    mockdate.set("2015-11-05");
    mailChecker = sinon.stub( mailReceiver.for_test_only.transporter,"sendMail")
      .callsFake(function(obj, doit) { return doit(null, {response: "t"}); })
    await testutil.clearDB();
    await userModule.createNewUser({OSMUser: "TheFive", access: "full"});
    await articleModule.createNewArticle({blog: "blog", collection: "test"});
    testutil.startServerSync();
    browser = await testutil.getNewBrowser("TheFive");
    browser.evaluate(fs.readFileSync("./node_modules/timemachine/timemachine.js","UTF8"));
  });
  afterEach(function(bddone) {
    mockdate.reset();
    mailChecker.restore();
    testutil.stopServer(bddone);
  });

  it("should not be allowed creating a user twice", async function() {
    // TheFive logs in and creates user Test
    await browser.visit("/osmbc/admin");
    await browser.click("#createUser");
    await browser.fill("OSMUser","test")
      .select("language","DE")
      .select("access","full")
      .click("#save");

    // TheFive creates the user test a second time
    await browser.visit("/osmbc/admin");
    await browser.click("#createUser");

    // clicking SAVE should result in an error
    try {
      await browser.fill("OSMUser","test")
        .select("language","DE")
        .select("access","full")
        .click("#save");
    } catch(err) {
      should(err.cause.message).eql("Server returned status code 409 from http://localhost:35043/usert/3");
      should(browser.html()).containEql("User &gt;test&lt; already exists");
    }
  });

  it("should not change username, if user logged in", async function() {

    let errors = [];

    // MOck date in browser
    browser.on("loaded",async (window ) => 
    {
      await browser.evaluate( `
      ( (m) => {var __Date = Date; 
        Date = undefined; 
        Date = function() { return new __Date(m); }; 
        Date.prototype = __Date.prototype;
        Date.now = function(){return new Date().valueOf()}})
        (new Date('2015-11-05'))`);
    })
    // TheFive creates an user test
    await browser.visit("/osmbc/admin");
    await browser.click("#createUser");
    await browser.fill("OSMUser","test")
      .select("language","DE")
      .select("access","full")
      .click("#save");


    // looking at user test shows, that username can be changed
    await browser.visit("/usert/2");
    browser.assert.expectHtmlSync(errors,"user","userNameChange");

    // Testuser logs in and looks at homepage
    let testBrowser = await testutil.getNewBrowser("test");
    await testBrowser.visit("/osmbc");
    // reload test user page should show username unchangable
    await browser.visit("/usert/2");
    browser.assert.expectHtmlSync(errors,"user","userNoNameChange");
    should(errors).eql([]);
  });
  it("should save userdata and calculate WN User", async function() {
    await browser.visit("/usert/create");

    // Register a Mock of Date when page is loaded
    browser.on("loaded",async (window ) => 
      {
        await browser.evaluate( `
        ( (m) => {var __Date = Date; 
          Date = undefined; 
          Date = function() { return new __Date(m); }; 
          Date.prototype = __Date.prototype;
          Date.now = function(){return new Date().valueOf()}})
          (new Date('2015-11-05'))`);
      })
    await browser
      .fill("OSMUser", "TestUser")
      .fill("EMail", "")
      .fill("mdWeeklyAuthor", "mdWeeklyAuthor")
      .click("#save");
     
      let result = await userModule.findById(2);

    browser.assert.expectHtmlSync("user","freshCreatedUser");
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
    let errors = [];
    let result = await userModule.find({OSMUser: "TheFive"});
    should(result.email).is.undefined();

    // Check Homepage for Missing Email Warning
    await browser.visit("/osmbc");
    browser.assert.expectHtmlSync(errors,"user","home missing email");


    await browser.visit("/usert/1");
    browser.fill("EMail","test@test.org");
    await browser.click("#save");

    should(mailChecker.calledOnce);

    // find valication link in email
    let mail = mailChecker.getCall(0).args[0].text;
    let link = mail.substring(mail.indexOf("/usert"),mail.indexOf("]. This"));

    // Check Homepage for Missing Verification Warning
    await browser.visit("/osmbc");
    browser.assert.expectHtmlSync(errors,"user","home missing verification");


    await browser.visit(link);
    result = await userModule.findById(1);

    // check that validation of email was done
    should(result.OSMUser).eql("TheFive");
    should(result.email).eql("test@test.org");
    should.not.exist(result.emailInvalidation);

    // Check Homepage for no Warning
    await browser.visit("/osmbc");
    browser.assert.expectHtmlSync(errors,"user","home no warning");
    should(errors).eql([]);

  });
  it("should display & sort userlist", async function() {
    await userModule.createNewUser({OSMUser: "Test1", access: "full", mdWeeklyAuthor: "b", color: "green"});
    await userModule.createNewUser({OSMUser: "Test2", access: "full", mdWeeklyAuthor: "[a](https://a.a)", color: "blue"});
    await userModule.createNewUser({OSMUser: "Test3", access: "denied"});
    await browser.visit("/usert/list?access=full");
    await browser.click('a[id="sortWeeklyAuthor"]');
    browser.assert.expectHtmlSync("user","userList");
  });
});


/* jshint ignore:end */