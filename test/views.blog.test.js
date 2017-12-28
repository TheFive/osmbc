"use strict";

var async = require("async");
var testutil = require("./testutil.js");
var nock = require("nock");
var should  = require("should");
var request   = require("request");
var path = require("path");
var fs = require("fs");
var mockdate = require("mockdate");

var config = require("../config.js");

var configModule = require("../model/config.js");
var blogModule   = require("../model/blog.js");
var userModule   = require("../model/user.js");





describe("views/blog", function() {
  this.timeout(100000);
  let baseLink;
  var data;
  let jar  = null;

  describe("export", function() {
    before(function(bddone) {
      testutil.clearDB(bddone);
    });
    beforeEach(function(bddone) {
      var file =  path.resolve(__dirname, "data", "views.blog.export.1.json");
      jar = request.jar();
      data = JSON.parse(fs.readFileSync(file));
      baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
      nock("https://hooks.slack.com/")
        .post(/\/services\/.*/)
        .times(999)
        .reply(200, "ok");

      process.env.TZ = "Europe/Amsterdam";
      async.series([
        testutil.importData.bind(null, data),
        testutil.startServer.bind(null, "USER1"),
        configModule.initialise
      ], bddone);
    });
    afterEach(function(bddone) {
      nock.cleanAll();
      testutil.stopServer(bddone);
    });
    it("should generate preview as html", function(bddone) {
      async.series([
        function(cb) {
          var opts = {
            jar: jar,
            url: baseLink + "/blog/" + data.blogName + "/preview?lang=DE&download=true",
            method: "get"
          };
          request(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            let file =  path.resolve(__dirname, "data", "views.blog.export.1.html");
            let expectation =  fs.readFileSync(file, "UTF8");

            should(testutil.equalHtml(body, expectation)).be.True();

            cb();
          });
        }
      ], bddone);
    });
    it("should generate preview as markdown", function(bddone) {
      async.series([

        function(cb) {
          var opts = {
            jar: jar,
            url: baseLink + "/blog/" + data.blogName + "/preview?lang=DE&markdown=true&download=true",
            method: "get"
          };
          request(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            let file =  path.resolve(__dirname, "data", "views.blog.export.1.md");
            let expectation =  fs.readFileSync(file, "UTF8");

            should(body).eql(expectation);
            cb();
          });
        }
      ], bddone);
    });
  });
  describe("status Functions", function() {
    beforeEach(function(bddone) {
      mockdate.set(new Date("2016-05-25T19:00:00Z"));
      jar = request.jar();
      baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
      nock("https://hooks.slack.com/")
        .post(/\/services\/.*/)
        .times(999)
        .reply(200, "ok");

      process.env.TZ = "Europe/Amsterdam";
      async.series([
        testutil.importData.bind(null, {clear: true, blog: [{name: "blog"}], user: [{OSMUser: "TheFive", access: "full", mainLang: "DE"}]}),
        testutil.startServerWithLogin.bind(null, "TheFive",jar),
        configModule.initialise
      ], bddone);
    });
    afterEach(function(bddone) {
      mockdate.reset();
      nock.cleanAll();
      testutil.stopServer(bddone);
    });
    it("should close a blog", function(bddone) {
      async.series([

        function(cb) {
          var opts = {
            url: baseLink + "/blog/blog?setStatus=closed",
            jar: jar,
            method: "get",
            headers: {
              Referer: baseLink + "/blog/blog"
            }
          };
          request(opts, function (err, res, body) {
            should.not.exist(err);
            should(res.statusCode).eql(200);
            body.should.containEql("closed");
            blogModule.findOne({name: "blog"}, function(err, blog) {
              should.not.exist(err);
              should(blog.status).eql("closed");
              cb();
            });
          });
        }
      ], bddone);
    });
    it("should start a review", function(bddone) {
      async.series([

        function(cb) {
          var opts = {
            url: baseLink + "/blog/blog/setReviewComment",
            jar: jar,
            form: {lang: "DE", text: "startreview"},
            headers: {
              Referer: baseLink + "/blog/blog"
            }
          };
          request.post(opts, function (err, res) {
            should.not.exist(err);
            should(res.statusCode).eql(302);

            blogModule.findOne({name: "blog"}, function(err, blog) {
              should.not.exist(err);
              should(blog.reviewCommentDE).eql([{
                text: "startreview",
                timestamp: "2016-05-25T19:00:00.000Z",
                user: "TheFive"
              }]);
              cb();
            });
          });
        }
      ], bddone);
    });
  });
  describe("browser tests", function() {
    var browser;
    beforeEach(function(bddone) {
      process.env.TZ = "Europe/Amsterdam";
      mockdate.set(new Date("2016-05-25T19:00:00Z"));
      nock("https://hooks.slack.com/")
        .post(/\/services\/.*/)
        .times(999)
        .reply(200, "ok");
      async.series([
        testutil.importData.bind(null, JSON.parse(fs.readFileSync(path.join(__dirname, "data", "DataWN290.json"), "UTF8"))),
        function createUser(cb) { userModule.createNewUser({OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN"}, cb); },
        testutil.startServer.bind(null, "TheFive")
      ], function(err) {
        browser = testutil.getBrowser();
        bddone(err);
      });
    });
    afterEach(function(bddone) {
      mockdate.reset();
      testutil.stopServer(bddone);
    });
    describe("Blog Display", function() {
      it("should show Overview with some configurations", function(bddone) {
        async.series([
          browser.visit.bind(browser, "/blog/WN290"),
          browser.assert.expectHtml.bind(browser, "blog_wn290_overview.html"),
          browser.click.bind(browser, 'span[name="choose_showNumbers"]'),
          browser.visit.bind(browser, "/blog/WN290"), // just call again to set zombie.js referer correct
          browser.click.bind(browser, 'span[name="choose_showMail"]'),
          browser.visit.bind(browser, "/blog/WN290"), // just call again to set zombie.js referer correct
          browser.click.bind(browser, 'span[name="choose_showVisibleLanguages"]'),
          browser.visit.bind(browser, "/blog/WN290"), // just call again to set zombie.js referer correct
          browser.click.bind(browser, 'span[name="choose_showCollector"]'),
          browser.visit.bind(browser, "/blog/WN290"), // just call again to set zombie.js referer correct
          browser.click.bind(browser, 'span[name="choose_showEditor"]'),
          browser.visit.bind(browser, "/blog/WN290"), // just call again to set zombie.js referer correct
          browser.click.bind(browser, 'span[name="choose_showColoredUser"]'),
          browser.visit.bind(browser, "/blog/WN290"), // just call again to set zombie.js referer correct
          browser.click.bind(browser, 'span[name="choose_showLanguages"]'),
          browser.visit.bind(browser, "/blog/WN290"), // just call again to set zombie.js referer correct
          browser.visit.bind(browser, "/blog/WN290"),
          browser.visit.bind(browser, "/blog/WN290"), // just call again to set zombie.js referer correct
          browser.assert.expectHtml.bind(browser, "blog_wn290_overview_withglab.html")
        ], bddone);
      });
      it("should show Full View", function(bddone) {
        async.series([
          browser.visit.bind(browser, "/blog/WN290?tab=full"),
          browser.assert.expectHtml.bind(browser, "blog_wn290_full.html")
        ], bddone);
      });
      it("should show Full View and close language", function(bddone) {
        async.series([
          browser.visit.bind(browser, "/blog/WN290?tab=full"),
          browser.pressButton.bind(browser, "#closebutton"),
          function(cb) {
            blogModule.find({name: "WN290"}, function(err, blog) {
              should.not.exist(err);
              should(blog.length).eql(1);
              should(blog[0].closeDE).be.True();
              cb();
            });
          }
        ], bddone);
      });
      it("should show Review View", function(bddone) {
        async.series([
          browser.visit.bind(browser, "/blog/WN290?tab=review"),
          browser.assert.expectHtml.bind(browser, "blog_wn290_review.html")
        ], bddone);
      });
      it("should show Statistic View", function(bddone) {
        async.series([
          browser.visit.bind(browser, "/blog/WN290/stat"),
          browser.assert.expectHtml.bind(browser, "blog_wn290_stat.html")
        ], bddone);
      });
      it("should show edit View", function(bddone) {
        async.series([
          browser.visit.bind(browser, "/blog/edit/WN290"),
          browser.assert.expectHtml.bind(browser, "blog_wn290_edit.html")
        ], bddone);
      });
      it("should show the Blog List", function(bddone) {
        async.series([
          browser.visit.bind(browser, "/blog/list?status=edit"),
          browser.assert.expectHtml.bind(browser, "blog_list.html")
        ], bddone);
      });
    });
  });
});
