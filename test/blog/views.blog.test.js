"use strict";

const async = require("async");
const testutil = require("../testutil.js");
const nock = require("nock");
const should  = require("should");
const request   = require("request");
const path = require("path");
const fs = require("fs");
const mockdate = require("mockdate");
const initialise = require("../../util/initialise.js");

const config = require("../../config.js");

const blogModule   = require("../../model/blog.js");
const userModule   = require("../../model/user.js");





describe("views/blog", function() {
  this.timeout(100000);
  let baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
  var data;
  let jar  = null;
  let nockLoginPage;
  beforeEach(async function() {
    jar = request.jar();
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    nockLoginPage = testutil.nockLoginPage();
    process.env.TZ = "Europe/Amsterdam";
    await initialise.initialiseModules();
    testutil.startServerSync();
  });
  afterEach(async function() {
    nock.cleanAll();
    testutil.stopServer();
  });

  describe("export", function() {
    beforeEach(async function() {
      var file =  path.resolve(__dirname, "views.blog.export.1.json");
      data = JSON.parse(fs.readFileSync(file));
      await testutil.importData(data);
      testutil.startServerSync();
    });
    it("should generate preview as html", function(bddone) {
      testutil.nockLoginPage();
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
            let file =  path.resolve(__dirname, "views.blog.export.1.html");
            let expectation =  fs.readFileSync(file, "UTF8");

            should(testutil.equalHtml(body, expectation)).be.True();

            cb();
          });
        }
      ], bddone);
    });
    it("should generate preview as markdown", function(bddone) {
      testutil.nockLoginPage();
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
            let file =  path.resolve(__dirname, "views.blog.export.1.md");
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

      async.series([
        testutil.importData.bind(null, {clear: true, blog: [{name: "blog"}], user: [{OSMUser: "TheFive", access: "full", mainLang: "DE"}]}),
        testutil.startServerWithLogin.bind(null, "TheFive", jar)
      ], bddone);
    });
    afterEach(function(bddone) {
      mockdate.reset();
      return bddone();
    });
    it("should be able to manage a blog lifetime",async function(){
      let b = await testutil.getNewBrowser("TheFive");

      await b.visit("/osmbc");

      // go to admin page and create a new blog
      await b.click("a#adminlink");


      await b.click("a#createblog");
      // Confirm that you really want to create a blog
      await b.click("button#createBlog");

      // click on the second blog in the table (thats the WN251 new created)
      await b.click("tbody>tr:nth-child(2)>td>a");

      // Have a look at the blog
      b.assert.expectHtmlSync("blog","WN251OpenMode.html");

      // Edit the blog, select EDIT status and stave it
      await b.click("a#editBlogDetail");
      await b.click("a.btn.btn-primary#edit");
      await b.select("status","edit");
      await b.click("input[value='OK']");

      // go to the blog view with the articles
      await b.click("a[href='/blog/WN251']");




      b.assert.expectHtmlSync("blog","actual.html");



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
      testutil.nockLoginPage();
      async.series([

        function(cb) {
          var opts = {
            url: baseLink + "/blog/blog/setReviewComment",
            jar: jar,
            followRedirect: true,
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
      mockdate.set(new Date("2016-05-25T19:00:00Z"));
      async.series([
        testutil.importData.bind(null, JSON.parse(fs.readFileSync(path.join(__dirname, "DataWN290.json"), "UTF8"))),
        function createUser(cb) { userModule.createNewUser({OSMUser: "TheFive", access: "full", mainLang: "DE", secondLang: "EN"}, cb); },
        testutil.startServer.bind(null, "TheFive")
      ], function(err) {
        browser = testutil.getBrowser();
        bddone(err);
      });
    });
    afterEach(function(bddone) {
      mockdate.reset();
      return bddone();
    });
    describe("Blog Display", function() {
      it("should show Overview with some configurations", async function() {
        await browser.visit("/blog/WN290");
        browser.assert.expectHtmlSync("blog", "blog_wn290_overview.html"),
        await browser.click('span[name="choose_showNumbers"]'),
        await browser.visit("/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click( 'span[name="choose_showMail"]'),
        await browser.visit( "/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click( 'span[name="choose_showVisibleLanguages"]'),
        await browser.visit( "/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click( 'span[name="choose_showCollector"]'),
        await browser.visit( "/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click( 'span[name="choose_showEditor"]'),
        await browser.visit( "/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click( 'span[name="choose_showColoredUser"]'),
        await browser.visit( "/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.click( 'span[name="choose_showLanguages"]'),
        await browser.visit( "/blog/WN290"), // just call again to set zombie.js referer correct
        await browser.visit( "/blog/WN290"),
        await browser.visit( "/blog/WN290"), // just call again to set zombie.js referer correct
        browser.assert.expectHtmlSync("blog", "blog_wn290_overview_withglab.html");
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
