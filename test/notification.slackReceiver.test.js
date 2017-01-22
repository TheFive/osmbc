"use strict";



var should = require("should");
var async = require("async");


var testutil = require("./testutil.js");

var articleModule = require("../model/article.js");
var blogModule    = require("../model/blog.js");
var slackReceiver = require("../notification/slackReceiver.js");
var configModule  = require("../model/config.js");



var nock = require("nock");




function checkPostJson(check) {
  return function(body) {
    should(body).eql(check);
    return true;
  };
}



describe("notification/slackReceiver", function() {
  beforeEach(function (bddone) {
    async.series([
      testutil.clearDB,
      configModule.initialise,
      slackReceiver.initialise
    ], bddone);
  });
  afterEach(function(bddone) {
    nock.cleanAll();
    bddone();
  });
  describe("articles", function() {
    it("should slack message, when collecting article", function (bddone) {
      var slack = nock("https://hooks.slack.com/")
        .post("/services/osmde", checkPostJson(
          {"text": "<https://testosm.bc/article/1|Test Title> added to <https://testosm.bc/blog/WN789|WN789>\n",
            "username": "testbc(testuser)",
            "channel": "#osmbcarticle"}))
        .reply(200, "ok");
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave({OSMUser: "testuser"}, {version: 1, blog: "WN789", collection: "newtext", title: "Test Title"}, function(err) {
          should.not.exist(err);
          should(slack.isDone()).is.True();
          bddone();
        });
      });
    });
    it("should slack message, when changing a collection", function (bddone) {
      var slack = nock("https://hooks.slack.com/")
        .post("/services/osmde", checkPostJson(
          {"text": "<https://testosm.bc/article/1|Test Title> added to <https://testosm.bc/blog/WN789|WN789>\n",
            "username": "testbc(testuser)",
            "channel": "#osmbcarticle"}))
        .reply(200, "ok");
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave({OSMUser: "testuser"}, {version: 1, blog: "WN789", collection: "newtext", title: "Test Title"}, function(err) {
          should.not.exist(err);
          should(slack.isDone()).is.True();
          slack = nock("https://hooks.slack.com/")
            .post("/services/osmde", checkPostJson(
              {"text": "<https://testosm.bc/article/1|Test Title> changed collection\n",
                "username": "testbc(testuser)",
                "channel": "#osmbcarticle"}))
            .reply(200, "ok");
          article.setAndSave({OSMUser: "testuser"}, {version: 2, collection: "New Text was to short"}, function(err) {
            should.not.exist(err);
            should(slack.isDone()).is.True();
            bddone();
          });
        });
      });
    });
    it("should slack message, when adding comment (Old Format)", function (bddone) {
      var slack = nock("https://hooks.slack.com/")
        .post("/services/osmde", checkPostJson(
          {"text": "<https://testosm.bc/article/1|Test Title> added comment\n",
            "username": "testbc(testuser)",
            "channel": "#osmbcarticle"}))
        .reply(200, "ok");
      articleModule.createNewArticle(function(err, article) {
        should.not.exist(err);
        article.setAndSave({OSMUser: "testuser"}, {version: 1, blog: "WN789", title: "Test Title", comment: "Information for @User3"}, function(err) {
          should.not.exist(err);
          should(slack.isDone()).is.True();
          bddone();
        });
      });
    });
    it("should slack message, when adding comment", function (bddone) {
      var slack = nock("https://hooks.slack.com/")
        .post("/services/osmde", checkPostJson(
          {"text": "<https://testosm.bc/article/1|Test Title> added comment:\nInformation for @User3",
            "username": "testbc(testuser)",
            "channel": "#osmbcarticle"}))
        .reply(200, "ok");
      articleModule.createNewArticle({blog: "WN789", title: "Test Title"}, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({OSMUser: "testuser"}, "Information for @User3", function(err) {
          should.not.exist(err);
          should(slack.isDone()).is.True();
          bddone();
        });
      });
    });
    it("should slack message, when changing comment", function (bddone) {
      var slack = nock("https://hooks.slack.com/")
        .post("/services/osmde", checkPostJson(
          {"text": "<https://testosm.bc/article/1|Test Title> added comment:\nInformation for @User3",
            "username": "testbc(testuser)",
            "channel": "#osmbcarticle"}))
        .reply(200, "ok");
      articleModule.createNewArticle({blog: "WN789", title: "Test Title"}, function(err, article) {
        should.not.exist(err);
        article.addCommentFunction({OSMUser: "testuser"}, "Information for @User3", function(err) {
          should.not.exist(err);
          var slack2 = nock("https://hooks.slack.com/")
            .post("/services/osmde", checkPostJson(
              {"text": "<https://testosm.bc/article/1|Test Title> changed comment:\nInformation for all",
                "username": "testbc(testuser)",
                "channel": "#osmbcarticle"}))
            .reply(200, "ok");
          article.editComment({OSMUser: "testuser"}, 0, "Information for all", function(err) {
            should.not.exist(err);
            should(slack.isDone()).is.True();
            should(slack2.isDone()).is.True();
            bddone();
          });
        });
      });
    });
  });
  describe("blogs", function() {
    it("should slack message when creating a blog", function (bddone) {
      var slack1 = nock("https://hooks.slack.com/")
                .post("/services/osmde", checkPostJson(
                  {"text": "<https://testosm.bc/blog/WN251|WN251> was created\n",
                    "username": "testbc(testuser)",
                    "channel": "#osmbcblog"}))
                .reply(200, "ok");
      var slack2 = nock("https://hooks.slack.com/")
                .post("/services/theweeklyosm", checkPostJson(
                  {"text": "<https://testosm.bc/blog/WN251|WN251> was created\n",
                    "username": "testbc(testuser)",
                    "channel": "#osmbcblog"}))
                .reply(200, "ok");
      blogModule.createNewBlog({OSMUser: "testuser"}, function(err) {
        should.not.exist(err);
        should(slack1.isDone()).is.True();
        should(slack2.isDone()).is.True();

        bddone();
      });
    });
    it("should slack message, when change blog status", function (bddone) {
      var slack1a = nock("https://hooks.slack.com/")
                .post("/services/osmde", checkPostJson(
                  {"text": "<https://testosm.bc/blog/WN251|WN251> was created\n",
                    "username": "testbc(testuser)",
                    "channel": "#osmbcblog"}))
                .reply(200, "ok");
      var slack1b = nock("https://hooks.slack.com/")
                .post("/services/theweeklyosm", checkPostJson(
                  {"text": "<https://testosm.bc/blog/WN251|WN251> was created\n",
                    "username": "testbc(testuser)",
                    "channel": "#osmbcblog"}))
                .reply(200, "ok");
      blogModule.createNewBlog({OSMUser: "testuser"}, function(err, blog) {
        var slack2a = nock("https://hooks.slack.com/")
                  .post("/services/osmde", checkPostJson(
                    {"text": "<https://testosm.bc/blog/WN251|WN251> changed status to edit\n",
                      "username": "testbc(testuser)",
                      "channel": "#osmbcblog"}))
                  .reply(200, "ok");
        var slack2b = nock("https://hooks.slack.com/")
                  .post("/services/theweeklyosm", checkPostJson(
                    {"text": "<https://testosm.bc/blog/WN251|WN251> changed status to edit\n",
                      "username": "testbc(testuser)",
                      "channel": "#osmbcblog"}))
                  .reply(200, "ok");
        should.not.exist(err);
        blog.setAndSave({OSMUser: "testuser"}, {status: "edit"}, function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.True();
          should(slack2b.isDone()).is.True();


          bddone();
        });
      });
    });
    it("should slack message, when review status is set", function (bddone) {
      var slack1a = nock("https://hooks.slack.com/")
                .post("/services/osmde", checkPostJson(
                  {"text": "<https://testosm.bc/blog/blog|blog> was created\n",
                    "username": "testbc(testuser)",
                    "channel": "#osmbcblog"}))
                .reply(200, "ok");
      var slack1b = nock("https://hooks.slack.com/")
                .post("/services/theweeklyosm", checkPostJson(
                  {"text": "<https://testosm.bc/blog/blog|blog> was created\n",
                    "username": "testbc(testuser)",
                    "channel": "#osmbcblog"}))
                .reply(200, "ok");
      blogModule.createNewBlog({OSMUser: "testuser"}, {name: "blog", status: "edit"}, function(err, blog) {
        var slack2a = nock("https://hooks.slack.com/")
                  .post("/services/theweeklyosm", checkPostJson(
                    {"text": "<https://testosm.bc/blog/blog|blog>(ES) has been reviewed: I have reviewed",
                      "username": "testbc(testuser)",
                      "channel": "#osmbcblog"}))
                  .reply(200, "ok");
        var slack2b = nock("https://hooks.slack.com/")
                  .post("/services/osmde", checkPostJson(
                    {"text": "<https://testosm.bc/blog/blog|blog>(ES) has been reviewed: I have reviewed",
                      "username": "testbc(testuser)",
                      "channel": "#osmbcblog"}))
                  .reply(200, "ok");
        should.not.exist(err);
        blog.setReviewComment("ES", {OSMUser: "testuser"}, "I have reviewed", function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.True();
          should(slack2b.isDone()).is.False();
          nock.cleanAll();


          bddone();
        });
      });
    });
    it("should slack message, when review is marked as exported", function (bddone) {
      var slack1a = nock("https://hooks.slack.com/")
                .post("/services/osmde", checkPostJson(
                  {"text": "<https://testosm.bc/blog/blog|blog> was created\n",
                    "username": "testbc(testuser)",
                    "channel": "#osmbcblog"}))
                .reply(200, "ok");
      var slack1b = nock("https://hooks.slack.com/")
                .post("/services/theweeklyosm", checkPostJson(
                  {"text": "<https://testosm.bc/blog/blog|blog> was created\n",
                    "username": "testbc(testuser)",
                    "channel": "#osmbcblog"}))
                .reply(200, "ok");
      blogModule.createNewBlog({OSMUser: "testuser"}, {name: "blog", status: "edit"}, function(err, blog) {
        var slack2a = nock("https://hooks.slack.com/")
                  .post("/services/osmde", checkPostJson(
                    {"text": "<https://testosm.bc/blog/blog|blog>(DE) is exported to WordPress",
                      "username": "testbc(testuser)",
                      "channel": "#osmbcblog"}))
                  .reply(200, "ok");
        var slack2b = nock("https://hooks.slack.com/")
                  .post("/services/theweeklyosm", checkPostJson(
                    {"text": "<https://testosm.bc/blog/blog|blog>(DE) is exported to WordPress",
                      "username": "testbc(testuser)",
                      "channel": "#osmbcblog"}))
                  .reply(200, "ok");
        should.not.exist(err);
        blog.setReviewComment("DE", {OSMUser: "testuser"}, "markexported", function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.True();
          should(slack2b.isDone()).is.False();
          nock.cleanAll();


          bddone();
        });
      });
    });
    it("should slack message, when blog is closed", function (bddone) {
      var slack1a = nock("https://hooks.slack.com/")
        .post("/services/osmde", checkPostJson(
          {"text": "<https://testosm.bc/blog/blog|blog> was created\n",
            "username": "testbc(testuser)",
            "channel": "#osmbcblog"}))
        .reply(200, "ok");
      var slack1b = nock("https://hooks.slack.com/")
        .post("/services/theweeklyosm", checkPostJson(
          {"text": "<https://testosm.bc/blog/blog|blog> was created\n",
            "username": "testbc(testuser)",
            "channel": "#osmbcblog"}))
        .reply(200, "ok");
      blogModule.createNewBlog({OSMUser: "testuser"}, {name: "blog", status: "edit"}, function(err, blog) {
        var slack2a = nock("https://hooks.slack.com/")
          .post("/services/osmde", checkPostJson(
            {"text": "<https://testosm.bc/blog/blog|blog>(ES) has been closed",
              "username": "testbc(testuser)",
              "channel": "#osmbcblog"}))
          .reply(200, "ok");
        var slack2b = nock("https://hooks.slack.com/")
          .post("/services/theweeklyosm", checkPostJson(
            {"text": "<https://testosm.bc/blog/blog|blog>(ES) has been closed",
              "username": "testbc(testuser)",
              "channel": "#osmbcblog"}))
          .reply(200, "ok");
        should.not.exist(err);
        blog.closeBlog("ES", {OSMUser: "testuser"}, "true", function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.False();
          should(slack2b.isDone()).is.True();
          nock.cleanAll();

          bddone();
        });
      });
    });
    it("should slack message, when blog is reopened", function (bddone) {
      var slack1a = nock("https://hooks.slack.com/")
        .post("/services/osmde", checkPostJson(
          {"text": "<https://testosm.bc/blog/blog|blog> was created\n",
            "username": "testbc(testuser)",
            "channel": "#osmbcblog"}))
        .reply(200, "ok");
      var slack1b = nock("https://hooks.slack.com/")
        .post("/services/theweeklyosm", checkPostJson(
          {"text": "<https://testosm.bc/blog/blog|blog> was created\n",
            "username": "testbc(testuser)",
            "channel": "#osmbcblog"}))
        .reply(200, "ok");
      blogModule.createNewBlog({OSMUser: "testuser"}, {name: "blog", status: "edit"}, function(err, blog) {
        var slack2a = nock("https://hooks.slack.com/")
          .post("/services/osmde", checkPostJson(
            {"text": "<https://testosm.bc/blog/blog|blog>(ES) has been closed",
              "username": "testbc(testuser)",
              "channel": "#osmbcblog"}))
          .reply(200, "ok");
        var slack2b = nock("https://hooks.slack.com/")
          .post("/services/theweeklyosm", checkPostJson(
            {"text": "<https://testosm.bc/blog/blog|blog>(ES) has been closed",
              "username": "testbc(testuser)",
              "channel": "#osmbcblog"}))
          .reply(200, "ok");
        should.not.exist(err);
        blog.closeBlog("ES", {OSMUser: "testuser"}, true, function(err) {
          should.not.exist(err);
          should(slack1a.isDone()).is.True();
          should(slack1b.isDone()).is.True();
          should(slack2a.isDone()).is.False();
          should(slack2b.isDone()).is.True();
          slack2b = nock("https://hooks.slack.com/")
            .post("/services/theweeklyosm", checkPostJson(
              {"text": "<https://testosm.bc/blog/blog|blog>(ES) has been reopened",
                "username": "testbc(testuser)",
                "channel": "#osmbcblog"}))
            .reply(200, "ok");
          blog.closeBlog("ES", {OSMUser: "testuser"}, false, function(err) {
            should.not.exist(err);

            should(slack2b.isDone()).is.True();
            bddone();
          });
        });
      });
    });
  });
});
