"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var nock = require("nock");
var should  = require('should');

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");






describe('views/user', function() {
  var browser;
  var articleId;
  beforeEach(function(bddone) {
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


  it('should not change username, if user logged in' ,function(bddone) {
    this.timeout(6000);
    async.series([
      function createUser(cb) {
        userModule.createNewUser({OSMUser:"test",lastAccess:(new Date()).toISOString()},cb);
      },
      function visitUser (cb) {
        browser.visit('/usert/1', cb);
      }
    ],function(err){
      should.not.exist(err);
      browser.assert.text('input[readonly="readonly"][name="OSMUser"]');
      bddone();
    });
  });
  it('should save userdata and calculate WN User' ,function(bddone) {
    this.timeout(6000);
    nock('https://blog.openstreetmap.de')
      .get("/blog/author/WNAuthor")
      .reply(200,"<title>WNPublic</title>");
    async.series([
      function visitUser (cb) {
        browser.visit('/usert/create', cb);
      },
      function fillForm (cb) {
        browser
          .fill("OSMUser","TestUser")
          .fill("EMail","")
          .fill("WNAuthor","WNAuthor")
          .pressButton("OK",cb);
      }
    ],function(err){
      console.log(browser.html());
      should.not.exist(err);
      userModule.findById(2,function(err,result) {
        should.not.exist(err);
        should(result.OSMUser).eql("TestUser");
        should(result.WNAuthor).eql("WNAuthor");
        should(result.WNPublicAuthor).eql("WNPublic");
        bddone();
      });
    });
  });

});