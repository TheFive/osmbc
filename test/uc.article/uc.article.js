"use strict";

/* jshint ignore:start */

var async = require("async");
var path = require("path");
var fs = require("fs");
var nock = require("nock");
var should = require("should");
var config = require("../../config.js");
var testutil = require("../testutil.js");
var userModule = require("../../model/user.js");
var articleModule = require("../../model/article.js");
var blogModule = require("../../model/blog.js");



var maxTimer = 20000;



describe("uc.article", function() {
  this.timeout(10000);
  var browser;
  var articleId;

  beforeEach(async function() {
    nock("https://hooks.slack.com/")
      .post(/\/services\/.*/)
      .times(999)
      .reply(200, "ok");
    testutil.startServerSync();
    await testutil.clearDB();

    await userModule.createNewUser({OSMUser: "TheFive", access: "full", language: "DE", mainLang: "DE",secondLang:"EN",email:"a@b.c"});
    await blogModule.createNewBlog({OSMUser: "test"}, {name: "blog"});
    await articleModule.createNewArticle({blog: "blog", collection: "http://www.test.dä/holla", markdownDE: "[Text](http://www.test.dä/holla) lorem ipsum dolores.", markdownEN: "[Text](http://www.test.dä/holla) lerom upsim deloros."});
    await articleModule.createNewArticle({blog: "blog", collection: "http://www.tst.äd/holla", markdownDE: "[Text](http://www.tst.äd/holla) ist eine gute Referenz."});
    await articleModule.createNewArticle({blog: "undef blog", collection: "http://www.tst.äd/holla", markdownDE: "[Text](http://www.tst.äd/holla) ist eine gute Referenz."});
    let article = await articleModule.createNewArticle({blog: "blog", collection: "Link1: http://www.test.dä/holla and other"});
    articleId = article.id;
    browser = await testutil.getNewBrowser("TheFive");
  });
  afterEach(function(bddone) {
    nock.cleanAll();
    testutil.stopServer(bddone);
  });
  describe("Scripting Functions", function() {
    this.timeout(maxTimer);
    beforeEach(async function() {
      await browser.visit("/article/" + articleId);
    });
    it("should have converted collection correct", function() {
      browser.assert.text("#collection", "Link1: http://www.test.dä/holla and other");
    });
    it("should isURL work on page", function(bddone) {
      var file =  path.resolve(__dirname, ".." , "data", "util.data.json");
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
    this.timeout(maxTimer * 3);
    beforeEach(async function() {
      await browser.visit("/article/" + articleId);
    });
    it("should have converted collection correct", async function() {
      browser.assert.text("#collection", "Link1: http://www.test.dä/holla and other");
    });
    function checkLink(link,langVisible, langTranslation,displayLink) {
      if (!langTranslation) langTranslation = langVisible;
      if (!displayLink) displayLink = link;
      let transText = "MISSING TRANSTEXT in TEST";
      if (langVisible === "DE") transText = "automatische [Übersetzung]";
      if (langVisible === "EN") transText = "automatic [translation]";
      // Check the visible Link
      browser.assert.text('#linkArea a[href="'+link+'"]', displayLink);

      // Check the translation
      browser.assert.text('#linkArea a[href="https://translate.google.com/translate?sl=auto&tl='+langTranslation+'&u='+link+'"]', langVisible);
      browser.assert.attribute('#linkArea a[href="https://translate.google.com/translate?sl=auto&tl='+langTranslation+'&u='+link+'"]', "ondragstart","dragstart(event,'("+transText+"(https://translate.google.com/translate?sl=auto&tl="+langTranslation+"&u="+link+"))');");

    }
    it("should ignore brackets in a collection (No Markdown)", async function() {
      browser.fill("#collection", "Some collection [link](https://www.openstreetmap.org/a_brilliant_map in Markdown");
      checkLink("https://www.openstreetmap.org/a_brilliant_map","DE");
      checkLink("https://www.openstreetmap.org/a_brilliant_map","EN");
    });
    it("should work on links with queries", async function() {
      browser.fill("#collection", "https://www.site.org/didl?query=some");
      checkLink("https://www.site.org/didl?query=some","DE");
      checkLink("https://www.site.org/didl?query=some","EN");
    });
    it("should show multiple links from collection", async function() {

      checkLink("http://www.test.dä/holla","DE");
      checkLink("http://www.test.dä/holla","EN");

      // Change collection with two links
      browser.fill("collection", "https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE\nhere: http://www.openstreetmap.org/user/Severák/diary/37681");

      checkLink("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE","DE","DE","https://productforums.google.com/forum/# . . . v-kzE");
      checkLink("https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE","EN","EN","https://productforums.google.com/forum/# . . . v-kzE");

      checkLink("http://www.openstreetmap.org/user/Severák/diary/37681","DE","DE","http://www.openstreetmap.org/user/Severá . . . 37681");
      checkLink("http://www.openstreetmap.org/user/Severák/diary/37681","EN","EN","http://www.openstreetmap.org/user/Severá . . . 37681");

    });
  });
  describe("QueryParameters", function() {
    this.timeout(maxTimer);
    it("should set markdown to notranslation", async function() {
      let article = await articleModule.findById(articleId);
      article.markdownDE = "Text";
      article.markdownEN = "";
      article.markdownES = "";
      await article.save();
      await browser.visit("/article/" + articleId + "?notranslation=true");
      article = await articleModule.findById(articleId);
      should(article.markdownDE).eql("Text");
      should(article.markdownEN).eql("no translation");
      should(article.markdownES).eql("");
    });
  });
  describe("onchangeCollection", function() {
    this.timeout(maxTimer * 3);
    beforeEach(async function() {
      await browser.visit("/language?lang2=none");
      await browser.visit("/article/" + articleId);
    });
    it("should show the links from collection field under the field", async function() {
      var file =  path.resolve(__dirname, ".." ,"data", "util.data.json");
      var data = JSON.parse(fs.readFileSync(file));
      for (var i = 0; i < data.isURLArray.length; i++) {
        var link = data.isURLArray[i];
        var linkUrl = data.isURLArrayEncoded[i];
        var displayUrl = data.isURLArrayDisplay[i];

        browser.fill("#collection",link);
        await browser.keyUp("#collection", 30);
        should(browser.document.getElementById("linkArea").innerHTML).equal('<p><a class="label label-default" href="' + linkUrl + '" target="_blank">' + displayUrl + '</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=' + linkUrl + '" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=' + linkUrl + '))\');">DE</a><br>\n</p>');
      }
    });
    it("should show multiple links from collection field under the field",async function() {
      browser.fill("#collection","Wumbi told something about https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE \n here: http://www.openstreetmap.org/user/Severák/diary/37681");
      await browser.keyUp("#collection", 30);
      should(browser.document.getElementById("linkArea").innerHTML).equal('<p><a class="label label-default" href="https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE" target="_blank">https://productforums.google.com/forum/# . . . v-kzE</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE))\');">DE</a><br>\n<a class="label label-default" href="http://www.openstreetmap.org/user/Severák/diary/37681" target="_blank">http://www.openstreetmap.org/user/Severá . . . 37681</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=http://www.openstreetmap.org/user/Severák/diary/37681" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=http://www.openstreetmap.org/user/Severák/diary/37681))\');">DE</a><br>\n</p>');
    });
    it("should show multiple links from collection only separated by carrige return", async function() {
      browser.fill("#collection","https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE\nhere: http://www.openstreetmap.org/user/Severák/diary/37681");
      await browser.keyUp("#collection", 30);
      should(browser.document.getElementById("linkArea").innerHTML).equal('<p><a class="label label-default" href="https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE" target="_blank">https://productforums.google.com/forum/# . . . v-kzE</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE))\');">DE</a><br>\n<a class="label label-default" href="http://www.openstreetmap.org/user/Severák/diary/37681" target="_blank">http://www.openstreetmap.org/user/Severá . . . 37681</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=http://www.openstreetmap.org/user/Severák/diary/37681" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=http://www.openstreetmap.org/user/Severák/diary/37681))\');">DE</a><br>\n</p>');
    });
    it("should ignore brackets in a link (No Markdown!)", async function() {
      browser.fill("#collection", "Some collection https://www.openstreetmap.org/a_brilliant_map Markdown");
      await browser.keyUp("#collection", 30);
      should(browser.document.getElementById("linkArea").innerHTML).equal('<p><a class="label label-default" href="https://www.openstreetmap.org/a_brilliant_map" target="_blank">https://www.openstreetmap.org/a_brilliant_map</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://www.openstreetmap.org/a_brilliant_map" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://www.openstreetmap.org/a_brilliant_map))\');">DE</a><br>\n</p>');
    });
  });

  describe("onchangeMarkdown", function() {
    this.timeout(maxTimer * 3);
    beforeEach(async function() {
      await browser.visit("/language?lang2=none");
      await browser.visit("/article/" + articleId);
    });
    it("should warn on double links", async function() {
      browser.fill("#markdownDE","https://a.link is referenced tiwce https://a.link");
      await browser.keyUp("#markdownDE", 30);
      should(browser.document.getElementById("textDE").innerHTML).equal("Link https://a.link is used twice in markdown");
    });
  });

  describe("Comments", function() {
    it("should add and change a comment of an article", async function() {
      this.timeout(maxTimer * 2);
      await browser.visit("/article/1");

      browser.fill("comment", "Add a test comment");
      await browser.pressButton("AddComment");

      let article = await articleModule.findById(1);

      should(article.commentList.length).eql(1);
      should(article.commentList[0].text).eql("Add a test comment");
      should(article.commentList[0].user).eql("TheFive");
      await browser.click('span[id="EditComment0"]');

      browser.fill("comment", "And Change It");
      await browser.pressButton("update");

      article = await articleModule.findById(1);

      should(article.commentList.length).eql(1);
      should(article.commentList[0].text).eql("And Change It");
      should(article.commentList[0].user).eql("TheFive");
    });
  });
  describe("Translate",function(){
    it("should call and translate an article",async function(){
      this.timeout(maxTimer*2);
      await browser.visit("/article/4");

      nock("http://localhost:" + config.getServerPort(),{allowUnmocked: false})
        .post("/article/translate/deepl/de/en","text=%5BText%5D(http%3A%2F%2Fwww.tst.%C3%A4d%2Fholla)+ist+eine+gute+Referenz.")
        .reply(200,"[Text](http://www.test.de/holla) is a good reference.");
      await browser.pressButton("translateDEEN");

      //should(translateNock.isDone()).be.True();
      should(browser.query("#markdownEN").value).eql("[Text](http://www.test.de/holla) is a good reference.");
    });
  });
  describe("Article List",function(){
    it("should be called from index page",async function(){
      this.timeout(maxTimer * 2);
      await browser.visit("/osmbc");
      await browser.click("li.dropdown a");
      await browser.click("li#article ul.dropdown-menu li:nth-child(4) a");
      browser.assert.expectHtmlSync("uc.article","articlelist");
    });
  });
});

/* jshint ignore:end */