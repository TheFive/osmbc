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
      .reply(200,'<meta charset="UTF-8" /> \n<title>WNPublic | OSMBlog</title>\n');
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

  it('should not validate a usermail if wrong user logged in' ,function(bddone) {
    this.timeout(6000);
    async.series([
      function createUser(cb) {
        userModule.createNewUser({OSMUser:"TestValidate",emailInvalidation:"test@test.org",emailValidationKey:"123456789"},cb);
      },
      function visitUser (cb) {
        browser.visit('/usert/2?validation=123456789', cb);
      }
    ],function(err){

      should.exist(err);
      should(browser.html("body")).match(/Wrong User: expected &gt;TestValidate&lt; given &gt;TheFive&lt;/);
      bddone();
    });
  });
  it('should validate a usermail if correct user logged in' ,function(bddone) {
    this.timeout(6000);

    async.series([
      function createUser(cb) {
        userModule.find({OSMUser:"TheFive"},function(err,result){
          should.not.exist(err);
          var user = result[0];
          user.emailInvalidation = "test@test.org";
          user.emailValidationKey="123456789";
          user.save(cb);
        });
      },
      function visitUser (cb) {
        browser.visit('/usert/1?validation=123456789', cb);
      }
    ],function(err){

      should.not.exist(err);
      userModule.findById(1,function(err,result) {
        should.not.exist(err);
        should(result.OSMUser).eql("TheFive");
        should(result.email).eql("test@test.org");
        should.not.exist(result.emailInvalidation);
        bddone();
      });
    });
  });
});