"use strict";

var async = require("async");
var should = require("should");
var request = require("request");
var config = require("../config");
var articleModule = require("../model/article.js");
var nock = require("nock");


var testutil = require("../test/testutil.js");

require("jstransformer-verbatim");





describe("routes/api", function() {
  var baseLink;
  beforeEach(function(bddone) {
    baseLink = "http://localhost:" + config.getServerPort() + config.getValue("htmlroot");
    async.series([
      function(cb) { testutil.importData({clear: true, user: [{"OSMUser": "TheFive", "email": "simple@test.test",language:"DE","apiKey":"334433"}]}, cb); },
      testutil.startServer
    ], bddone);
  });
  afterEach(function(bddone) {
    testutil.stopServer();
    bddone();
  });

  describe("monitor functions", function() {
    it("should give OK with correct ApiKey", function (bddone) {
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
    it("should give unauthorised with incorrect ApiKey", function (bddone) {
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
  describe("monitor postgres functions", function() {
    it("should give OK with correct ApiKey", function (bddone) {
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
    it("should give unauthorised with incorrect ApiKey", function (bddone) {
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
  describe("Collect API", function() {
    it("should not work with incorrect APi Key", function (bddone) {
      request({
        method: "POST",
        url: baseLink + "/api/collectArticle/incorrecttestapikey"
      }, function (err, res) {
        should.not.exist(err);
        should(res.statusCode).eql(401);
        bddone();
      });
    });
    it("should not work with non JSON Data", function (bddone) {
      request({
        method: "POST",
        url: baseLink + "/api/collectArticle/testapikey.TBC"
      }, function (err, res) {
        should.not.exist(err);
        should(res.statusCode).eql(422);
        bddone();
      });
    });
    it("should not work without OSMUser", function (bddone) {
      request({
        method: "POST",
        json: {collection: "simple Text"},
        url: baseLink + "/api/collectArticle/testapikey.TBC"
      }, function (err, res) {
        should.not.exist(err);
        should(res.body).eql('No OSMUser && EMail given\n{"type":"API","status":422}');
        should(res.statusCode).eql(422);
        bddone();
      });
    });
    it("should not work without OSMUser && wrong email", function (bddone) {
      request({
        method: "POST",
        json: {collection: "simple Text", "email": "Blubber"},
        url: baseLink + "/api/collectArticle/testapikey.TBC"
      }, function (err, res) {
        should.not.exist(err);
        should(res.body).eql('No OSMUser given, could not resolve email address\n{"type":"API","status":422}');
        should(res.statusCode).eql(422);
        bddone();
      });
    });
    it("should work with OSMUser", function (bddone) {
      request({
        method: "POST",
        json: {collection: "simple Text", "OSMUser": "TheFive"},
        url: baseLink + "/api/collectArticle/testapikey.TBC"
      }, function (err, res) {
        should.not.exist(err);
        should(res.body).eql("Article Collected in TBC.");
        should(res.statusCode).eql(200);
        articleModule.find({}, function(err, articles) {
          should.not.exist(err);
          should(articles).eql([
            {
              id: "1",
              version: 2,
              categoryEN: "-- no category yet --",
              blog: "TBC",
              title: "NOT GIVEN",
              collection: "simple Text",
              firstCollector: "TheFive"
            }
          ]);
          bddone();
        });
      });
    });
    it("should work with alternative email", function (bddone) {
      nock("https://www.link.ong")
        .get("/something")
        .reply(200, "<title>Page Title</title>");
      request({
        method: "POST",
        json: {collection: "simple Text with https://www.link.ong/something", "email": "simple@test.test"},
        url: baseLink + "/api/collectArticle/testapikey.TBC"
      }, function (err, res) {
        should.not.exist(err);
        should(res.body).eql("Article Collected in TBC.");
        should(res.statusCode).eql(200);
        articleModule.find({}, function(err, articles) {
          should.not.exist(err);
          should(articles).eql([
            {
              id: "1",
              version: 2,
              categoryEN: "-- no category yet --",
              blog: "TBC",
              title: "Page Title",
              collection: "simple Text with https://www.link.ong/something",
              firstCollector: "TheFive"
            }
          ]);
          bddone();
        });
      });
    });
    it("should work more infos", function (bddone) {
      request({
        method: "POST",
        json: {collection: "simple Text with https://www.link.ong/something", "email": "simple@test.test", title: "Title", "markdownDE": "Hier der erste Text", "markdownEN": "Some Text in English", categoryEN: "category given"},
        url: baseLink + "/api/collectArticle/testapikey.TBC"
      }, function (err, res) {
        should.not.exist(err);
        should(res.body).eql("Article Collected in TBC.");
        should(res.statusCode).eql(200);
        articleModule.find({}, function(err, articles) {
          should.not.exist(err);
          should(articles).eql([
            {
              id: "1",
              version: 2,
              categoryEN: "category given",
              markdownDE: "Hier der erste Text",
              markdownEN: "Some Text in English",
              blog: "TBC",
              title: "Title",
              collection: "simple Text with https://www.link.ong/something",
              firstCollector: "TheFive"
            }
          ]);
          bddone();
        });
      });
    });
    it("should work more and set markdown correct", function (bddone) {
      request({
        method: "POST",
        json: {collection: "simple Text with https://www.link.ong/something", "email": "simple@test.test", title: "Title", "markdown": "Hier der erste Text"},
        url: baseLink + "/api/collectArticle/testapikey.TBC"
      }, function (err, res) {
        should.not.exist(err);
        should(res.body).eql("Article Collected in TBC.");
        should(res.statusCode).eql(200);
        articleModule.find({}, function(err, articles) {
          should.not.exist(err);
          should(articles).eql([
            {
              id: "1",
              version: 2,
              categoryEN: "-- no category yet --",
              markdownDE: "Hier der erste Text",
              blog: "TBC",
              title: "Title",
              collection: "simple Text with https://www.link.ong/something",
              firstCollector: "TheFive"
            }
          ]);
          bddone();
        });
      });
    });
    it("should collect with simple GET call", function (bddone) {
      request({
        method: "GET",
        url: baseLink + "/api/collect/334433?collection=simple%20text"
      }, function (err, res) {
        should.not.exist(err);
        should(res.body).eql("https://testosm.bc/article/1");
        should(res.statusCode).eql(200);
        articleModule.find({}, function(err, articles) {
          should.not.exist(err);
          should(articles).eql([
            {
              id: "1",
              version: 2,
              categoryEN: "-- no category yet --",
              blog: "TBC",
              title: "NOT GIVEN",
              collection: "simple%20text",
              firstCollector: "TheFive"
            }
          ]);
          bddone();
        });
      });
    });
  });
});
