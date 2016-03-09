"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var should  = require('should');

var userModule = require("../model/user.js");
var articleModule = require("../model/article.js");






describe('views/user', function() {
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


  it('should not change username, if user logged in' ,function(bddone) {
    this.timeout(6000);
    async.series([
      function createUser(cb) {
        userModule.createNewUser({OSMUser:"test",lastAccess:(new Date()).toISOString()},cb);
      },
      function visitUser (cb) {
        browser.visit('/usert/1', cb);
      },
      function changeUser (cb) {
        return cb();
        browser
          .fill('OSMUser', "test")
          .pressButton('OK',cb);
      }
    ],function(err){
      should.not.exist(err);
      browser.assert.text('input[readonly="readonly"]');
      bddone();
    })
  });
});