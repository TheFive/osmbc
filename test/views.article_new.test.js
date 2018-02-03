"use strict";

var async = require("async");
var path = require("path");
var fs = require("fs");
var nock = require("nock");
var should = require("should");
var config = require("../config.js");
var testutil = require("./testutil.js");
var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");
var blogModule = require("../model/blog.js");



var maxTimer = 20000;



describe("views/article_new", function() {
  var browser;
  var articleId;
  let nockLoginPage;

  beforeEach(function(bddone) {
    nockLoginPage = testutil.nockLoginPage();
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    async.series([
      testutil.clearDB,
      (cb) => { userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "DE", mainLang: "DE",secondLang:"EN"}, cb); },
      (cb) => { blogModule.createNewBlog({OSMUser: "test"}, {name: "blog"}, cb); },
      (cb) => { articleModule.createNewArticle({blog: "blog", collection: "http://www.test.dä/holla", markdownDE: "[Text](http://www.test.dä/holla) lorem ipsum dolores.", markdownEN: "[Text](http://www.test.dä/holla) lerom upsim deloros."}, cb); },
      (cb) => { articleModule.createNewArticle({blog: "blog", collection: "http://www.tst.äd/holla", markdownDE: "[Text](http://www.tst.äd/holla) ist eine gute Referenz."}, cb); },
      (cb) => { articleModule.createNewArticle({blog: "undef blog", collection: "http://www.tst.äd/holla", markdownDE: "[Text](http://www.tst.äd/holla) ist eine gute Referenz."}, cb); },
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
    nock.cleanAll();
    testutil.stopServer(bddone);
  });
  describe("Scripting Functions", function() {
    beforeEach(function(done) {
      this.timeout(maxTimer);
      browser.visit("/article/" + articleId, function(err) {
        if (err) return done(err);
        browser.wait(1000, done);
      });
    });
    it("should isURL work on page", function(bddone) {
      var file =  path.resolve(__dirname, "data", "util.data.json");
      var data = JSON.parse(fs.readFileSync(file));
      for (var i = 0; i < data.isURLArray.length; i++) {
        should(browser.evaluate("isURL('" + data.isURLArray[i] + "')")).is.True();
      }
      for (i = 0; i < data.isNoURLArray.length; i++) {
        should(browser.evaluate("isURL('" + data.isNoURLArray[i] + "')")).is.False();
      }
      return bddone();
    });

    /* eslint-disable mocha/no-synchronous-tests */
    describe("generateMarkdownLink2", function() {
      it("should return NULL if no link is pasted", function() {
        should(browser.evaluate("generateMarkdownLink2(\
             {text:'the origin text.',startselection:0,endselection:0},\
             {text:'extend the origin text.',startselection:7,endselection:7})")).equal(null);
        should(browser.evaluate("generateMarkdownLink2(\
             {text:'the origin text.',startselection:16,endselection:16},\
             {text:'the origin text. At the end',startselection:27,endselection:27})")).equal(null);
        should(browser.evaluate("generateMarkdownLink2(\
             {text:'the origin text',startselection:11, endselection:11},\
             {text:'the origin in the middle text',startselection:25,endselection:25})")).equal(null);
      });
      it("should return NULL if no link is pasted with selection", function() {
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'ex the origin text.',startselection:0,endselection:2},\
          {text:'extend the origin text.',startselection:6,endselection:6})")).equal(null);
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text. TheEnd',startselection:17,endselection:23},\
          {text:'the origin text. At the end',startselection:27,endselection:27})")).equal(null);
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin --change here -- text',startselection:11,endselection:27},\
          {text:'the origin in the middle text',startselection:24,endselection:24})")).equal(null);
      });
      it("should return new value if link is inserted", function() {
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text.',startselection:0,endselection:0},\
          {text:'https://www.google.dethe origin text.',startselection:21,endselection:21})")).eql({text: "[](https://www.google.de)the origin text.", pos: 1});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text.',startselection:16,endselection:16},\
          {text:'the origin text.http://www.openstreetmap.de/sublink.html',starstselection:56,endselection:56 })")).eql({pos: 17, text: "the origin text.[](http://www.openstreetmap.de/sublink.html)"});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text.',startselection:4,endselection:4},\
          {text:'the http://www.google.deorigin text.',startselection:24,endselection:24})")).eql({pos: 5, text: "the [](http://www.google.de)origin text."});
      });
      it("should return new value if link is inserted with selection", function() {
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'Google the origin text.',startselection:0,endselection:6},\
          {text:'https://www.google.de/search the origin text.',startselection:28,endselection:28})")).eql({text: "[Google](https://www.google.de/search) the origin text.", pos: 38});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'Google the origin text.',startselection:0,endselection:6},\
          {text:'https://www.google.de the origin text.',startselection:21,endselection:21})")).eql({text: "[Google](https://www.google.de) the origin text.", pos: 31});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text.LINK',startselection:16,endselection:20},\
          {text:'the origin text.http://www.openstreetmap.de/sublink.html',startselection:56,endselection:56})")).eql({pos: 64, text: "the origin text.[LINK](http://www.openstreetmap.de/sublink.html)"});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the ---LINK---origin text.',startselection:4,endselection:14},\
          {text:'the http://www.google.deorigin text.',startselection:24,endselection:24})")).eql({pos: 38, text: "the [---LINK---](http://www.google.de)origin text."});
      });
    });
    /* eslint-enable mocha/no-synchronous-tests */
  });

  it.skip("should calculate a new height, if to many lines are used", function(bddone) {
    // Function is skipped, it is unclear, how to deal with modified height in zombie.js
    should(browser.evaluate("$('textarea#collection').innerHeight()")).eql(4);
    browser.fill("#collection", "\n\nhallole\n\n\nanother row");

    // Simulate a change Event manually
    browser.evaluate("$('textarea#collection').on('change')");
    should(browser.evaluate("$('textarea#collection').innerHeight()")).eql(8);
    bddone();
  });
  describe("Change Collection", function() {
    beforeEach(function(bddone) {
      this.timeout(maxTimer * 3);
      browser.visit("/article/" + articleId, function(err) {
        if (err) return bddone(err);
        setTimeout(function() { bddone(); }, 2500);
      });
    });
    it("should have converted collection correct", function(bddone) {
      browser.assert.text("#collection", "Link1: http://www.test.dä/holla and other");
      return bddone();
    });
    function checkLink(link,langVisible, langTranslation) {
      if (!langTranslation) langTranslation = langVisible;
      let transText = "MISSING TRANSTEXT in TEST";
      if (langVisible === "DE") transText = "automatische [Übersetzung]";
      if (langVisible === "EN") transText = "automatic [translation]";
      // Check the visible Link
      browser.assert.text('#linkArea a[href="'+link+'"]', link);

      // Check the translation
      browser.assert.text('#linkArea a[href="https://translate.google.com/translate?sl=auto&tl='+langTranslation+'&u='+link+'"]', langVisible);
      browser.assert.attribute('#linkArea a[href="https://translate.google.com/translate?sl=auto&tl='+langTranslation+'&u='+link+'"]', "ondragstart","dragstart(event,'("+transText+"(https://translate.google.com/translate?sl=auto&tl="+langTranslation+"&u="+link+"))');");

    }
    it("should ignore brackets in a collection (No Markdown)", function(bddone) {
      browser.fill("#collection", "Some collection [link](https://www.openstreetmap.org/a_brilliant_map in Markdown");
      checkLink("https://www.openstreetmap.org/a_brilliant_map","DE");
      checkLink("https://www.openstreetmap.org/a_brilliant_map","EN");
      bddone();
    });
    it("should work on links with queries", function(bddone) {
      browser.fill("#collection", "https://www.site.org/didl?query=some");
      checkLink("https://www.site.org/didl?query=some","DE");
      checkLink("https://www.site.org/didl?query=some","EN");
      bddone();
    });
    it("should show multiple links from collection", function(bddone) {

      checkLink("http://www.test.dä/holla","DE");
      checkLink("http://www.test.dä/holla","EN");

      // Change collection with two links
      browser.fill("collection", "https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE\nhere: http://www.openstreetmap.org/user/Severák/diary/37681");

      checkLink("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE","DE");
      checkLink("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE","EN");

      checkLink("http://www.openstreetmap.org/user/Severák/diary/37681","DE");
      checkLink("http://www.openstreetmap.org/user/Severák/diary/37681","EN");

      bddone();
    });
  });
  describe("QueryParameters", function() {
    it("should set markdown to notranslation", function(bddone) {
      this.timeout(maxTimer);
      articleModule.findById(articleId, function(err, article) {
        should.not.exist(err);
        article.markdownDE = "Text";
        article.markdownEN = "";
        article.markdownES = "";
        article.save(function(err) {
          should.not.exist(err);
          browser.visit("/article/" + articleId + "?notranslation=true", function(err) {
            should.not.exist(err);
            articleModule.findById(articleId, function(err, article) {
              should.not.exist(err);
              should(article.markdownDE).eql("Text");
              should(article.markdownEN).eql("no translation");
              should(article.markdownES).eql("");
              bddone();
            });
          });
        });
      });
    });
  });
  describe("Comments", function() {
    it("should add and change a comment of an article", function(bddone) {
      this.timeout(maxTimer * 2);
      browser.visit("/article/1", function(err) {
        should.not.exist(err);
        browser
          .fill("comment", "Add a test comment")
          .pressButton("AddComment", function(err) {
            should.not.exist(err);
            articleModule.findById(1, function (err, article) {
              should.not.exist(err);
              should(article.commentList.length).eql(1);
              should(article.commentList[0].text).eql("Add a test comment");
              should(article.commentList[0].user).eql("TheFive");
              browser.click('span[id="EditComment0"]', function(err) {
                should.not.exist(err);
                browser
                  .fill("comment", "And Change It")
                  .pressButton("update", function (err) {
                    should.not.exist(err);
                    articleModule.findById(1, function (err, article) {
                      should.not.exist(err);
                      should(article.commentList.length).eql(1);
                      should(article.commentList[0].text).eql("And Change It");
                      should(article.commentList[0].user).eql("TheFive");
                      bddone();
                    });
                  });
              });
            });
          });
      });
    });
  });
  describe("Translate",function(){
    it("should call and translate an article",function(bddone){
      this.timeout(maxTimer*2);
      browser.visit("/article/4", function(err) {
        should.not.exist(err);
        nock("http://localhost:" + config.getServerPort(),{allowUnmocked: false})
          .post("/article/translate/de/en","text=%5BText%5D(http%3A%2F%2Fwww.tst.%C3%A4d%2Fholla)+ist+eine+gute+Referenz.")
          .reply(200,"[Text](http://www.test.de/holla) is a good reference.");
        browser.pressButton("translateDEEN",function(err){
          should.not.exist(err);
          //should(translateNock.isDone()).be.True();
          should(browser.query("#markdownEN").value).eql("[Text](http://www.test.de/holla) is a good reference.");
          bddone();
        });
      });
    });
  });
  describe("Article List",function(){
    it("should be called from index page",function(bddone){
      this.timeout(maxTimer * 2);
      async.series([
        browser.visit.bind(browser, "/osmbc"),
        browser.click.bind(browser,"li.dropdown a"),
        browser.click.bind(browser,"li#article ul.dropdown-menu li:nth-child(4) a"),
        browser.assert.expectHtml.bind(browser, "articlelist.html")
      ], bddone);
    });
  });
});
