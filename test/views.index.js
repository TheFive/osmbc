"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var should  = require('should');
var nock = require('nock');

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");
var blogModule = require("../model/blog.js");

var mockdate = require('mockdate');

var pg = require('pg');
var config = require('../config.js');





describe('views/index', function() {
  describe("Known User",function(){
    var browser;
    var articleId;
    before(function(bddone) {
      mockdate.set(new Date("2016-05-25T20:00"));
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
      mockdate.reset();
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
  describe.skip("With Cookie",function(){
    var browser;
    before(function(bddone) {
      mockdate.set(new Date("2016-05-25T20:00"));
      nock('https://hooks.slack.com/')
        .post(/\/services\/.*/)
        .times(999)
        .reply(200,"ok");
      async.series([
        testutil.clearDB,
        function createSession(cb) {
          pg.connect(config.pgstring,function pgconnected(err,client,pgdone) {
            if (err) return pgdone(err);
            let sessionObject = {
              cookie:{originalMaxAge:31536000000,
                expires:"2017-05-26T15:39:44.562Z",
                httpOnly:true,
                path:"/"},
                returnTo:"/osmbc/osmbc.html",
                "passport":{user:"TheFive"}};
            client.query("insert into session values('s%3AU4MjOXbUtOgFm8jKTbhBGQQwF9Ovp3qX.ElY38TGggyzWZQc88ECI7GmqbgRoPDhcV%2B0Ms4y3ZjK',$1,'2017-12-24T23:59z') ",[sessionObject],function(err){
              pgdone();
              cb(err);
            });
          });
        },
        testutil.startServer.bind(null,null)
      ], function(err) {
        browser=testutil.getBrowser();
        bddone(err);
      });
    });
    after(function(){
      mockdate.reset();
      testutil.stopServer();
    });
    it('should do something',function(bddone){
      console.log("start test"+ browser.site);
      browser.setCookie({name:"connect.sid",domain: "localhost",value:"s%3AU4MjOXbUtOgFm8jKTbhBGQQwF9Ovp3qX.ElY38TGggyzWZQc88ECI7GmqbgRoPDhcV%2B0Ms4y3ZjK"});
      browser.visit("/osmbc.html",function(err){
        console.log(browser.location.hostname);
        console.log("page read");
        console.log(browser.html());
        browser.assert.status(200);
        bddone(err);
      });
    });

  });

});