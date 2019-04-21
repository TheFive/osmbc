"use strict";


var should = require("should");
var sinon  = require("sinon");
var nock   = require("nock");
var fs     = require("fs");
var path   = require("path");
var mockdate = require("mockdate");
var HttpError = require("standard-http-error");




var testutil = require("./testutil.js");

var articleModule = require("../model/article.js");
var blogModule    = require("../model/blog.js");
var userModule    = require("../model/user.js");

var mailReceiver  = require("../notification/mailReceiver.js");

var messageCenter = require("../notification/messageCenter.js");




messageCenter.initialise();
let logFile = path.join(__dirname, "..", "maillogTest.log");


describe("notification/mailReceiver", function() {
  before(function (bddone) {
    testutil.clearDB(bddone);
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
  });

  after(function (bddone) {
    nock.cleanAll();
    bddone();
  });

  describe("articles", function() {
    let mailChecker;
    afterEach(function (bddone) {
      mailChecker.restore();
      bddone();
    });

    beforeEach(function (bddone) {
      if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
      mailChecker = sinon.stub(mailReceiver.for_test_only.transporter, "sendMail")
        .callsFake(function(obj, doit) { return doit(null, { response: "t" }); });
      testutil.importData({ clear: true,
        user: [{ OSMUser: "UserNewCollection", email: "UserNewCollection@mail.bc", access: "full", mailNewCollection: "true" },
          { OSMUser: "UserAllComment", email: "UserAllComment@mail.bc", access: "full", mailAllComment: "true" },
          { OSMUser: "UserMailDeUser3", email: "UserMailDeUser3@mail.bc", access: "full", mailComment: ["DE", "UserMailDeUser3"] },
          { OSMUser: "UserMailDeUser3General", email: "UserMailDeUser3General@mail.bc", access: "full", mailCommentGeneral: "true", mailComment: ["DE", "UserMailDeUser3General"] },
          { OSMUser: "User4", email: "user4@mail.bc", access: "full", mailComment: ["User4"] },
          { OSMUser: "User5", access: "full", mailAllComment: "true" },
          { OSMUser: "User6", access: "full", mailBlogStatusChange: "true" },
          { OSMUser: "UserGuest", access: "guest", email: "user@guest.tol" },
          { OSMUser: "forename surname", access: "full", email: "forename.surname@mail.com", mailComment: ["forename surname"] }] }, bddone);
    });
    it("should send out mail, when collecting article", function (bddone) {
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave({ OSMUser: "testuser" }, { version: 1, blog: "WN789", collection: "newtext", title: "Test Title" }, function(err) {
          should.not.exist(err);
          should(mailChecker.callCount).eql(1);
          should(mailChecker.calledOnce).be.True();
          var result = mailChecker.getCall(0).args[0];
          var expectedMail = '<h2>Change in article of WN789</h2><p>Article <a href="https://testosm.bc/article/1">Test Title</a> was changed by testuser </p><h3>blog was added</h3><p>WN789</p><h3>collection was added</h3><p>newtext</p><h3>title was added</h3><p>Test Title</p>';
          should(result.html).eql(expectedMail);
          should(mailChecker.getCall(0).args[0]).eql(
            { from: "noreply@gmail.com",
              to: "UserNewCollection@mail.bc",
              subject: "[TESTBC] WN789 added: Test Title",
              html: expectedMail,
              text: "CHANGE IN ARTICLE OF WN789\nArticle Test Title [https://testosm.bc/article/1] was changed by testuser \n\nBLOG WAS ADDED\nWN789\n\nCOLLECTION WAS ADDED\nnewtext\n\nTITLE WAS ADDED\nTest Title" });
          bddone();
        });
      });
    });
    it("should send out mail, when adding a comment", function (bddone) {
      articleModule.createNewArticle({ blog: "WN278", title: "To Add A Comment" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for none", function(err) {
          should.not.exist(err);
          should(mailChecker.callCount).eql(1);
          // First Mail Check
          var result = mailChecker.getCall(0).args[0];
          var expectedMail = {
            html: '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for none</p>',
            text: "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS ADDED\nInformation for none",
            from: "noreply@gmail.com",
            to: "UserAllComment@mail.bc",
            subject: "[TESTBC] WN278 comment: To Add A Comment"
          };
          should(result).eql(expectedMail);
          bddone();
        });
      });
    });

    it("should send out mail, when adding a comment for a user", function (bddone) {
      articleModule.createNewArticle({ blog: "WN278", title: "To Add A Comment" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for @User4 and @EN", function(err) {
          should.not.exist(err);
          should(mailChecker.callCount).eql(2);
          // First Mail Check

          var expectedMail = {
            html: '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for @User4 and @EN</p>',
            text: "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS ADDED\nInformation for @User4 and @EN",
            from: "noreply@gmail.com",
            to: "UserAllComment@mail.bc",
            subject: "[TESTBC] WN278 comment: To Add A Comment"
          };
          var result = mailChecker.getCall(0).args[0];
          should(result).eql(expectedMail);

          result = mailChecker.getCall(1).args[0];
          expectedMail.to = "user4@mail.bc";
          should(result).eql(expectedMail);
          bddone();
        });
      });
    });
    it("should send out mail, when adding a comment for a user with space in name", function (bddone) {
      articleModule.createNewArticle({ blog: "WN278", title: "To Add A Comment" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for @forename surname and @EN", function(err) {
          should.not.exist(err);
          should(mailChecker.callCount).eql(2);
          // First Mail Check

          var expectedMail = {
            html: '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for @forename surname and @EN</p>',
            text: "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS ADDED\nInformation for @forename surname and @EN",
            from: "noreply@gmail.com",
            to: "UserAllComment@mail.bc",
            subject: "[TESTBC] WN278 comment: To Add A Comment"
          };
          var result = mailChecker.getCall(0).args[0];
          should(result).eql(expectedMail);

          result = mailChecker.getCall(1).args[0];
          expectedMail.to = "forename.surname@mail.com";
          should(result).eql(expectedMail);
          bddone();
        });
      });
    });
    it("should send out mail, when adding a comment for a guest user", function (bddone) {
      articleModule.createNewArticle({ blog: "WN278", title: "To Add A Comment" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for @userguest", function(err) {
          should.not.exist(err);
          should(mailChecker.callCount).eql(2);
          // First Mail Check

          var expectedMail = {
            html: '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for @userguest</p>',
            text: "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS ADDED\nInformation for @userguest",
            from: "noreply@gmail.com",
            to: "UserAllComment@mail.bc",
            subject: "[TESTBC] WN278 comment: To Add A Comment"
          };
          var result = mailChecker.getCall(0).args[0];
          should(result).eql(expectedMail);

          result = mailChecker.getCall(1).args[0];
          expectedMail.to = "user@guest.tol";
          should(result).eql(expectedMail);
          bddone();
        });
      });
    });

    it("should send out mail, when adding a comment in general Mode (by mention)", function (bddone) {
      articleModule.createNewArticle({ blog: "WN278", title: "To Add A Comment", commentList: [{ user: "test", text: "@UserMailDeUser3General" }] }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for none", function(err) {
          should.not.exist(err);

          var expectedMail = {
            html: '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for none</p>',
            text: "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS ADDED\nInformation for none",
            from: "noreply@gmail.com",
            to: "UserAllComment@mail.bc",
            subject: "[TESTBC] WN278 comment: To Add A Comment"
          };

          should(mailChecker.callCount).eql(2);

          // First Mail Check
          var result = mailChecker.getCall(0).args[0];
          should(result).eql(expectedMail);

          // Second Mail Check
          result = mailChecker.getCall(1).args[0];
          expectedMail.to = "UserMailDeUser3General@mail.bc";
          should(result).eql(expectedMail);
          bddone();
        });
      });
    });
    it("should send out mail, when adding a comment in general Mode (by participation)", function (bddone) {
      articleModule.createNewArticle({ blog: "WN278", title: "To Add A Comment", commentList: [{ user: "UserMailDeUser3General", text: "First Comment text" }] }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for none", function(err) {
          should.not.exist(err);

          should(mailChecker.callCount).eql(2);

          // First Mail Check
          var result = mailChecker.getCall(0).args[0];
          var expectedMail = '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for none</p>';
          var expectedText = "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS ADDED\nInformation for none";
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(result).eql(
            { from: "noreply@gmail.com",
              to: "UserAllComment@mail.bc",
              subject: "[TESTBC] WN278 comment: To Add A Comment",
              html: expectedMail,
              text: expectedText });
          // Second Mail Check
          result = mailChecker.getCall(1).args[0];
          expectedMail = '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for none</p>';
          expectedText = "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS ADDED\nInformation for none";
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(result).eql(
            { from: "noreply@gmail.com",
              to: "UserMailDeUser3General@mail.bc",
              subject: "[TESTBC] WN278 comment: To Add A Comment",
              html: expectedMail,
              text: expectedText });
          bddone();
        });
      });
    });
    it("should send out mail, when changing a comment", function (bddone) {
      articleModule.createNewArticle({ blog: "WN278", title: "To Add A Comment" }, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({ OSMUser: "testuser" }, "Information for none", function(err) {
          should.not.exist(err);
          article.editComment({ OSMUser: "testuser" }, 0, "Information for @UserMailDeUser3", function(err) {
            should.not.exist(err);

            let expectedMail = {
              from: "noreply@gmail.com",
              to: "UserAllComment@mail.bc",
              subject: "[TESTBC] WN278 comment: To Add A Comment",
              html: '<h2>Change in article of WN278</h2><p>Article <a href="https://testosm.bc/article/1">To Add A Comment</a> was changed by testuser </p><h3>comment was added</h3><p>Information for none</p>',
              text: "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS ADDED\nInformation for none"
            };

            should(mailChecker.callCount).eql(3);

            // First Mail Check
            var result = mailChecker.getCall(0).args[0];
            should(result).eql(expectedMail);

            // Second Mail Check
            result = mailChecker.getCall(1).args[0];
            expectedMail.to = "UserAllComment@mail.bc";
            expectedMail.text = "CHANGE IN ARTICLE OF WN278\nArticle To Add A Comment [https://testosm.bc/article/1] was changed by testuser \n\nCOMMENT WAS CHANGED\nInformation for @UserMailDeUser3";
            expectedMail.html = "<h2>Change in article of WN278</h2><p>Article <a href=\"https://testosm.bc/article/1\">To Add A Comment</a> was changed by testuser </p><h3>comment was changed</h3><p>Information for @UserMailDeUser3</p>";

            should(result).eql(expectedMail);

            // Third Mail Check
            result = mailChecker.getCall(2).args[0];
            expectedMail.to = "UserMailDeUser3@mail.bc";
            should(result).eql(expectedMail);

            bddone();
          });
        });
      });
    });
  });
  describe("blogs", function() {
    var oldtransporter;
    var mailChecker;
    afterEach(function (bddone) {
      mailReceiver.for_test_only.transporter.sendMail = oldtransporter;
      mockdate.reset();
      bddone();
    });

    beforeEach(function (bddone) {
      mockdate.set(new Date("2016-05-25T20:00:00Z"));
      oldtransporter = mailReceiver.for_test_only.transporter.sendMail;
      mailChecker = sinon.spy(function(obj, doit) { return doit(null, { response: "t" }); });
      mailReceiver.for_test_only.transporter.sendMail = mailChecker;
      testutil.importData({ clear: true,
        user: [{ OSMUser: "User1", email: "user1@mail.bc", access: "full", mailBlogStatusChange: "true" },
          { OSMUser: "User2", email: "user2@mail.bc", access: "full", mailBlogStatusChange: "true" },
          { OSMUser: "User3", email: "user3@mail.bc", access: "full", mailBlogLanguageStatusChange: ["EN", "ES"] },
          { OSMUser: "User4", email: "user4@mail.bc", access: "full" },
          { OSMUser: "User5", access: "full", mailBlogStatusChange: "true" }] }, bddone);
    });
    it("should send out mail when creating a blog", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "testuser" }, function(err) {
        should.not.exist(err);


        should(mailChecker.calledTwice).be.True();
        var result = mailChecker.getCall(0).args[0];
        var expectedMail = '<h2>Blog WN251 changed.</h2><p>Blog <a href="https://testosm.bc/blog/WN251">WN251</a> was changed by testuser</p><table id=\"valuetable\"><tr><th>Key</th><th>Value</th></tr><tr><td>name</td><td>WN251</td></tr><tr><td>status</td><td>open</td></tr><tr><td>startDate</td><td>2016-05-26T20:00:00.000Z</td></tr><tr><td>endDate</td><td>2016-06-01T20:00:00.000Z</td></tr></table>';
        var expectedText = "BLOG WN251 CHANGED.\nBlog WN251 [https://testosm.bc/blog/WN251] was changed by testuser\n\nKEY         VALUE                      \nname        WN251                      \nstatus      open                       \nstartDate   2016-05-26T20:00:00.000Z   \nendDate     2016-06-01T20:00:00.000Z";

        // result is not sorted, so have a preview, which argument is the right one.
        var mailList = {};
        mailList[mailChecker.getCall(0).args[0].to] = "-";
        mailList[mailChecker.getCall(1).args[0].to] = "-";
        should(mailList).eql({ "user1@mail.bc": "-", "user2@mail.bc": "-" });
        delete mailChecker.getCall(0).args[0].to;
        delete mailChecker.getCall(1).args[0].to;




        should(result.html).eql(expectedMail);
        should(result.text).eql(expectedText);
        should(mailChecker.getCall(0).args[0]).eql(
          { from: "noreply@gmail.com",
            subject: "[TESTBC] WN251 was created",
            html: expectedMail,
            text: expectedText });
        should(mailChecker.getCall(1).args[0]).eql(
          { from: "noreply@gmail.com",
            subject: "[TESTBC] WN251 was created",
            html: expectedMail,
            text: expectedText });
        bddone();
      });
    });
    it("should send out mail when change blog status", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "testuser" }, function(err, blog) {
        should.not.exist(err);
        // reset sinon spy:
        var mailChecker = sinon.spy(function(obj, doit) { return doit(null, { response: "t" }); });
        mailReceiver.for_test_only.transporter.sendMail = mailChecker;
        blog.setAndSave({ OSMUser: "testuser" }, { status: "edit" }, function(err) {
          should.not.exist(err);

          should(mailChecker.calledTwice).be.True();
          var result = mailReceiver.for_test_only.transporter.sendMail.getCall(0).args[0];
          var expectedMail = '<h2>Blog WN251 changed.</h2><p>Blog <a href="https://testosm.bc/blog/WN251">WN251</a> was changed by testuser</p><table id=\"valuetable\"><tr><th>Key</th><th>Value</th></tr><tr><td>status</td><td>edit</td></tr></table>';
          var expectedText = "BLOG WN251 CHANGED.\nBlog WN251 [https://testosm.bc/blog/WN251] was changed by testuser\n\nKEY      VALUE   \nstatus   edit";
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          // result is not sorted, so have a preview, which argument is the right one.
          var mailList = {};
          mailList[mailChecker.getCall(0).args[0].to] = "-";
          mailList[mailChecker.getCall(1).args[0].to] = "-";
          should(mailList).eql({ "user1@mail.bc": "-", "user2@mail.bc": "-" });
          delete mailChecker.getCall(0).args[0].to;
          delete mailChecker.getCall(1).args[0].to;
          should(mailChecker.getCall(0).args[0]).eql(
            { from: "noreply@gmail.com",
              subject: "[TESTBC] WN251 changed status to edit",
              html: expectedMail,
              text: expectedText });
          should(mailChecker.getCall(1).args[0]).eql(
            { from: "noreply@gmail.com",
              subject: "[TESTBC] WN251 changed status to edit",
              html: expectedMail,
              text: expectedText });
          bddone();
        });
      });
    });
    it("should send out mail when review status is set", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        should.not.exist(err);
        // reset sinon spy:
        var mailChecker = sinon.spy(function(obj, doit) { return doit(null, { response: "t" }); });
        mailReceiver.for_test_only.transporter.sendMail = mailChecker;
        blog.setReviewComment("ES", { OSMUser: "testuser" }, "I have reviewed", function(err) {
          should.not.exist(err);

          should(mailChecker.calledOnce).be.True();
          var result = mailChecker.getCall(0).args[0];
          var expectedMail = '<h2>Blog blog(ES) was reviewed by testuser</h2><p><span>Blog </span><a href="https://testosm.bc/blog/blog">blog</a><span> was changed by testuser</span></p><p>Review comment is:</p><p>I have reviewed</p>';
          var expectedText = "BLOG BLOG(ES) WAS REVIEWED BY TESTUSER\n" +
            "Blog blog [https://testosm.bc/blog/blog] was changed by testuser\n" +
            "\n" +
            "Review comment is:\n" +
            "\n" +
            "I have reviewed";
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(mailChecker.getCall(0).args[0]).eql(
            { from: "noreply@gmail.com",
              to: "user3@mail.bc",
              subject: "[TESTBC] blog(ES) has been reviewed by user testuser",
              html: expectedMail,
              text: expectedText });
          bddone();
        });
      });
    });
    it("should send out mail when review is marked as exported", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        should.not.exist(err);
        // reset sinon spy:
        var mailChecker = sinon.spy(function(obj, doit) { return doit(null, { response: "t" }); });
        mailReceiver.for_test_only.transporter.sendMail = mailChecker;
        blog.setReviewComment("ES", { OSMUser: "testuser" }, "markexported", function(err) {
          should.not.exist(err);

          should(mailChecker.calledOnce).be.True();
          var result = mailChecker.getCall(0).args[0];
          var expectedMail = '<h2>Blog blog(ES) has finished review.</h2><p>testuser has finished review for Blog<a href="https://testosm.bc/blog/blog">blog</a></p>';
          var expectedText = "BLOG BLOG(ES) HAS FINISHED REVIEW.\n" +
            "testuser has finished review for Blogblog [https://testosm.bc/blog/blog]";

          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(mailChecker.getCall(0).args[0]).eql(
            { from: "noreply@gmail.com",
              to: "user3@mail.bc",
              subject: "[TESTBC] blog(ES) is exported to WordPress",
              html: expectedMail,
              text: expectedText });
          bddone();
        });
      });
    });
    it("should send out mail when blog is closed", function (bddone) {
      blogModule.createNewBlog({ OSMUser: "testuser" }, { name: "blog", status: "edit" }, function(err, blog) {
        should.not.exist(err);
        // reset sinon spy:
        var mailChecker = sinon.spy(function(obj, doit) { return doit(null, { response: "t" }); });
        mailReceiver.for_test_only.transporter.sendMail = mailChecker;
        blog.closeBlog({ lang: "ES", user: { OSMUser: "testuser" }, status: true }, function(err) {
          should.not.exist(err);
          should(mailChecker.calledOnce).be.True();
          var result = mailChecker.getCall(0).args[0];
          var expectedMail = '<h2>Blog blog was closed for ES.</h2><p>Blog <a href=\"https://testosm.bc/blog/blog\">blog</a>(ES) was closed by testuser.</p>';
          var expectedText = "BLOG BLOG WAS CLOSED FOR ES.\nBlog blog [https://testosm.bc/blog/blog](ES) was closed by testuser.";
          should(result.html).eql(expectedMail);
          should(result.text).eql(expectedText);
          should(mailChecker.getCall(0).args[0]).eql(
            { from: "noreply@gmail.com",
              to: "user3@mail.bc",
              subject: "[TESTBC] blog(ES) has been closed by user testuser",
              html: expectedMail,
              text: expectedText });
          bddone();
        });
      });
    });
  });
  describe("users", function() {
    var oldtransporter;
    beforeEach(function (bddone) {
      oldtransporter = mailReceiver.for_test_only.transporter.sendMail;
      var mailChecker = sinon.spy(function(obj, doit) { return doit(null, { response: "t" }); });
      mailReceiver.for_test_only.transporter.sendMail = mailChecker;
      testutil.importData({ clear: true,
        user: [{ OSMUser: "WelcomeMe", email: "none" },
          { OSMUser: "InviteYou", email: "invite@mail.org" }] }, bddone);
    });
    afterEach(function (bddone) {
      mailReceiver.for_test_only.transporter.sendMail = oldtransporter;
      bddone();
    });
    it("should send out an email when changing email", function (bddone) {
      var mailChecker =  sinon.spy(function(obj, doit) { return doit(null, { response: "t" }); });
      mailReceiver.for_test_only.transporter.sendMail = mailChecker;

      userModule.findOne({ OSMUser: "WelcomeMe" }, function(err, user) {
        should.not.exist(err);
        // First set a new EMail Adress for the WecomeMe user, by InviteYou.
        user.setAndSave({ OSMUser: "WelcomeMe" }, { email: "WelcomeMe@newemail.org" }, function (err) {
          should.not.exist(err);
          setTimeout(function () {
            should(typeof (mailChecker)).eql("function");
            should(mailChecker.called).be.True();
            var result = mailChecker.getCall(0).args[0];
            var code = user.emailValidationKey;
            var expectedMail = '<h2>Welcome </h2><p>You have entered your email adress in OSMBC.</p><p>If you would like to use this email address for OSMBC click on this link: <a href="https://testosm.bc/usert/1?validation=' + code + '">LINK TO VALIDATE YOUR EMAIL</a>. This will lead you to your user settings.</p><p>If you would like to check your User Settings without accepting the new email go to <a href="https://testosm.bc/usert/1">User Settings</a>.</p><p>OSMBC has a wide range of email settings, read the description carefully, not to overfill your mail box.</p><p>Thanks for supporting weeklyOSM & Wochennotiz.</p><p>Have fun with OSMBC. </p><p>Christoph (TheFive).</p>';

            var expectedText = "WELCOME \nYou have entered your email adress in OSMBC.\n\nIf you would like to use this email address for OSMBC click on this link: LINK\nTO VALIDATE YOUR EMAIL\n[https://testosm.bc/usert/1?validation=" + code + "]. This\nwill lead you to your user settings.\n\nIf you would like to check your User Settings without accepting the new email go\nto User Settings [https://testosm.bc/usert/1].\n\nOSMBC has a wide range of email settings, read the description carefully, not to\noverfill your mail box.\n\nThanks for supporting weeklyOSM & Wochennotiz.\n\nHave fun with OSMBC. \n\nChristoph (TheFive).";

            should(result.html).eql(expectedMail);
            should(result.text).eql(expectedText);
            should(mailChecker.getCall(0).args[0]).eql(
              { from: "noreply@gmail.com",
                to: "WelcomeMe@newemail.org",
                subject: "[TESTBC] Welcome to OSMBC",
                html: expectedMail,
                text: expectedText });

            // Email is send out, now check email Verification first with wrong code
            user.validateEmail({ OSMUser: "WelcomeMe" }, "wrong code", function(err) {
              should(err).eql(
                new HttpError(409, "Wrong Validation Code for EMail for user >WelcomeMe<"));

              user.validateEmail({ OSMUser: "Not Me" }, code, function(err) {
                should(err).eql(
                  new HttpError(409, "Wrong User: expected >WelcomeMe< given >Not Me<"));
                // and now with correct code
                user.validateEmail({ OSMUser: "WelcomeMe" }, code, function(err) {
                  should.not.exist(err);
                  should(user.email).eql("WelcomeMe@newemail.org");
                  should.not.exist(user.emailValidationKey);
                  bddone();
                });
              });
            });
          }, 500);
        });
      });
    });
  });
});
