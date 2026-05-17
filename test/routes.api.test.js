

import async from "async";
import should from "should";
import config from "../config.js";
import articleModule from "../model/article.js";
import nock from "nock";
import axios from "axios";
import initialiseModules from "../util/initialise.js";


import testutil from "../test/testutil.js";






describe("router/api", function() {
  let baseLink;
  before(async function() {
    await initialiseModules();
  });
  beforeEach(function(bddone) {
    baseLink = "http://localhost:" + config.getServerPort() + config.htmlRoot();
    testutil.startServerSync();
    async.series([
      function(cb) { testutil.importData({ clear: true, user: [{ OSMUser: "TheFive", email: "simple@test.test", language: "DE", apiKey: "334433" }] }, cb); }
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
      const body = await axios.get(baseLink + "/api/monitor/incorrecttestapikey", { validateStatus: (status) => true });

      should(body.status).eql(401);
    });
  });
  describe("monitor postgres functions", function() {
    it("should give OK with correct ApiKey", async function () {
      const body = await axios.get(baseLink + "/api/monitor/testapikey", { validateStatus: (status) => true });

      should(body.status).eql(200);
      should(body.data).eql("OK");
    });
    it("should give unauthorised with incorrect ApiKey", async function () {
      const body = await axios.get(baseLink + "/api/monitorpostgres/incorrecttestapikey", { validateStatus: (status) => true });

      should(body.status).eql(401);
    });
  });
  describe("Collect API", function() {
    it("should not work with incorrect APi Key", async function () {
      const body = await axios.post(baseLink + "/api/collectArticle/incorrecttestapikey", {}, { validateStatus: (status) => true });

      should(body.status).eql(401);
    });
    it("should not work with non JSON Data", async function () {
      const body = await axios.post(baseLink + "/api/collectArticle/testapikey.TBC", {}, { validateStatus: (status) => true });

      should(body.status).eql(422);
    });
    it("should not work without OSMUser", async function () {
      const body = await axios.post(baseLink + "/api/collectArticle/testapikey.TBC", { collection: "simple Text" }, { validateStatus: (status) => true });

      should(body.data).eql("No OSMUser && EMail given");
      should(body.status).eql(422);
    });
    it("should not work without OSMUser && wrong email", async function () {
      const body = await axios.post(
        baseLink + "/api/collectArticle/testapikey.TBC",
        { collection: "simple Text", email: "Blubber" },
        { validateStatus: (status) => true });



      should(body.data).eql("No OSMUser given, could not resolve email address");
      should(body.status).eql(422);
    });
    it("should work with OSMUser", async function () {
      const body = await axios.post(
        baseLink + "/api/collectArticle/testapikey.TBC",
        { collection: "simple Text", OSMUser: "TheFive" },
        { validateStatus: (status) => true });


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
        { collection: "simple Text with https://www.link.org/something", email: "simple@test.test" },
        { validateStatus: (status) => true });

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
        { collection: "simple Text with https://www.link.ong/something", email: "simple@test.test", title: "Title", markdownDE: "Hier der erste Text", markdownEN: "Some Text in English", categoryEN: "category given" },
        { validateStatus: (status) => true });

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
        { collection: "simple Text with https://www.link.ong/something", email: "simple@test.test", title: "Title", markdown: "Hier der erste Text" },
        { validateStatus: (status) => true });


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
        { validateStatus: (status) => true });

      should(body.data).eql("https://localhost:35043/article/1");
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

  describe("Blog preview download API", function() {
    beforeEach(function(bddone) {
      testutil.importData({
        clear: false,
        blog: [{
          name: "BLOG",
          status: "edit",
          categories: [{ EN: "Mapping", DE: "Mapping" }],
          closeDE: true,
          closeEN: true
        }],
        article: [{
          blog: "BLOG",
          title: "API Test Article",
          markdownDE: "* API Testinhalt",
          markdownEN: "* API Test Content",
          category: "Mapping"
        }]
      }, bddone);
    });

    it("should reject missing exportProfile", async function() {
      const response = await axios.get(
        baseLink + "/api/blogPreviewDownload/testapikey/BLOG?lang=DE",
        { validateStatus: (status) => true }
      );

      should(response.status).eql(422);
      should(response.data).eql("Missing exportProfile");
    });

    it("should download HTML with exportProfile=OsmbcDownload", async function() {
      const response = await axios.get(
        baseLink + "/api/blogPreviewDownload/testapikey/BLOG?lang=DE&exportProfile=OsmbcDownload",
        { validateStatus: (status) => true }
      );

      should(response.status).eql(200);
      should(response.headers["content-type"]).match(/text\/html/);
      should(response.data).containEql("<meta charset=\"utf-8\"/>");
    });

    it("should download zip with exportProfile=HugoDownload for lang=ALL", async function() {
      const response = await axios.get(
        baseLink + "/api/blogPreviewDownload/testapikey/BLOG?lang=ALL&exportProfile=HugoDownload",
        { validateStatus: (status) => true, responseType: "arraybuffer" }
      );

      should(response.status).eql(200);
      should(response.headers["content-type"]).match(/application\/(zip|octet-stream)/);
      const zipBuffer = Buffer.from(response.data);
      zipBuffer.subarray(0, 2).toString("binary").should.eql("PK");
      const zipText = zipBuffer.toString("latin1");
      zipText.should.containEql("de/archives/0000.md");
    });
  });

  describe("Blog preview download API with current alias", function() {
    beforeEach(function(bddone) {
      testutil.importData({
        clear: false,
        blog: [
          {
            name: "BLOG",
            status: "edit",
            startDate: "2025-01-20T00:00:00.000Z",
            endDate: "2025-01-26T23:59:59.000Z",
            categories: [{ EN: "Mapping", DE: "Mapping" }],
            closeDE: true,
            closeEN: true
          },
          {
            name: "WN999",
            status: "edit",
            startDate: "2024-12-23T00:00:00.000Z",
            endDate: "2024-12-29T23:59:59.000Z",
            categories: [{ EN: "Mapping", DE: "Mapping" }],
            closeDE: true,
            closeEN: true
          },
          {
            name: "WN1000",
            status: "edit",
            startDate: "2024-12-30T00:00:00.000Z",
            endDate: "2025-01-05T23:59:59.000Z",
            categories: [{ EN: "Mapping", DE: "Mapping" }],
            closeDE: true,
            closeEN: true
          },
          {
            name: "WN1001",
            status: "open",
            startDate: "2025-01-06T00:00:00.000Z",
            endDate: "2025-01-12T23:59:59.000Z",
            categories: [{ EN: "Mapping", DE: "Mapping" }],
            closeDE: true,
            closeEN: true
          }
        ],
        article: [
          {
            blog: "BLOG",
            title: "Technical blog article",
            markdownDE: "* Technical blog article",
            markdownEN: "* Technical blog article",
            category: "Mapping"
          },
          {
            blog: "WN999",
            title: "Older edit article",
            markdownDE: "* Older edit article",
            markdownEN: "* Older edit article",
            category: "Mapping"
          },
          {
            blog: "WN1000",
            title: "Latest edit article",
            markdownDE: "* Latest edit article",
            markdownEN: "* Latest edit article",
            category: "Mapping"
          },
          {
            blog: "WN1001",
            title: "Open article",
            markdownDE: "* Open article",
            markdownEN: "* Open article",
            category: "Mapping"
          }
        ]
      }, bddone);
    });

    it("should resolve current to the latest edit blog by startDate", async function() {
      const response = await axios.get(
        baseLink + "/api/blogPreviewDownload/testapikey/current?lang=DE&exportProfile=OsmbcDownload",
        { validateStatus: (status) => true }
      );

      should(response.status).eql(200);
      should(response.data).containEql("30.12.2024-06.01.2025");
      should(response.data).not.containEql("06.01.2025-13.01.2025");
    });
  });
});
