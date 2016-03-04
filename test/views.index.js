"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var should  = require('should');

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
      this.timeout(10000);
      browser.referer="/osmbc";
      browser.visit('/language?lang=EN', function(err){
        should.not.exist(err);
        browser.assert.success();
        var html = browser.html();
        var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbc-lang">EN');
        console.log(found);
        should(found>=0).be.True();
        bddone();
      });
    });
    it('should set the second language' ,function(bddone) {
      this.timeout(10000);
      browser.referer="/osmbc";
      browser.visit('/language?lang2=ES', function(err){
        should.not.exist(err);
        browser.assert.success();
        var html = browser.html();
        var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbc-lang2">ES');
        console.log(found);
        should(found>=0).be.True();
        bddone();
      });
    });
    it('should set the second language to -- if both equal' ,function(bddone) {
      this.timeout(10000);
      browser.referer="/osmbc";
      browser.visit('/language?lang=ES', function(err) {
        should.not.exist(err);
        browser.visit('/language?lang2=ES', function (err) {
          should.not.exist(err);
          browser.assert.success();
          var html = browser.html();
          var found = html.indexOf('<a href="#" style="color:white" data-toggle="dropdown" class="btn dropdown-toggle osmbc-lang2">--');
          console.log(found);
          should(found >= 0).be.True();
          bddone();
        });
      });
    });
  });
});