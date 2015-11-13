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
    context('generateMarkdownLink',function() {
      it('should return NULL if no link is pasted',function(){
        should(browser.evaluate("generateMarkdownLink('the origin text.','extend the origin text.')")).equal(null);
        should(browser.evaluate("generateMarkdownLink('the origin text.','the origin text. At the end')")).equal(null);
        should(browser.evaluate("generateMarkdownLink('the origin text','the origin in the middle text')")).equal(null);
      })
      it('should return NULL if no link is pasted with selection',function(){
        should(browser.evaluate("generateMarkdownLink('ex the origin text.','extend the origin text.')")).equal(null);
        should(browser.evaluate("generateMarkdownLink('the origin text. TheEnd','the origin text. At the end')")).equal(null);
        should(browser.evaluate("generateMarkdownLink('the origin --change here -- text','the origin in the middle text')")).equal(null);
      })
      it('should return new value if link is inserted',function(){
        should(browser.evaluate("generateMarkdownLink('the origin text.','https://www.google.dethe origin text.')")).eql({text:'[](https://www.google.de)the origin text.',pos:1});
        should(browser.evaluate("generateMarkdownLink('the origin text.','the origin text.http://www.openstreetmap.de/sublink.html')")).eql({pos: 17,text:'the origin text.[](http://www.openstreetmap.de/sublink.html)'});
        should(browser.evaluate("generateMarkdownLink('the origin text.','the http://www.google.deorigin text.')")).eql({pos:5,text:'the [](http://www.google.de)origin text.'});
      })
      it('should return new value if link is inserted with selection',function(){
        should(browser.evaluate("generateMarkdownLink('Google the origin text.','https://www.google.de/search the origin text.')")).eql({text:'[Google](https://www.google.de/search) the origin text.',pos:38});
        should(browser.evaluate("generateMarkdownLink('Google the origin text.','https://www.google.de the origin text.')")).eql({text:'[Googl](https://www.google.d)e the origin text.',pos:29});
        should(browser.evaluate("generateMarkdownLink('the origin text.LINK','the origin text.http://www.openstreetmap.de/sublink.html')")).eql({pos: 64,text:'the origin text.[LINK](http://www.openstreetmap.de/sublink.html)'});
        should(browser.evaluate("generateMarkdownLink('the ---LINK---origin text.','the http://www.google.deorigin text.')")).eql({pos:38,text:'the [---LINK---](http://www.google.de)origin text.'});
      })
    })
  })
});