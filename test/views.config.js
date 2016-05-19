"use strict";

var async = require('async');
var testutil = require('./testutil.js');
var should  = require('should');

var userModule = require("../model/user.js");




var maxTimer = 10000;


describe('views/config', function() {
  var browser;
  beforeEach(function(bddone) {
    async.series([
      testutil.clearDB,
      function createUser(cb) {userModule.createNewUser({OSMUser:"TheFive",access:"full","language":"DE"},cb); },
      function createBrowser(cb) {testutil.startBrowser("TheFive",function(err,result){browser=result;cb();});}
    ], function(err) {
      bddone(err);
    });
  });


  it('should open and not save wrong yaml' ,function(bddone) {
    this.timeout(maxTimer);
    async.series([
      function visitTranslation (cb) {
        browser.visit('/config/calendartranslation', cb);
      },
      function waitALittle(cb) {
        browser.wait(10,cb);
      },
      function checkFirstValues(cb) {
        browser.assert.text('table#resulttable',"WoWasWannLandMunichOpenStreetMap Default Meeting2015-12-15Germany");
        cb();
      },
      function saveValue(cb) {
        browser
          .fill("yaml",'"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n  "country":\n  "DE": "LL"')
          .pressButton("OK");
        cb();
      },
      function waitALittle(cb) {
        browser.wait(1000,cb);
      }
    ],function(err){
      should.not.exist(err);
      browser.assert.status(500);
      //should.not.exist(err);
      //browser.assert.text('table#resulttable',"WhereWWhenCountryMunichOpenStreetMap Default Meeting2015-12-15Germany");
      //console.log("HTML:"+browser.html());

      bddone();
    });
  });
  it('should open and save calendartranslation' ,function(bddone) {
    this.timeout(maxTimer);
    async.series([
      function visitTranslation (cb) {
        browser.visit('/config/calendartranslation', cb);
      },
      function waitALittle(cb) {
        browser.wait(10,cb);
      },
      function checkFirstValues(cb) {
        browser.assert.text('table#resulttable',"WoWasWannLandMunichOpenStreetMap Default Meeting2015-12-15Germany");
        cb();
      },
      function saveValue(cb) {
        browser
          .fill("yaml",'"town":\n  "DE": "WW"\n"title":\n  "DE": "WA"\n"date":\n  "DE": "WNN"\n"country":\n  "DE": "LL"')
          .pressButton("OK");
        cb();
      },
      function waitALittle(cb) {
        browser.wait(1000,cb);
      }
    ],function(err){
      browser.assert.success();
      should.not.exist(err);
      browser.assert.text('table#resulttable',"WWWAWNNLLMunichOpenStreetMap Default Meeting2015-12-15Germany");
      //console.log("HTML:"+browser.html());

      bddone();
    });
  });
 });
