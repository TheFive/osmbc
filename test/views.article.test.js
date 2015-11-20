var async = require('async');
var path = require('path'); 
var fs = require('fs');
var should = require('should');
var testutil = require('./testutil.js');

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");







describe('views/article', function() {
  var browser;
  var articleId;
  var server;
  before(function(bddone) {
    async.series([
      testutil.clearDB,
      function createUser(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full"},cb); },
      function createArticle(cb) {articleModule.createNewArticle({blog:"blog",collection:"test"},function(err,article){
        if (article) articleId = article.id;
        cb(err);
      }); },
      function createBrowser(cb) {testutil.startBrowser(function(err,result){browser=result;cb()})}
    ], function(err) {
      bddone();
      
    })
  });


  describe("Scripting Functions",function() {
    before(function(done) {
      this.timeout(4000);
      browser.visit('/article/'+articleId, done);
    });
    it('should isURL work on page' ,function() {
      var file =  path.resolve(__dirname,'data', "util.data.json");
      var data = JSON.parse(fs.readFileSync(file));
      for (var i=0;i<data.isURLArray.length;i++) {
        should(browser.evaluate("isURL('"+data.isURLArray[i]+"')")).is.True();
      }
      for (var i=0;i<data.isNoURLArray.length;i++) {
        should(browser.evaluate("isURL('"+data.isNoURLArray[i]+"')")).is.False();
      }
    });
  
    context('generateMarkdownLink2',function() {
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
      })
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
      })
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
      })
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
      })
    })
  })
});