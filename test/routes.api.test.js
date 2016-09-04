"use strict";

var async = require('async');
var should = require('should');
var request = require('request');
var config = require('../config');


var testutil = require('../test/testutil.js');

require('jstransformer-verbatim');





describe('routes/api',function() {
  var baseLink;
  before(function(bddone){
    baseLink = 'http://localhost:' + config.getServerPort() + config.getValue("htmlroot");
    async.series([
      testutil.clearDB,
      testutil.startServer,
    ],bddone);

  });
  after(function(bddone){
    testutil.stopServer();
    bddone();
  });

  describe('monitor functions',function() {
    it('should give OK with correct ApiKey', function (bddone) {
      request({
        method: "GET",
        url: baseLink + "/api/monitor/testapikey"
      }, function (err, res) {
        should.not.exist(err);
        should(res.statusCode).eql(200);
        should(res.body).eql("OK");
        bddone();
      });
    });
    it('should give unauthorised with incorrect ApiKey', function (bddone) {
      request({
        method: "GET",
        url: baseLink + "/api/monitor/incorrecttestapikey"
      }, function (err, res) {
        should.not.exist(err);
        should(res.statusCode).eql(401);
        bddone();
      });
    });
  });
  describe('monitor postgres functions',function() {
    it('should give OK with correct ApiKey', function (bddone) {
      request({
        method: "GET",
        url: baseLink + "/api/monitorpostgres/testapikey"
      }, function (err, res) {
        should.not.exist(err);
        should(res.statusCode).eql(200);
        should(res.body).eql("OK");
        bddone();
      });
    });
    it('should give unauthorised with incorrect ApiKey', function (bddone) {
      request({
        method: "GET",
        url: baseLink + "/api/monitorpostgres/incorrecttestapikey"
      }, function (err, res) {
        should.not.exist(err);
        should(res.statusCode).eql(401);
        bddone();
      });
    });
  });
});