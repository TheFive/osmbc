"use strict";

var async = require('async');
var path = require('path'); 
var fs = require('fs');
var nock = require('nock');
var cheerio = require('cheerio');
var should = require('should');
var testutil = require('./testutil.js');
var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");
var blogModule = require("../model/blog.js");



var maxTimer = 30000;



describe('views/article', function() {
  var browser;
  var articleId;
  before(function(){
    nock('https://hooks.slack.com/')
      .post(/\/services\/.*/)
      .times(999)
      .reply(200,"ok");
  });
  beforeEach(function(bddone) {
    async.series([
      testutil.clearDB,
      function createUser(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full",language:"DE",mainLang:"DE"},cb); },
      function createBlog(cb) {blogModule.createNewBlog({OSMUser:"test"},{name:'blog'},cb);},
      function createArticle(cb) {articleModule.createNewArticle({blog:"blog",collection:"http://www.test.dä/holla",markdownDE:"[Text](http://www.test.dä/holla) lorem ipsum dolores.",markdownEN:"[Text](http://www.test.dä/holla) lorem ipsum dolores."},cb);},
      function createArticle(cb) {articleModule.createNewArticle({blog:"blog",collection:"Link1: http://www.test.dä/holla and other"},function(err,article){
        if (article) articleId = article.id;
        cb(err);
      }); },
      testutil.startServer.bind(null,"TheFive")
    ], function(err) {
      browser = testutil.getBrowser();
      bddone(err);
      
    });
  });
  afterEach(function(){
    testutil.stopServer();
  });
 
  after(function(bddone){
    nock.cleanAll();
    bddone();
  });

  describe("Menu",function(){
    it("should call search with test",function(bddone){
      this.timeout(5000);
      async.series([
        browser.visit.bind(browser,"/article/search"),
        function(cb){ browser.fill("search","http://www.test.dä/holla");cb();},
        browser.pressButton.bind(browser,"SearchNow")
      ],function finalFunction(err){
        browser.assert.text('p#articleCounter',"Display 2 of 2 articles.");
        should.not.exist(err);
        bddone();
      });

    });
  });

  describe("Scripting Functions",function() {
    beforeEach(function(done) {
      this.timeout(maxTimer);
      browser.visit('/article/'+articleId, function(err){
        if (err) return done(err);
        browser.wait(1000,done);
      });
    });
    it('should have converted collection correct',function(){
      browser.assert.text('#collection','Link1: http://www.test.dä/holla and other');
    });
    it('should isURL work on page' ,function() {
      var file =  path.resolve(__dirname,'data', "util.data.json");
      var data = JSON.parse(fs.readFileSync(file));
      for (var i=0;i<data.isURLArray.length;i++) {
        should(browser.evaluate("isURL('"+data.isURLArray[i]+"')")).is.True();
      }
      for (i=0;i<data.isNoURLArray.length;i++) {
        should(browser.evaluate("isURL('"+data.isNoURLArray[i]+"')")).is.False();
      }
    });
  
    describe('generateMarkdownLink2',function() {
      it('should return NULL if no link is pasted',function(){
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
      it('should return NULL if no link is pasted with selection',function(){
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
      it('should return new value if link is inserted',function(){
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text.',startselection:0,endselection:0},\
          {text:'https://www.google.dethe origin text.',startselection:21,endselection:21})")).eql({text:'[](https://www.google.de)the origin text.',pos:1});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text.',startselection:16,endselection:16},\
          {text:'the origin text.http://www.openstreetmap.de/sublink.html',starstselection:56,endselection:56 })")).eql({pos: 17,text:'the origin text.[](http://www.openstreetmap.de/sublink.html)'});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text.',startselection:4,endselection:4},\
          {text:'the http://www.google.deorigin text.',startselection:24,endselection:24})")).eql({pos:5,text:'the [](http://www.google.de)origin text.'});
      });
      it('should return new value if link is inserted with selection',function(){
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'Google the origin text.',startselection:0,endselection:6},\
          {text:'https://www.google.de/search the origin text.',startselection:28,endselection:28})")).eql({text:'[Google](https://www.google.de/search) the origin text.',pos:38});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'Google the origin text.',startselection:0,endselection:6},\
          {text:'https://www.google.de the origin text.',startselection:21,endselection:21})")).eql({text:'[Google](https://www.google.de) the origin text.',pos:31});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the origin text.LINK',startselection:16,endselection:20},\
          {text:'the origin text.http://www.openstreetmap.de/sublink.html',startselection:56,endselection:56})")).eql({pos: 64,text:'the origin text.[LINK](http://www.openstreetmap.de/sublink.html)'});
        should(browser.evaluate("generateMarkdownLink2(\
          {text:'the ---LINK---origin text.',startselection:4,endselection:14},\
          {text:'the http://www.google.deorigin text.',startselection:24,endselection:24})")).eql({pos:38,text:'the [---LINK---](http://www.google.de)origin text.'});
      });
    });
  });
  describe('Scripting Functions in Edit Mode',function() {
    beforeEach(function(done) {
      this.timeout(maxTimer*3);
      browser.visit('/article/'+articleId+'?edit=true&style=OVERVIEW', function(err){
 //     browser.visit('/article/'+articleId, function(err){
        if (err) return done(err);
        setTimeout(function(){done();},2000);
      });
    });

    describe('onchangeCollection',function(){
      it('should show the links from collection field under the field', function(bddone2){
          var file =  path.resolve(__dirname,'data', "util.data.json");
          var data = JSON.parse(fs.readFileSync(file));
          for (var i=0;i<data.isURLArray.length;i++) {
            var link = data.isURLArray[i];
            var linkUrl = data.isURLArrayEncoded[i];
          
            browser.document.getElementById('collection').value=link;
            browser.evaluate('onchangeCollection()');
            should(browser.document.getElementById('linkArea').innerHTML).equal('<p><a href="'+linkUrl+'" target="_blank">'+linkUrl+'</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u='+linkUrl+'" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u='+linkUrl+'))\');">DE</a><br>\n</p>');
          }
          bddone2();          
      });
      it('should show multiple links from collection field under the field', function(bddone){
      
        browser.document.getElementById('collection').value="Wumbi told something about https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE \n here: http://www.openstreetmap.org/user/Severák/diary/37681";
        browser.evaluate('onchangeCollection()');
        should(browser.document.getElementById('linkArea').innerHTML).equal('<p><a href="https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE" target="_blank">https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE))\');">DE</a><br>\n<a href="http://www.openstreetmap.org/user/Severák/diary/37681" target="_blank">http://www.openstreetmap.org/user/Severák/diary/37681</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=http://www.openstreetmap.org/user/Severák/diary/37681" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=http://www.openstreetmap.org/user/Severák/diary/37681))\');">DE</a><br>\n</p>');
        bddone();
      });
      it('should show multiple links from collection only separated by carrige return', function(bddone){

        browser.document.getElementById('collection').value="https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE\nhere: http://www.openstreetmap.org/user/Severák/diary/37681";
        browser.evaluate('onchangeCollection()');
        should(browser.document.getElementById('linkArea').innerHTML).equal('<p><a href="https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE" target="_blank">https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://productforums.google.com/forum/#!topic/map-maker/Kk6AG2v-kzE))\');">DE</a><br>\n<a href="http://www.openstreetmap.org/user/Severák/diary/37681" target="_blank">http://www.openstreetmap.org/user/Severák/diary/37681</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=http://www.openstreetmap.org/user/Severák/diary/37681" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=http://www.openstreetmap.org/user/Severák/diary/37681))\');">DE</a><br>\n</p>');
        bddone();
      });
      it('should ignore brackets in a link (e.g. Markdown)', function(bddone){

        browser.document.getElementById('collection').value="Some collection [link](https://www.openstreetmap.org/a_brilliant_map) in Markdown";
        browser.evaluate('onchangeCollection()');
        should(browser.document.getElementById('linkArea').innerHTML).equal('<p><a href="https://www.openstreetmap.org/a_brilliant_map" target="_blank">https://www.openstreetmap.org/a_brilliant_map</a>\n <a href="https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://www.openstreetmap.org/a_brilliant_map" target="_blank" ondragstart="dragstart(event,\'(automatische [Übersetzung](https://translate.google.com/translate?sl=auto&amp;tl=DE&amp;u=https://www.openstreetmap.org/a_brilliant_map))\');">DE</a><br>\n</p>');
        bddone();
      });
    });
  });
  describe('QueryParameters',function(){
    it('should set markdown to notranslation',function(bddone){
      this.timeout(maxTimer);
      articleModule.findById(articleId,function(err,article){
        article.markdownDE="Text";
        article.markdownEN="";
        article.markdownES="";
        article.save(function(err){
          should.not.exist(err);
          browser.visit("/article/"+articleId+"?notranslation=true",function(err){
            should.not.exist(err);
            articleModule.findById(articleId,function(err,article){
              should(article.markdownDE).eql("Text");
              should(article.markdownEN).eql("no translation");
              should(article.markdownES).eql("no translation");
              bddone();
            });
          });
        });
      });
    });
  });
  describe('Collect',function(){
    it('should search and store collected article',function(bddone){
      this.timeout(maxTimer);
      browser.visit("/article/create",function(err){
        should.not.exist(err);
        browser
          .fill("search","searchfor")
          .pressButton("SearchNow",function(err){
            should.not.exist(err);
            browser
              .fill("title","Test Title for Article")
              .pressButton("OK",function(err){
                should.not.exist(err);
                articleModule.find({title:"Test Title for Article"},function(err,result){
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
    it('should search and find existing article',function(bddone){
      this.timeout(maxTimer);
      browser.visit("/article/create",function(err){
        should.not.exist(err);
        browser
          .fill("search","http://www.test.dä/holla")
          .pressButton("SearchNow",function(err){
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
    it('should search and store collected article for one language',function(bddone){
      this.timeout(maxTimer);
      browser.visit("/article/create",function(err){
        should.not.exist(err);
        browser
          .fill("search","searchfor")
          .pressButton("SearchNow",function(err){
            should.not.exist(err);
            browser
              .fill("title","Test Title for Article")
              .click("button[id=OKLang]",function(err){
                should.not.exist(err);
                articleModule.find({title:"Test Title for Article"},function(err,result){
                  should.not.exist(err);
                  should.exist(result);
                  // workaround, as zombie.js calles the submit two times
                  //should(result.length).eql(1);
                  should(result).eql([   ({
                    id: '5',
                    version: 2,
                    blog: 'blog',
                    collection: 'searchfor',
                    categoryEN: '-- no category yet --',
                    title: 'Test Title for Article',
                    markdownEN: 'no translation',
                    firstCollector: 'TheFive' } )]
                  );
                  bddone();
                });
              });
          });
      });
    });
  });
  describe('Comments',function(){
    it('should add and change a comment of an article',function(bddone){
      this.timeout(maxTimer*2);
      browser.visit("/article/1",function(err){
        should.not.exist(err);
        browser
          .fill("comment","Add a test comment")
          .pressButton("AddComment",function(err){
            should.not.exist(err);
            articleModule.findById(1,function (err, article){
              should.not.exist(err);
              should(article.commentList.length).eql(1);
              should(article.commentList[0].text).eql("Add a test comment");
              should(article.commentList[0].user).eql("TheFive");

              browser.click('a[id="EditComment0"]',function(err) {
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
});