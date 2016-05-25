"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var should  = require('should');
var nock = require('nock');

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");
var blogModule = require("../model/blog.js");






describe('views/index', function() {
  describe("Known User",function(){
    var browser;
    var articleId;
    before(function(bddone) {
      nock('https://hooks.slack.com/')
        .post(/\/services\/.*/)
        .times(999)
        .reply(200,"ok");
      async.series([
        testutil.clearDB,
        function createUser(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full"},cb); },
        testutil.startServer.bind(null,"TheFive"),
        function createArticle(cb) {articleModule.createNewArticle({blog:"blog",collection:"test",markdownEN:"test"},function(err,article){
          if (article) articleId = article.id;
          cb(err);
        }); },
        function createBlog(cb) {blogModule.createNewBlog({blog:"blog",status:"edit"},function(err){
          cb(err);
        }); }
      ], function(err) {
        browser=testutil.getBrowser();
        bddone(err);
      });
    });
    after(function(){
      testutil.stopServer();
    });


    describe("Homepage",function() {
      it('should find welcome text on Homepage' ,function(bddone) {
        this.timeout(6000);
        browser.visit('/osmbc', function(err){
          should.not.exist(err);
          browser.assert.success();
          browser.assert.text('h2', 'Welcome to OSM BCOSM BC');
          bddone();
        });
      });
    });
    describe("Admin Homepage",function() {
      it('should show it' ,function(bddone) {
        this.timeout(6000);
        async.series([
          browser.visit.bind(browser,"/osmbc/admin"),
          browser.assert.expectHtml.bind(browser,"admin_home.html")
        ],bddone);
      });
    });
    describe("Not Defined Page",function() {

      it('should throw an error message' ,function(bddone) {
        this.timeout(6000);
        browser.visit('/notdefined.html', function(err){
          should.exist(err);
          browser.assert.status(404);
          browser.assert.text('h1', 'Not Found');
          bddone();
        });
      });
    });
    describe("Help",function() {
      it('should display Help Text' ,function(bddone) {
        this.timeout(6000);
        browser.visit('/help/OSMBC', function(err){
          should.not.exist(err);
          browser.assert.success();
          browser.assert.text('h1', 'OSMBC Instructions');
          bddone();
        });
      });
    });
    describe("LanguageSetter",function() {
      it('should set the language' ,function(bddone) {
        this.timeout(12000);
        browser.referer="/osmbc";
        browser.visit('/language?lang=EN', function(err){
          should.not.exist(err);
          browser.reload(function(err){
            should.not.exist(err);
            browser.assert.success();
            var html = browser.html();
            var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbcbadge-lang">EN');
            should(found >= 0).be.True();
            bddone();
          });
        });
      });
      it('should set the second language' ,function(bddone) {
        this.timeout(12000);
        browser.referer="/osmbc";
        browser.visit('/language?lang2=ES', function(err){
          should.not.exist(err);
          should.not.exist(err);
          browser.reload(function(err) {
            should.not.exist(err);
            browser.assert.success();
            var html = browser.html();
            var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbcbadge-lang2">ES');
            should(found >= 0).be.True();
            bddone();
          });
        });
      });
      it('should set the second language to -- if both equal' ,function(bddone) {
        this.timeout(12000);
        browser.referer="/osmbc";
        browser.visit('/language?lang=ES', function(err) {
          should.not.exist(err);
          browser.visit('/language?lang2=ES', function (err) {
            should.not.exist(err);
            browser.reload(function(err) {
              should.not.exist(err);
              browser.assert.success();
              var html = browser.html();
              var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbcbadge-lang2">--');
              should(found >= 0).be.True();
              bddone();
            });
          });
        });
      });
    });
  });
  describe("Unkown User",function(){
    before(function(){
      nock('https://hooks.slack.com/')
        .post(/\/services\/.*/)
        .times(999)
        .reply(200,"ok");
    });
    after(function(){

    });
    it("should throw an error if user not exits",function(bddone) {
      let browser=testutil.getBrowser();

      async.series([
        testutil.clearDB,
        function createUser(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full"},cb); },
        testutil.startServer.bind(null,"TheFiveNotExist"),
        browser.visit.bind(browser,"/osmbc")
      ], function(err) {
        testutil.stopServer();
        should.exist(err);
        browser.assert.status(500);
        browser.assert.text('h1', 'OSM User >TheFiveNotExist< does not exist.');

        bddone();
      });
    });
    it("should throw an error if user has no access rights",function(bddone) {
      let browser=testutil.getBrowser();

      async.series([
        testutil.clearDB,
        function createUser1(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"none"},cb); },
        testutil.startServer.bind(null,"TheFive"),
        browser.visit.bind(browser,"/osmbc")
      ], function(err) {
        testutil.stopServer();
        should.exist(err);
        console.log(err);
        browser.assert.status(500);
        browser.assert.text('h1', 'OSM User >TheFive< has no access rights');

        bddone();
      });
    });  });

});