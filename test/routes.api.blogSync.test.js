import async from "async";
import should from "should";
import axios from "axios";
import config from "../config.js";
import blogModule from "../model/blog.js";
import articleModule from "../model/article.js";
import logModule from "../model/logModule.js";
import initialiseModules from "../util/initialise.js";

import testutil from "../test/testutil.js";

describe("router/api blogSync (Blog-Sync-Merger)", function() {
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

  describe("GET /blogSync (read endpoint)", function() {
    beforeEach(function(bddone) {
      testutil.importData({
        clear: false,
        blog: [
          { name: "WN100", status: "closed", categories: ["Mapping"] }
        ],
        article: [
          { blog: "WN100", title: "Article one", categoryEN: "Mapping", markdownDE: "* eins", markdownEN: "* one" }
        ]
      }, bddone);
    });

    it("should reject an incorrect apiKey", async function() {
      const response = await axios.get(baseLink + "/api/blogSync/incorrecttestapikey/WN100", { validateStatus: () => true });
      should(response.status).eql(401);
    });

    it("should return the blog and its articles as raw JSON", async function() {
      const response = await axios.get(baseLink + "/api/blogSync/testapikey/WN100", { validateStatus: () => true });
      should(response.status).eql(200);
      should(response.headers["content-type"]).match(/application\/json/);
      should(response.data.blog.name).eql("WN100");
      should(response.data.blog.status).eql("closed");
      should(response.data.blog.categories).eql(["Mapping"]);
      should(response.data.trackedFields).containEql("categoryEN");
      should(response.data.trackedFields).containEql("markdownDE");
      should(response.data.trackedBlogFields).containEql("teamStringDE");
      // teamString<LANG> never set on this fixture blog - must round-trip
      // as "" (see routes/api.js serializeFieldsForSync), not be dropped
      should(response.data.blog.teamStringDE).eql("");
      should(response.data.articles.length).eql(1);
      const article = response.data.articles[0];
      should(article.categoryEN).eql("Mapping");
      should(article.markdownDE).eql("* eins");
      should(article.markdownEN).eql("* one");
      // an unset field must round-trip as "" (see routes/api.js
      // serializeArticleForSync), never be silently dropped as undefined
      should(article.predecessorId).eql("");
    });

    it("should 404 for a non-existing blog", async function() {
      const response = await axios.get(baseLink + "/api/blogSync/testapikey/WN_DOES_NOT_EXIST", { validateStatus: () => true });
      should(response.status).eql(404);
    });
  });

  describe("POST /blogSync/apply (write endpoint) - safety net (a): eligibility", function() {
    beforeEach(function(bddone) {
      testutil.importData({
        clear: false,
        blog: [
          { name: "WN100", status: "closed", categories: ["Mapping"] },
          { name: "WN900", status: "edit", categories: ["Mapping"] }
        ],
        article: []
      }, bddone);
    });

    it("should reject with 409 when the blog is above maxBlogNumber", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 50, creates: [], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(409);
    });

    it("should reject with 409 when the blog is not closed, even under maxBlogNumber", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN900/apply",
        { maxBlogNumber: 1000, creates: [], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(409);
    });

    it("should not write anything for a dryRun even on an eligible blog", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, dryRun: true, creates: [{ localId: "a", fields: { categoryEN: "Mapping", title: "New", markdownDE: "* new" } }], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data).eql({ blog: "WN100", wouldCreate: 1, wouldPatch: 0, wouldPatchBlogFields: [], wouldPatchCategories: "none" });
      const articles = await articleModule.find({ blog: "WN100" });
      should(articles.length).eql(0);
    });
  });

  describe("POST /blogSync/apply (write endpoint) - create, patch, predecessorId remap, conflict handling", function() {
    let existingArticleId;

    beforeEach(function(bddone) {
      async.series([
        function(cb) {
          testutil.importData({
            clear: false,
            blog: [{ name: "WN100", status: "closed", categories: ["Mapping"] }],
            article: [{ blog: "WN100", title: "Existing article", categoryEN: "Mapping", markdownDE: "* original" }]
          }, cb);
        },
        function(cb) {
          articleModule.find({ blog: "WN100" }, function(err, articles) {
            if (err) return cb(err);
            existingArticleId = articles[0].id;
            cb();
          });
        }
      ], bddone);
    });

    it("should create new articles, attribute them to the synthetic wp-backport user, and remap a predecessorId chain between two new articles", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [
            { localId: "local-1", fields: { categoryEN: "Mapping", title: "First new article", markdownDE: "* first" } },
            { localId: "local-2", fields: { categoryEN: "Mapping", title: "Second new article", markdownDE: "* second", predecessorId: "local-1" } }
          ],
          patches: []
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.created.length).eql(2);
      should(response.data.errors).eql([]);

      const byLocalId = {};
      response.data.created.forEach((c) => { byLocalId[c.localId] = c.id; });

      const second = await articleModule.findById(byLocalId["local-2"]);
      should(second.predecessorId).eql(byLocalId["local-1"]);
      should(second.title).eql("Second new article");

      // attributed to the synthetic user, not a real OSM login
      const changeRows = await new Promise((resolve, reject) => {
        logModule.find(
          " where data->>'oid' = '" + byLocalId["local-1"] + "' and data->>'table' = 'article' and data->>'user' = 'wp-backport'",
          { column: "id", desc: false },
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      should(changeRows.length > 0).be.True();
    });

    it("should patch an existing article using the client-supplied old values for optimistic concurrency", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [],
          patches: [{ id: existingArticleId, changes: { markdownDE: "* corrected" }, old: { markdownDE: "* original" } }]
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.patched).eql([{ id: existingArticleId }]);
      should(response.data.conflicts).eql([]);

      const article = await articleModule.findById(existingArticleId);
      should(article.markdownDE).eql("* corrected");
    });

    it("should report a conflict (not abort the batch) when the old value no longer matches the live one", async function() {
      // Simulate a real editor having changed the article after the plan
      // was computed, but before this apply call ran.
      const liveArticle = await articleModule.findById(existingArticleId);
      await new Promise((resolve, reject) => {
        liveArticle.setAndSave({ OSMUser: "TheFive" }, { markdownDE: "* changed by a real editor meanwhile", old: { markdownDE: "* original" } }, (err) => (err ? reject(err) : resolve()));
      });

      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [{ localId: "local-1", fields: { categoryEN: "Mapping", title: "Unrelated new article", markdownDE: "* new" } }],
          patches: [{ id: existingArticleId, changes: { markdownDE: "* corrected" }, old: { markdownDE: "* original" } }]
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.conflicts.length).eql(1);
      should(response.data.conflicts[0].id).eql(existingArticleId);
      // the unrelated create in the same batch must still have gone through
      should(response.data.created.length).eql(1);

      const article = await articleModule.findById(existingArticleId);
      should(article.markdownDE).eql("* changed by a real editor meanwhile");
    });
  });

  describe("POST /blogSync/apply (write endpoint) - blog-level field patch (e.g. teamString<LANG>)", function() {
    beforeEach(function(bddone) {
      testutil.importData({
        clear: false,
        blog: [{ name: "WN100", status: "closed", categories: ["Mapping"], teamStringDE: "" }],
        article: []
      }, bddone);
    });

    it("should apply a blog-level patch and attribute it to the synthetic wp-backport user", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [],
          patches: [],
          blogPatch: { changes: { teamStringDE: "Alice, Bob" }, old: { teamStringDE: "" } }
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.blogPatched).eql(["teamStringDE"]);
      should(response.data.blogConflicts).eql({});

      const blog = await blogModule.findOne({ name: "WN100" });
      should(blog.teamStringDE).eql("Alice, Bob");

      const changeRows = await new Promise((resolve, reject) => {
        logModule.find(
          " where data->>'blog' = 'WN100' and data->>'table' = 'blog' and data->>'user' = 'wp-backport' and data->>'property' = 'teamStringDE'",
          { column: "id", desc: false },
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      should(changeRows.length).eql(1);
    });

    it("should report a blog-level conflict (not abort the article batch) when the old value no longer matches the live one", async function() {
      const liveBlog = await blogModule.findOne({ name: "WN100" });
      await new Promise((resolve, reject) => {
        liveBlog.setAndSave({ OSMUser: "TheFive" }, { teamStringDE: "changed by a real editor meanwhile" }, (err) => (err ? reject(err) : resolve()));
      });

      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [{ localId: "local-1", fields: { categoryEN: "Mapping", title: "Unrelated new article", markdownDE: "* new" } }],
          patches: [],
          blogPatch: { changes: { teamStringDE: "Alice, Bob" }, old: { teamStringDE: "" } }
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.blogConflicts.error).eql("Field teamStringDE already changed in DB");
      // the unrelated article create in the same batch must still have gone through
      should(response.data.created.length).eql(1);

      const blog = await blogModule.findOne({ name: "WN100" });
      should(blog.teamStringDE).eql("changed by a real editor meanwhile");
    });

    it("should be a no-op when no blogPatch is given", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, creates: [], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.blogPatched).eql([]);
      should(response.data.blogConflicts).eql({});
    });
  });

  describe("POST /blogSync/apply (write endpoint) - categories (pure-insertion auto-replace, see planCategoriesMerge)", function() {
    const mapping = { EN: "Mapping", DE: "Mapping" };
    const community = { EN: "Community", DE: "Community" };
    const releases = { EN: "Releases", DE: "Releases" };

    beforeEach(function(bddone) {
      testutil.importData({
        clear: false,
        blog: [{ name: "WN100", status: "closed", categories: [mapping, community] }],
        article: []
      }, bddone);
    });

    it("should replace categories when local only added to them (pure insertion), reporting categoriesAction", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, creates: [], patches: [], categories: [mapping, releases, community] },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.categoriesAction).eql("replace");
      should(response.data.categoriesConflict).eql(null);

      const blog = await blogModule.findOne({ name: "WN100" });
      should(blog.categories).eql([mapping, releases, community]);
    });

    it("should NOT apply when the diff isn't a pure insertion (a category removed), reporting categoriesAction: review", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, creates: [], patches: [], categories: [mapping] }, // community dropped
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.categoriesAction).eql("review");

      const blog = await blogModule.findOne({ name: "WN100" });
      should(blog.categories).eql([mapping, community]); // unchanged
    });

    it("should ignore the client's own precomputed decision and recompute against the blog's current live categories", async function() {
      // Simulate a real editor having already added "Releases" remotely
      // after the plan was computed - the client still thinks it's just
      // [mapping, community] remotely and sends what it believes is a
      // pure insertion, but the live state has moved on.
      const liveBlog = await blogModule.findOne({ name: "WN100" });
      await new Promise((resolve, reject) => {
        liveBlog.setAndSave({ OSMUser: "TheFive" }, { categories: [mapping, community, releases] }, (err) => (err ? reject(err) : resolve()));
      });

      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, creates: [], patches: [], categories: [mapping, releases, community] },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      // [mapping, community, releases] (remote) vs [mapping, releases, community]
      // (client) is a reorder, not a pure insertion, against the live state
      should(response.data.categoriesAction).eql("review");

      const blog = await blogModule.findOne({ name: "WN100" });
      should(blog.categories).eql([mapping, community, releases]); // untouched by this call
    });

    it("should be a no-op (categoriesAction: none) when no categories field is given", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, creates: [], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.categoriesAction).eql("none");
    });
  });
});
