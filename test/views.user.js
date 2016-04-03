"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var nock = require("nock");
var should  = require('should');

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");



var maxTimer = 10000;


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
      function createBrowser(cb) {testutil.startBrowser("TheFive",function(err,result){browser=result;cb();});}
    ], function(err) {
      bddone(err);
    });
  });


  it('should not change username, if user logged in' ,function(bddone) {
    this.timeout(maxTimer);
    async.series([
      function createUser(cb) {
        userModule.createNewUser({OSMUser:"test",lastAccess:(new Date()).toISOString()},cb);
      },
      function visitUser (cb) {
        browser.visit('/usert/1', cb);
      },
      function waitALittle(cb) {
        browser.wait(10,cb);
      }
    ],function(err){
      should.not.exist(err);
      browser.assert.text('input[readonly="readonly"][name="OSMUser"]');
      bddone();
    });
  });
  it('should save userdata and calculate WN User' ,function(bddone) {
    this.timeout(maxTimer);
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
    this.timeout(maxTimer);
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
    this.timeout(maxTimer);

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
  it('should display & sort userlist' ,function(bddone) {
    this.timeout(maxTimer);

    async.series([
      function createUser1(cb) {userModule.createNewUser({OSMUser:"Test1",access:"full",WNAuthor:"b"},cb); },
      function createUser2(cb) {userModule.createNewUser({OSMUser:"Test2",access:"full",WNAuthor:"a"},cb); },
      function createUser2(cb) {userModule.createNewUser({OSMUser:"Test3",access:"denied"},cb); },
      function visitUser (cb) {
        browser.visit('/usert/list?access=full', cb);
      },
      function clickOnWNAuthor(cb) {
        browser.click('a[id="sortWNAuthor"]',cb);
      }
    ],function(err){

      should.not.exist(err);
      var r = browser.html();
      r = r.substring(r.indexOf("<table"), r.indexOf("</table"));
      should(r).eql('<table class=\"table table-striped table-responsive\"><thead><tr> <th><a href=\"/usert/list?access=full&amp;sort=OSMUser\">Name</a></th><th> \nOSM</th><th><a id=\"sortWNAuthor\" href=\"/usert/list?access=full&amp;sort=WNAuthor\">WNAuthor</a></th><th>OSMBC Changes</th><th>Email</th><th>Collection</th><th>AllComment</th><th>Comment</th><th>Status</th><th><a href=\"/usert/list?access=full&amp;sort=language\">Language</a></th><th>access</th><th><a href=\"/usert/list?access=full&amp;sort=lastAccess&amp;desc=true\">lastAccess</a></th></tr></thead><tbody><tr><td><a href=\"/usert/3\">Test2</a></td><td><a href=\"http://www.openstreetmap.org/user/Test2\">[OSM]</a></td><td><a href=\"https://blog.openstreetmap.de/blog/author/a\">a</a></td><td><a href=\"/changes/log?user=Test2\">(0)</a></td><td></td><td><p> </p></td><td><p> </p></td><td></td><td></td><td></td><td>full</td><td>Never</td></tr><tr><td><a href=\"/usert/2\">Test1</a></td><td><a href=\"http://www.openstreetmap.org/user/Test1\">[OSM]</a></td><td><a href=\"https://blog.openstreetmap.de/blog/author/b\">b</a></td><td><a href=\"/changes/log?user=Test1\">(0)</a></td><td></td><td><p> </p></td><td><p> </p></td><td></td><td></td><td></td><td>full</td><td>Never</td></tr><tr><td><a href=\"/usert/1\">TheFive</a></td><td><a href=\"http://www.openstreetmap.org/user/TheFive\">[OSM]</a></td><td></td><td><a href=\"/changes/log?user=TheFive\">(0)</a></td><td></td><td><p> </p></td><td><p> </p></td><td></td><td></td><td></td><td>full</td><td>a few seconds ago</td></tr></tbody>');
      bddone();

    });
  });});