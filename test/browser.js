var app = require('../app.js');
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
      }); }
    ], function(err) {
      server = http.createServer(app).listen(3000);
      // initialize the browser using the same port as the test application
      browser = new Browser({ site: 'http://localhost:3000' });
      passportStub.install(app);
      passportStub.login({displayName:"TheFive"});
      bddone(); 
    })
  });
  after(function(bddone) {
    server.close(bddone);
  })

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