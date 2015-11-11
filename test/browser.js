var app = require('../app.js');
var async = require('async');
var testutil = require('./testutil.js');
var passportStub = require("./passport-stub.js");

var userModule = require("../model/user.js");





// use zombie.js as headless browser
var Browser = require('zombie');
var http = require('http');

describe.only('Browser Tests', function() {
  var browser;
  before(function(bddone) {
    async.series([
      testutil.clearDB
    ], function(err) {
      this.server = http.createServer(app).listen(3000);
      // initialize the browser using the same port as the test application
      browser = new Browser({ site: 'http://localhost:3000' });
      passportStub.install(app);
      passportStub.login({displayName:"TheFive"});
      userModule.createNewUser({OSMUser:"TheFive",access:"full"},bddone);     
    })
  });

  describe("Test Homepage",function() {
    // load the contact page
    before(function(done) {
      browser.visit('/osmbc', done);
    });

    it('should show contact a form' ,function() {
      browser.assert.success();
      browser.assert.text('h2', 'Welcome to OSM BC');
    });
  })
  describe("Collect Article",function() {

  })


});