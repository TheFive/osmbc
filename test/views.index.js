var async = require('async');
var testutil = require('./testutil.js');

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");






describe('views/index', function() {
  var browser;
  var articleId;
  before(function(bddone) {
    async.series([
      testutil.clearDB,
      function createUser(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full"},cb); },
      function createArticle(cb) {articleModule.createNewArticle({blog:"blog",collection:"test"},function(err,article){
        if (article) articleId = article.id;
        cb(err);
      }); },     
      function createBrowser(cb) {testutil.startBrowser(function(err,result){browser=result;cb();});}
    ], function(err) {
      bddone(err);
    });
  });
  

  describe("Homepage",function() {
    // load the contact page
    before(function(done) {
      this.timeout(6000);
      browser.visit('/osmbc', done);
    });

    it('should find welcome text on Homepage' ,function() {
      browser.assert.success();
      browser.assert.text('h2', 'Welcome to OSM BCOSM BC');
    });
  });
});