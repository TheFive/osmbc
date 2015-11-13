var async = require('async');
var testutil = require('./testutil.js');
var passportStub = require("./passport-stub.js");

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");





// use zombie.js as headless browser
var Browser = require('zombie');
var http = require('http');

describe('Browser Tests', function() {
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
  

  describe("Test Homepage",function() {
    // load the contact page
    before(function(done) {
      browser.visit('/osmbc', done);
    });

    it('should find welcome text on Homepage' ,function() {
      browser.assert.success();
      browser.assert.text('h2', 'Welcome to OSM BC');
    });
  })
  describe("Collect Article addiitional functions",function() {
    before(function(done) {
      browser.visit('/article/'+articleId, done);
    });
    it('should isURL work on page' ,function() {
      browser.evaluate("isURL('https://www.google.de')",true);
    });

  })


});