

import async from "async";
import should from "should";
import sinon from "sinon";
import config from "../config.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import blogRenderer from "../render/BlogRenderer.js";
import nock from "nock";
import axios from "axios";
import initialiseModules from "../util/initialise.js";


import testutil from "../test/testutil.js";

// Polls the DB until the given blog has an exportedBy[profile][lang] marker
// (the marker is set asynchronously after the download response finishes).
async function waitUntilExported(name, profile, lang) {
  const deadline = Date.now() + 2000;
  for (;;) {
    const blog = await blogModule.findOne({ name });
    if (blog && blog.exportedBy && blog.exportedBy[profile] && blog.exportedBy[profile][lang]) {
      return blog;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${name} to be marked as exported under ${profile}/${lang}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}






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

  describe("Blog preview download API for outstanding exports", function() {
    describe("with no eligible blogs", function() {
      it("should respond 404 (default noContentBehavior)", async function() {
        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload",
          { validateStatus: (status) => true }
        );
        should(response.status).eql(404);
      });

      it("should respond with an empty zip when noContentBehavior=emptyZip", async function() {
        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=MarkdownDownload",
          { validateStatus: (status) => true, responseType: "arraybuffer" }
        );
        should(response.status).eql(200);
        should(response.headers["content-type"]).match(/application\/(zip|octet-stream)/);
        const zipBuffer = Buffer.from(response.data);
        zipBuffer.subarray(0, 2).toString("binary").should.eql("PK");
      });
    });

    describe("with eligible closed blogs", function() {
      beforeEach(function(bddone) {
        testutil.importData({
          clear: false,
          blog: [
            {
              name: "WN3000",
              status: "edit",
              categories: [{ EN: "Mapping", DE: "Mapping" }],
              closeDE: true,
              closeEN: true
            },
            {
              name: "WN3001",
              status: "closed",
              categories: [{ EN: "Mapping", DE: "Mapping" }],
              closeDE: true,
              closeEN: true
            }
          ],
          article: [
            {
              blog: "WN3000",
              title: "Outstanding article one",
              markdownDE: "* Outstanding article one DE",
              markdownEN: "* Outstanding article one EN",
              category: "Mapping"
            },
            {
              blog: "WN3001",
              title: "Outstanding article two",
              markdownDE: "* Outstanding article two DE",
              markdownEN: "* Outstanding article two EN",
              category: "Mapping"
            }
          ]
        }, bddone);
      });

      it("should return a zip with one file per blog and mark both as exported", async function() {
        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE",
          { validateStatus: (status) => true, responseType: "arraybuffer" }
        );

        should(response.status).eql(200);
        should(response.headers["content-type"]).match(/application\/(zip|octet-stream)/);
        const zipBuffer = Buffer.from(response.data);
        zipBuffer.subarray(0, 2).toString("binary").should.eql("PK");
        const zipText = zipBuffer.toString("latin1");
        zipText.should.containEql("de/archives/3000.md");
        zipText.should.containEql("de/archives/3001.md");

        const blog3000 = await waitUntilExported("WN3000", "HugoDownload", "DE");
        const blog3001 = await waitUntilExported("WN3001", "HugoDownload", "DE");
        should.exist(blog3000.exportedBy.HugoDownload.DE);
        should.exist(blog3001.exportedBy.HugoDownload.DE);
      });

      it("should list candidates via dryRun without marking or downloading anything", async function() {
        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE&dryRun=true",
          { validateStatus: (status) => true }
        );

        should(response.status).eql(200);
        should(response.headers["content-type"]).match(/application\/json/);
        should(response.data.exportProfile).eql("HugoDownload");
        should(response.data.count).eql(2);
        const names = response.data.blogs.map((b) => b.name).sort();
        should(names).eql(["WN3000", "WN3001"]);
        response.data.blogs.forEach((b) => should(b.langs).eql(["DE"]));

        // dryRun must not have any side effect
        const blog3000 = await blogModule.findOne({ name: "WN3000" });
        should(blog3000.exportedBy).be.undefined();
      });

      it("should narrow the dryRun listing to minBlogNumber/maxBlogNumber", async function() {
        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE&dryRun=true&minBlogNumber=3001&maxBlogNumber=3001",
          { validateStatus: (status) => true }
        );

        should(response.status).eql(200);
        should(response.data.minBlogNumber).eql(3001);
        should(response.data.maxBlogNumber).eql(3001);
        should(response.data.count).eql(1);
        should(response.data.blogs.map((b) => b.name)).eql(["WN3001"]);
      });

      it("should only export blogs within the given WN range", async function() {
        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE&minBlogNumber=3001&maxBlogNumber=3001",
          { validateStatus: (status) => true, responseType: "arraybuffer" }
        );

        should(response.status).eql(200);
        const zipText = Buffer.from(response.data).toString("latin1");
        zipText.should.containEql("de/archives/3001.md");
        zipText.should.not.containEql("de/archives/3000.md");

        await waitUntilExported("WN3001", "HugoDownload", "DE");
        const blog3000 = await blogModule.findOne({ name: "WN3000" });
        should(blog3000.exportedBy).be.undefined();
      });

      it("should reject a non-numeric minBlogNumber with 422", async function() {
        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&minBlogNumber=notanumber",
          { validateStatus: (status) => true }
        );
        should(response.status).eql(422);
        should(response.data).containEql("minBlogNumber");
      });

      it("should reject minBlogNumber greater than maxBlogNumber with 422", async function() {
        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&minBlogNumber=3001&maxBlogNumber=3000",
          { validateStatus: (status) => true }
        );
        should(response.status).eql(422);
        should(response.data).containEql("minBlogNumber");
      });

      it("should reject a second concurrent outstanding export for the same profile with 409", async function() {
        const requestOptions = { validateStatus: (status) => true, responseType: "arraybuffer" };
        const url = baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE";
        const [first, second] = await Promise.all([
          axios.get(url, requestOptions),
          axios.get(url, requestOptions)
        ]);
        const statuses = [first.status, second.status].sort();
        should(statuses).eql([200, 409]);

        // Wait out the winning request's async marking tail before the next
        // test tears down/recreates the DB, otherwise its write lands on a
        // dropped table.
        await waitUntilExported("WN3001", "HugoDownload", "DE");
      });

      it("should skip a blog that fails to render, report it via a header and still export/mark the other", async function() {
        const originalCreateRenderer = blogRenderer.createRenderer;
        const stub = sinon.stub(blogRenderer, "createRenderer").callsFake(function(type, blog, options) {
          if (blog.name === "WN3000") throw new Error("Simulated render failure");
          return originalCreateRenderer(type, blog, options);
        });

        try {
          const response = await axios.get(
            baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE",
            { validateStatus: (status) => true, responseType: "arraybuffer" }
          );

          should(response.status).eql(200);
          should(response.headers["x-outstanding-export-warnings"]).eql("WN3000:DE");
          const zipText = Buffer.from(response.data).toString("latin1");
          zipText.should.not.containEql("de/archives/3000.md");
          zipText.should.containEql("de/archives/3001.md");

          const blog3001 = await waitUntilExported("WN3001", "HugoDownload", "DE");
          should.exist(blog3001.exportedBy.HugoDownload.DE);
          const blog3000 = await blogModule.findOne({ name: "WN3000" });
          should(blog3000.exportedBy).be.undefined();
        } finally {
          stub.restore();
        }
      });

      it("should still mark the other blog if one blog's marker fails to save", async function() {
        const originalSave = blogModule.Class.prototype.save;
        const stub = sinon.stub(blogModule.Class.prototype, "save").callsFake(function(cb) {
          if (this.name === "WN3000") return cb(new Error("Simulated save failure"));
          return originalSave.call(this, cb);
        });

        try {
          const response = await axios.get(
            baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE",
            { validateStatus: (status) => true, responseType: "arraybuffer" }
          );
          should(response.status).eql(200);
          const zipText = Buffer.from(response.data).toString("latin1");
          zipText.should.containEql("de/archives/3000.md");
          zipText.should.containEql("de/archives/3001.md");

          // WN3001's marker must still be set even though WN3000's save failed
          const blog3001 = await waitUntilExported("WN3001", "HugoDownload", "DE");
          should.exist(blog3001.exportedBy.HugoDownload.DE);
        } finally {
          stub.restore();
        }

        // Once the stub is removed, WN3000 must still be "outstanding"
        // (its marker never got saved) and reappear on the next dry run.
        const dryRunResponse = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE&dryRun=true",
          { validateStatus: (status) => true }
        );
        should(dryRunResponse.data.blogs.map((b) => b.name)).eql(["WN3000"]);
      });

      it("should respond 404 on a second download once all blogs are exported", async function() {
        await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE",
          { validateStatus: (status) => true, responseType: "arraybuffer" }
        );
        await waitUntilExported("WN3001", "HugoDownload", "DE");

        const secondResponse = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE",
          { validateStatus: (status) => true }
        );
        should(secondResponse.status).eql(404);
      });

      it("should make a blog reappear after its language marker is reset via reopen/close", async function() {
        await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE",
          { validateStatus: (status) => true, responseType: "arraybuffer" }
        );
        const blog3000 = await waitUntilExported("WN3000", "HugoDownload", "DE");

        await new Promise((resolve, reject) => {
          blog3000.closeBlog({ lang: "DE", user: { OSMUser: "user" }, status: false }, (err) => (err ? reject(err) : resolve()));
        });
        const reopened = await blogModule.findOne({ name: "WN3000" });
        await new Promise((resolve, reject) => {
          reopened.closeBlog({ lang: "DE", user: { OSMUser: "user" }, status: true }, (err) => (err ? reject(err) : resolve()));
        });

        const response = await axios.get(
          baseLink + "/api/blogPreviewDownload/testapikey/outstanding?exportProfile=HugoDownload&lang=DE",
          { validateStatus: (status) => true, responseType: "arraybuffer" }
        );
        should(response.status).eql(200);
        const zipText = Buffer.from(response.data).toString("latin1");
        zipText.should.containEql("de/archives/3000.md");
        zipText.should.not.containEql("de/archives/3001.md");
      });
    });
  });
});
