"use strict";

const async = require("async");
const should = require("should");
const config = require("../config");
const articleModule = require("../model/article.js");
const nock = require("nock");
const axios = require("axios");


const testutil = require("../test/testutil.js");

require("jstransformer-verbatim");





describe("routes/api", function() {
  var baseLink;
  beforeEach(function(bddone) {
    baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
    testutil.startServerSync();
    async.series([
      function(cb) { testutil.importData({clear: true, user: [{"OSMUser": "TheFive", "email": "simple@test.test",language:"DE","apiKey":"334433"}]}, cb); }
    ], bddone);
  });
  afterEach(function(bddone) {
    testutil.stopServer();
    bddone();
  });

  describe("monitor functions", function() {
    it("should give OK with correct ApiKey", async function () {
      const body = await axios.get(baseLink + "/api/monitor/testapikey");
      should(body.status).eql(200);
      should(body.data).eql("OK");
     
    });
    it("should give unauthorised with incorrect ApiKey", async function () {
      const body = await axios.get(baseLink + "/api/monitor/incorrecttestapikey",{validateStatus: (status) => true});
      
      should(body.status).eql(401);
    });
  });
  describe("monitor postgres functions", function() {
    it("should give OK with correct ApiKey", async function () {
      const body = await axios.get(baseLink + "/api/monitor/testapikey",{validateStatus: (status) => true});
      
      should(body.status).eql(200);
      should(body.data).eql("OK");
      
    });
    it("should give unauthorised with incorrect ApiKey", async function () {
      const body = await axios.get(baseLink + "/api/monitorpostgres/incorrecttestapikey",{validateStatus: (status) => true});
      
      should(body.status).eql(401);
    
    });
  });
  describe("Collect API", function() {
    it("should not work with incorrect APi Key", async function () {
      const body = await axios.post(baseLink + "/api/collectArticle/incorrecttestapikey",{},{validateStatus: (status) => true});
      
      should(body.status).eql(401);
       
    });
    it("should not work with non JSON Data", async function () {
      const body = await axios.post(baseLink + "/api/collectArticle/testapikey.TBC",{},{validateStatus: (status) => true});
      
      should(body.status).eql(422);
        
    });
    it("should not work without OSMUser", async function () {
      const body = await axios.post(baseLink + "/api/collectArticle/testapikey.TBC",{collection: "simple Text"},{validateStatus: (status) => true});
      
      should(body.data).eql('No OSMUser && EMail given\n{"type":"API","status":422}');
      should(body.status).eql(422);
       
    });
    it("should not work without OSMUser && wrong email", async function () {
      const body = await axios.post(
        baseLink + "/api/collectArticle/testapikey.TBC",
        {collection: "simple Text", "email": "Blubber"},
        {validateStatus: (status) => true});
      
      
      
      should(body.data).eql('No OSMUser given, could not resolve email address\n{"type":"API","status":422}');
      should(body.status).eql(422);
    });
    it("should work with OSMUser", async function () {
      const body = await axios.post(
        baseLink + "/api/collectArticle/testapikey.TBC",
        {collection: "simple Text", "OSMUser": "TheFive"},
        {validateStatus: (status) => true});
      
      
      should(body.data).eql("Article Collected in TBC.");
      should(body.status).eql(200);
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
      });
    });
    it("should work with alternative email", async function () {
      nock("https://www.link.org")
        .get("/something")
        .reply(200, "<title>Page Title</title>");
      const body = await axios.post(
        baseLink + "/api/collectArticle/testapikey.TBC",
        {collection: "simple Text with https://www.link.org/something", "email": "simple@test.test"},
        {validateStatus: (status) => true});  
      
      should(body.data).eql("Article Collected in TBC.");
      should(body.status).eql(200);
      articleModule.find({}, function(err, articles) {
        should.not.exist(err);
        should(articles).eql([
          {
            id: "1",
            version: 2,
            categoryEN: "-- no category yet --",
            blog: "TBC",
            title: "Page Title",
            collection: "simple Text with https://www.link.org/something",
            firstCollector: "TheFive"
          }
        ]);
      });
    });
    it("should work more infos", async function () {
      const body = await axios.post(
        baseLink + "/api/collectArticle/testapikey.TBC",
        {collection: "simple Text with https://www.link.ong/something", "email": "simple@test.test", title: "Title", "markdownDE": "Hier der erste Text", "markdownEN": "Some Text in English", categoryEN: "category given"},
        {validateStatus: (status) => true});  
      
      should(body.data).eql("Article Collected in TBC.");
      should(body.status).eql(200);
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
      });
    });
    it("should work more and set markdown correct", async function () {
      const body = await axios.post(
        baseLink + "/api/collectArticle/testapikey.TBC",
        {collection: "simple Text with https://www.link.ong/something", "email": "simple@test.test", title: "Title", "markdown": "Hier der erste Text"},
        {validateStatus: (status) => true});  

      
      should(body.data).eql("Article Collected in TBC.");
      should(body.status).eql(200);
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
      });
    });
    it("should collect with simple GET call", async function () {
      const body = await axios.get(
        baseLink + "/api/collect/334433?collection=simple%20text",
        {validateStatus: (status) => true});  
      
      should(body.data).eql("https://testosm.bc/article/1");
      should(body.status).eql(200);
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
      });
    });
  });
});
