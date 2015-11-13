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
        console.log("generateMarkdownLink('the origin text.','extend the origin text.')");
        should(browser.evaluate("generateMarkdownLink('the origin text.','extend the origin text.')")).equal(null);
        console.log("generateMarkdownLink('the origin text.','the origin text. At the end')");
        should(browser.evaluate("generateMarkdownLink('the origin text.','the origin text. At the end')")).equal(null);
        console.log("generateMarkdownLink('the origin text','the origin in the middle text')");
        should(browser.evaluate("generateMarkdownLink('the origin text','the origin in the middle text')")).equal(null);
      })
      it('should return new value if link is inserted',function(){
        console.log("generateMarkdownLink('the origin text.','https://www.google.dethe origin text.')");
        should(browser.evaluate("generateMarkdownLink('the origin text.','https://www.google.dethe origin text.')")).eql({text:'[](https://www.google.de)the origin text.',pos:1});
        console.log("generateMarkdownLink('the origin text.','the origin text.http://www.openstreetmap.de/sublink.html')");
        should(browser.evaluate("generateMarkdownLink('the origin text.','the origin text.http://www.openstreetmap.de/sublink.html')")).eql({pos: 17,text:'the origin text.[](http://www.openstreetmap.de/sublink.html)'});
        console.log("generateMarkdownLink('the origin text.','the http://www.google.deorigin text.')");
        should(browser.evaluate("generateMarkdownLink('the origin text.','the http://www.google.deorigin text.')")).eql({pos:5,text:'the [](http://www.google.de)origin text.'});
      })
    })
  })
});