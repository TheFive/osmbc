

/* jshint ignore:start */

import testutil from "../testutil.js";
import should from "should";
import sinon from "sinon";
import mockdate from "mockdate";
import fs from "fs";


import userModule from "../../model/user.js";
import articleModule from "../../model/article.js";
import { MailReceiverForTestOnly } from "../../notification/mailReceiver.js";

import OsmbcApp from "../../test/PageObjectModel/osmbcApp.js";

import util from "../../util/util.js";
const osmbcLink = util.osmbcLink;
const sleep = util.sleep;





describe("views/user", function() {
  this.timeout(300000);
  this.retries(2);
  let driver;
  let mailChecker;
  beforeEach(async function() {
    mockdate.set("2015-11-05");
    mailChecker = sinon.stub(MailReceiverForTestOnly.transporter, "sendMail")
      .callsFake(function(obj, doit) { return doit(null, { response: "t" }); });
    await testutil.clearDB();
    await userModule.createNewUser({ OSMUser: "TheFive", access: "full" });
    await articleModule.createNewArticle({ blog: "blog", collection: "test" });
    testutil.startServerSync();
    driver = await testutil.getNewDriver("TheFive");
    driver.executeScript(fs.readFileSync("./node_modules/timemachine/timemachine.js", "UTF8"));
  });
  afterEach(async function() {
    mockdate.reset();
    if (this.currentTest.state !== "failed") await driver.quit();
    mailChecker.restore();
    testutil.stopServer();
  });

  it("should not be allowed creating a user twice", async function() {
    // TheFive logs in and creates user Test
    const osmbcApp = new OsmbcApp(driver);

    const mainPage = osmbcApp.getMainPage();
    await mainPage.assertPage();
    await mainPage.clickLinkToAdminPage();

    const adminPage = osmbcApp.getAdminPage();
    await adminPage.assertPage();
    await adminPage.clickCreateUserMenu();

    const userPage = osmbcApp.getUserPage();
    await userPage.assertPage();
    await userPage.fillOSMUser("test");
    await userPage.selectPrimaryLanguage("DE");
    await userPage.selectAccess("full");
    await userPage.clickSave();


    // TheFive creates the user test a second time
    await driver.get(osmbcLink("/osmbc/admin"));
    await adminPage.assertPage();
    await adminPage.clickCreateUserMenu();


    // clicking SAVE should result in an error
    await userPage.assertPage();
    await userPage.fillOSMUser("test");
    await userPage.selectPrimaryLanguage("DE");
    await userPage.selectAccess("full");
    await userPage.clickSave();

    // test on error message missing
    const errorPage = osmbcApp.getErrorPage();
    await errorPage.assertPage();
    should(await errorPage.getErrorTitle()).eql("User >test< already exists.");
    should(await (errorPage.getErrorCode())).eql("409 Conflict");
  });

  it("should not change username, if user logged in", async function() {
    const osmbcApp = new OsmbcApp(driver);
    const mainPage = osmbcApp.getMainPage();
    const adminPage = osmbcApp.getAdminPage();
    const userPage = osmbcApp.getUserPage();

    const errors = [];

    // TheFive creates an user test
    await mainPage.assertPage();
    await mainPage.clickLinkToAdminPage();

    await adminPage.assertPage();
    await adminPage.clickCreateUserMenu();
    await sleep(300);

    await userPage.assertPage();
    await userPage.fillOSMUser("TestUser");
    await userPage.selectPrimaryLanguage("DE");
    await userPage.selectAccess("full");
    await userPage.clickSave();

    // looking at user test shows, that username can be changed
    await driver.get(osmbcLink("/usert/2"));
    await testutil.expectHtml(driver, errors, "user", "userNameChange");

    // Testuser logs in and looks at homepage
    const testDriver = await testutil.getNewDriver("TestUser");
    await testDriver.get(osmbcLink("/usert/2"));
    await testutil.expectHtml(testDriver, errors, "user", "userNoNameChange");
    testDriver.quit();
    should(errors).eql([]);
  });
  it("should save userdata and calculate WN User", async function() {
    const osmbcApp = new OsmbcApp(driver);

    await osmbcApp.openAdminPage();
    await osmbcApp.getAdminPage().clickCreateUserMenu();

    const userPage = osmbcApp.getUserPage();

    await userPage.assertPage();
    await userPage.fillOSMUser("TestUser");
    await userPage.fillEMail("");
    await userPage.fillMdWeeklyAuthor("mdWeeklyAuthor");
    await userPage.selectPrimaryLanguage("DE");
    await userPage.selectAccess("full");
    await userPage.clickSave();
    await sleep(1000);



    const result = await userModule.findById(2);
    should(result.OSMUser).eql("TestUser");
    should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
    should(result.mailComment).eql([]);
    should(result.mailBlogLanguageStatusChange).eql([]);

    await testutil.expectHtml(driver, "user", "freshCreatedUser");
  });
  it("should save single Options for Mail & Blog Notifications", async function() {
    const osmbcApp = new OsmbcApp(driver);

    await osmbcApp.openAdminPage();
    await osmbcApp.getAdminPage().clickCreateUserMenu();

    const userPage = osmbcApp.getUserPage();


    await userPage.fillOSMUser("TestUser");
    await userPage.fillEMail("");
    await userPage.toggleMailComment("DE");
    await userPage.fillMdWeeklyAuthor("mdWeeklyAuthor");
    await userPage.toggleBlogLanguageStatusChange("DE");
    await userPage.selectPrimaryLanguage("DE");
    await userPage.selectAccess("full");
    await userPage.clickSave();


    const result = await userModule.findById(2);
    should(result.OSMUser).eql("TestUser");
    should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
    should(result.mailComment).eql(["DE"]);
    should(result.mailBlogLanguageStatusChange).eql(["DE"]);
  });
  it("should save two Options for Mail & Blog Notifications", async function() {
    const osmbcApp = new OsmbcApp(driver);
    await osmbcApp.openAdminPage();
    await osmbcApp.getAdminPage().clickCreateUserMenu();
    const userPage = osmbcApp.getUserPage();
    await userPage.fillOSMUser("TestUser");
    await userPage.fillEMail("");
    await userPage.toggleMailComment("DE");
    await userPage.toggleMailComment("EN");
    await userPage.fillMdWeeklyAuthor("mdWeeklyAuthor");
    await userPage.toggleBlogLanguageStatusChange("DE");
    await userPage.toggleBlogLanguageStatusChange("EN");
    await userPage.selectPrimaryLanguage("DE");
    await userPage.selectAccess("full");
    await userPage.clickSave();

    const result = await userModule.findById(2);
    should(result.OSMUser).eql("TestUser");
    should(result.mdWeeklyAuthor).eql("mdWeeklyAuthor");
    should(result.mailComment).eql(["DE", "EN"]);
    should(result.mailBlogLanguageStatusChange).eql(["DE", "EN"]);
  });
  it("should not validate a usermail if wrong user logged in", async function() {
    await userModule.createNewUser({ OSMUser: "TestValidate", emailInvalidation: "test@test.org", emailValidationKey: "123456789" });
    const osmbcApp = new OsmbcApp(driver);
    await driver.get(osmbcLink("/usert/2?validation=123456789"));
    should(await osmbcApp.getErrorPage().getErrorTitle()).eql("Wrong User: expected >TestValidate< given >TheFive<");
  });
  it("should validate a usermail if correct user logged in", async function() {
    const osmbcApp = new OsmbcApp(driver);
    const errors = [];
    let result = await userModule.find({ OSMUser: "TheFive" });
    should(result.email).is.undefined();


    // Check Homepage for Missing Email Warning
    should(await osmbcApp.getMainPage().getMailAlertText()).eql("Please enter your email to receive comments and feedback here:");


    await driver.get(osmbcLink("/usert/1"));
    const userPage = osmbcApp.getUserPage();
    await userPage.fillEMail("test@test.org");
    await userPage.clickSave();

    should(mailChecker.calledOnce);

    // find valication link in email
    const mail = mailChecker.getCall(0).args[0].text;
    const link = mail.substring(mail.indexOf("[") + 1, mail.indexOf("]"));

    // Check Homepage for Missing Verification Warning
    await osmbcApp.openMainPage();

    should(await osmbcApp.getMainPage().getMailAlertText()).eql("Waiting for email verification, have a look at the email with the title '[OSMBC] Welcome to OSMBC' in your inbox.");

    await driver.get(link);
    result = await userModule.findById(1);

    // check that validation of email was done
    should(result.OSMUser).eql("TheFive");
    should(result.email).eql("test@test.org");
    should.not.exist(result.emailInvalidation);

    // Check Homepage for no Warning
    await osmbcApp.openMainPage();
    await testutil.expectHtml(driver, errors, "user", "home no warning");
    should(errors).eql([]);
  });
  it("should display & sort userlist", async function() {
    await userModule.createNewUser({ OSMUser: "Test1", access: "full", mdWeeklyAuthor: "b", color: "green" });
    await userModule.createNewUser({ OSMUser: "Test2", access: "full", mdWeeklyAuthor: "[a](https://a.a)", color: "blue" });
    await userModule.createNewUser({ OSMUser: "Test3", access: "denied" });
    const osmbcApp = new OsmbcApp(driver);

    await osmbcApp.openUserListPage("full");
    await osmbcApp.getUserListPage().clickSortByWeeklyAuthor();

    await testutil.expectHtml(driver, "user", "userList");
  });
});


/* jshint ignore:end */
