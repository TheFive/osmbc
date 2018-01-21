"use strict";

var async = require("async");
var nock = require("nock");
var cheerio = require("cheerio");
var should = require("should");
var testutil = require("./testutil.js");
var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");
var blogModule = require("../model/blog.js");






describe("views/collect", function() {
  this.timeout(100000);
  var browser;
  var articleId;
  before(function(bddone) {
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    bddone();
  });
  let nockLoginPage;
  beforeEach(function(bddone) {
    nockLoginPage = testutil.nockLoginPage();
    async.series([
      testutil.clearDB,
      (cb) => { userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "DE", mainLang: "DE",secondLang:"EN"}, cb); },
      (cb) => { blogModule.createNewBlog({OSMUser: "test"}, {name: "blog"}, cb); },
      (cb) => { articleModule.createNewArticle({blog: "blog", collection: "http://www.test.dä/holla", markdownDE: "[Text](http://www.test.dä/holla) lorem ipsum dolores.", markdownEN: "[Text](http://www.test.dä/holla) lerom upsim deloros."}, cb); },
      (cb) => { articleModule.createNewArticle({blog: "blog", collection: "http://www.tst.äd/holla", markdownDE: "[Text](http://www.tst.äd/holla) ist eine gute Referenz."}, cb); },
      (cb) => {
        articleModule.createNewArticle({blog: "blog", collection: "Link1: http://www.test.dä/holla and other"}, function(err, article) {
          if (article) articleId = article.id;
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
    nock.removeInterceptor(nockLoginPage);
    testutil.stopServer(bddone);
  });

  after(function(bddone) {
    nock.cleanAll();
    bddone();
  });

  describe("Menu Fuctions", function() {
    it("should call search with test", function(bddone) {
      this.timeout(5000);
      async.series([
        browser.visit.bind(browser, "/article/search"),
        function(cb) { browser.fill("search", "http://www.test.dä/holla"); cb(); },
        browser.pressButton.bind(browser, "SearchNow")
      ], function finalFunction(err) {
        should.not.exist(err);
        browser.assert.text("p#articleCounter", "Display 2 of 2 articles.");
        should.not.exist(err);
        bddone();
      });
    });
  });
  describe("Collect", function() {
    it("should search and store collected article", function(bddone) {
      browser.visit("/article/create", function(err) {
        should.not.exist(err);
        browser
          .fill("search", "searchfor")
          .pressButton("SearchNow", function(err) {
            should.not.exist(err);
            browser
              .fill("title", "Test Title for Article")
              .pressButton("OK", function(err) {
                should.not.exist(err);
                articleModule.find({title: "Test Title for Article"}, function(err, result) {
                  should.not.exist(err);
                  should.exist(result);
                  should(result.length).eql(1);
                  should(result[0].collection).eql("searchfor");
                  bddone();
                });
              });
          });
      });
    });
    it("should search and find existing article", function(bddone) {
      browser.visit("/article/create", function(err) {
        should.not.exist(err);
        browser
          .fill("search", "http://www.test.dä/holla")
          .pressButton("SearchNow", function(err) {
            should.not.exist(err);
            let c = cheerio.load(browser.html());
            let t = c("td:contains('and other')").text();
            should(t).eql("Link1: http://www.test.dä/holla and other");
            t = c("p:contains('dolores')").text();
            should(t).eql("Text lorem ipsum dolores.");

            bddone();
          });
      });
    });
    it("should search and store collected article for one language", function(bddone) {
      browser.visit("/article/create", function(err) {
        should.not.exist(err);
        browser
          .fill("search", "searchfor")
          .pressButton("SearchNow", function(err) {
            should.not.exist(err);
            browser
              .fill("title", "Test Title for Article")
              .click("button[id=OKLang]", function(err) {
                should.not.exist(err);
                articleModule.find({title: "Test Title for Article"}, function(err, result) {
                  should.not.exist(err);
                  should.exist(result);
                  // workaround, as zombie.js calles the submit two times
                  // should(result.length).eql(1);
                  should(result.length).eql(1);
                  should(result).eql([ ({
                    id: "6",
                    version: 2,
                    blog: "blog",
                    collection: "searchfor",
                    categoryEN: "-- no category yet --",
                    title: "Test Title for Article",
                    markdownEN: "no translation",
                    firstCollector: "TheFive" })]
                  );
                  bddone();
                });
              });
          });
      });
    });
  });
});
