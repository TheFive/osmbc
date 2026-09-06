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
      // trackedBlogFields: startDate/endDate + teamString<LANG> per
      // language (see routes/api.js getSyncTrackedBlogFields).
      should(response.data.trackedBlogFields).containEql("startDate");
      should(response.data.trackedBlogFields).containEql("endDate");
      should(response.data.trackedBlogFields).containEql("teamStringDE");
      should(response.data.blog).have.property("startDate");
      should(response.data.blog).have.property("teamStringDE");
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
      should(response.data).eql({ blog: "WN100", mode: "merge", wouldTrash: 0, wouldCreate: 1, wouldPatch: 0, wouldPatchBlogFields: [], wouldPatchCategories: "none", wouldPatchCloseFlags: [] });
      const articles = await articleModule.find({ blog: "WN100" });
      should(articles.length).eql(0);
    });

    // Real batch run incident (WN302, WN362, see CLAUDE.local.md): a blog
    // with many articles across many languages produces an apply body well
    // over express.json()'s 100kb default, rejected with a 413 before ever
    // reaching this route - app.js now raises that limit for the whole app.
    it("should accept an apply payload well over the old 100kb default limit", async function() {
      const bigMarkdown = "* ".repeat(60000); // ~120kb on its own
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, dryRun: true, creates: [{ localId: "a", fields: { categoryEN: "Mapping", title: "New", markdownDE: bigMarkdown } }], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
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

    // config.test.yaml: apiKeys["testapikey.dataadmin"] = "dataAdmin-TestUser"
    // - a data admin's own key gets their own configured apiKeys value as
    // its attribution, not the shared wp-backport fallback (see
    // routes/api.js getBlogSyncUser, CLAUDE.local.md 2026-09-05).
    it("should attribute a write to the calling key's own configured apiKeys value", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey.dataadmin/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [{ localId: "local-1", fields: { categoryEN: "Mapping", title: "Data admin article", markdownDE: "* by a data admin" } }],
          patches: []
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.created.length).eql(1);
      const createdId = response.data.created[0].id;

      const changeRows = await new Promise((resolve, reject) => {
        logModule.find(
          " where data->>'oid' = '" + createdId + "' and data->>'table' = 'article' and data->>'user' = 'dataAdmin-TestUser'",
          { column: "id", desc: false },
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      should(changeRows.length > 0).be.True();

      // and NOT under the wp-backport fallback name
      const wpBackportRows = await new Promise((resolve, reject) => {
        logModule.find(
          " where data->>'oid' = '" + createdId + "' and data->>'table' = 'article' and data->>'user' = 'wp-backport'",
          { column: "id", desc: false },
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      should(wpBackportRows.length).eql(0);
    });

    // config.test.yaml: apiKeys["testapikey"] = "wp-backport" - the existing
    // Blog-Sync-Merger flow's key, deliberately configured with that value
    // (same as config.development.yaml's DevelopmentApiKey) rather than a
    // free-text description, so this flow's attribution stays unchanged.
    it("should attribute a write to \"wp-backport\" for the existing flow's key (existing flow unchanged)", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [{ localId: "local-1", fields: { categoryEN: "Mapping", title: "Existing-flow article", markdownDE: "* unchanged" } }],
          patches: []
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      const createdId = response.data.created[0].id;
      const changeRows = await new Promise((resolve, reject) => {
        logModule.find(
          " where data->>'oid' = '" + createdId + "' and data->>'table' = 'article' and data->>'user' = 'wp-backport'",
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

    // Real WN275 dry/commit run incident (see CLAUDE.local.md,
    // blogSyncMerger.js BASE_TRACKED_FIELDS): Article.prototype.setAndSave
    // (model/article.js) refuses to set categoryEN to "--unpublished--"
    // unless the write itself carries a non-empty unpublishReason.
    // syncBlog.js now tracks unpublishReason as an ordinary field, so a
    // real unpublish correction's patch carries it along automatically -
    // this exercises the write succeeding with it present, and still
    // failing (as before, not silently) without it.
    it("should apply a categoryEN unpublish patch when unpublishReason is included in the same patch", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [],
          patches: [{
            id: existingArticleId,
            changes: { categoryEN: "--unpublished--", unpublishReason: "never made it into the published post" },
            old: { categoryEN: "Mapping", unpublishReason: "" }
          }]
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.patched).eql([{ id: existingArticleId }]);
      should(response.data.errors).eql([]);

      const article = await articleModule.findById(existingArticleId);
      should(article.categoryEN).eql("--unpublished--");
      should(article.unpublishReason).eql("never made it into the published post");
    });

    it("should still report an error (not corrupt anything) for a categoryEN unpublish patch missing unpublishReason", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [],
          patches: [{ id: existingArticleId, changes: { categoryEN: "--unpublished--" }, old: { categoryEN: "Mapping" } }]
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.patched).eql([]);
      should(response.data.errors.length).eql(1);
      should(response.data.errors[0].error).match(/Missing reason for unpublishing/);

      const article = await articleModule.findById(existingArticleId);
      should(article.categoryEN).eql("Mapping"); // untouched
    });
  });

  // The `blogPatch` mechanism is still live and used (e.g. a manual revert
  // of a mistakenly-synced blog field), even though getSyncTrackedBlogFields
  // currently returns [] so planMerge won't PRODUCE one on its own -
  // teamStringDE is just a convenient real blog field to exercise it with.
  describe("POST /blogSync/apply (write endpoint) - blog-level field patch via blogPatch", function() {
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

  describe("POST /blogSync/apply (write endpoint) - close<LANG> flags (see render/Renderer.js's onlyClosed gate)", function() {
    let articleId;

    beforeEach(function(bddone) {
      testutil.importData({
        clear: false,
        blog: [{ name: "WN100", status: "closed", categories: ["Mapping"], closeFR: false }],
        article: [{ blog: "WN100", title: "Existing article", categoryEN: "Mapping", markdownFR: "* original" }]
      }, function(err) {
        if (err) return bddone(err);
        articleModule.find({ blog: "WN100" }, function(err, articles) {
          if (err) return bddone(err);
          articleId = articles[0].id;
          bddone();
        });
      });
    });

    // The actual bug this whole feature exists to avoid: setting closeFR
    // true *before* patching markdownFR would lock that very patch via
    // Article.isChangeAllowed - closeFlags must only take effect once
    // every article patch in this same request has already gone through.
    it("should apply a markdownFR patch AND set closeFR true in the same request, without the flag locking its own batch's patch", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          creates: [],
          patches: [{ id: articleId, changes: { markdownFR: "* corrected" }, old: { markdownFR: "* original" } }],
          closeFlags: { closeFR: true }
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.patched).eql([{ id: articleId }]);
      should(response.data.conflicts).eql([]);
      should(response.data.closeFlagsPatched).eql(["closeFR"]);

      const article = await articleModule.findById(articleId);
      should(article.markdownFR).eql("* corrected");
      const blog = await blogModule.findOne({ name: "WN100" });
      should(blog.closeFR).eql(true);
    });

    it("should recompute closeFlags against live state, not a stale client value", async function() {
      const liveBlog = await blogModule.findOne({ name: "WN100" });
      await new Promise((resolve, reject) => {
        liveBlog.setAndSave({ OSMUser: "TheFive" }, { closeFR: true }, (err) => (err ? reject(err) : resolve()));
      });

      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, creates: [], patches: [], closeFlags: { closeFR: true } },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      // already true remotely - nothing left to patch, reported as such
      should(response.data.closeFlagsPatched).eql([]);
    });

    it("should be a no-op when no closeFlags field is given", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, creates: [], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.closeFlagsPatched).eql([]);
      const blog = await blogModule.findOne({ name: "WN100" });
      should(blog.closeFR).eql(false); // untouched
    });
  });

  describe("POST /blogSync/apply (write endpoint) - mode: \"replace\" (old-era wholesale replace, see CLAUDE.local.md)", function() {
    let originalArticleId;

    beforeEach(function(bddone) {
      testutil.importData({
        clear: false,
        blog: [
          { name: "WN100", status: "closed", categories: ["Not Translated"] },
          { name: "WN900", status: "closed", categories: ["Mapping"] } // above the default replace ceiling (271)
        ],
        article: [{ blog: "WN100", title: "Old stub", categoryEN: "Not Translated", markdownDE: "* raw wp import" }]
      }, function(err) {
        if (err) return bddone(err);
        articleModule.find({ blog: "WN100" }, function(err, articles) {
          if (err) return bddone(err);
          originalArticleId = articles[0].id;
          bddone();
        });
      });
    });

    it("should reject mode: \"replace\" with 409 above the configured blogSyncReplaceMaxBlogNumber ceiling", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN900/apply",
        { maxBlogNumber: 1000, mode: "replace", creates: [], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(409);
    });

    it("dry run should report wouldTrash as the blog's current live article count, only for mode: \"replace\"", async function() {
      const mergeResponse = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, dryRun: true, creates: [], patches: [] },
        { validateStatus: () => true }
      );
      should(mergeResponse.data.mode).eql("merge");
      should(mergeResponse.data.wouldTrash).eql(0);

      const replaceResponse = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, dryRun: true, mode: "replace", creates: [{ localId: "local-1", fields: { categoryEN: "Mapping", title: "New", markdownDE: "* new" } }], patches: [] },
        { validateStatus: () => true }
      );
      should(replaceResponse.data.mode).eql("replace");
      should(replaceResponse.data.wouldTrash).eql(1);
      should(replaceResponse.data.wouldCreate).eql(1);

      // dry run must not have written anything
      const articles = await articleModule.find({ blog: "WN100" });
      should(articles.length).eql(1);
    });

    it("should trash every existing article, create the replacement set, and replace categories unconditionally", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        {
          maxBlogNumber: 1000,
          mode: "replace",
          creates: [
            { localId: "local-1", fields: { categoryEN: "Mapping", title: "Rebuilt article one", markdownDE: "* rebuilt one" } },
            { localId: "local-2", fields: { categoryEN: "Mapping", title: "Rebuilt article two", markdownDE: "* rebuilt two" } }
          ],
          patches: [],
          categories: ["Mapping"] // not a subsequence of remote's ["Not Translated"] - planCategoriesMerge alone would say "review"
        },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.trashed).eql([{ id: originalArticleId }]);
      should(response.data.created.length).eql(2);
      should(response.data.errors).eql([]);
      should(response.data.categoriesAction).eql("replace");

      const original = await articleModule.findById(originalArticleId);
      should(original.blog).eql("Trash");
      should(original.categoryEN).eql("--unpublished--");

      const live = await articleModule.find({ blog: "WN100" });
      should(live.length).eql(2);
      should(live.map((a) => a.title).sort()).eql(["Rebuilt article one", "Rebuilt article two"]);

      const blog = await blogModule.findOne({ name: "WN100" });
      should(blog.categories).eql(["Mapping"]);
      should(blog.status).eql("closed"); // reopen/restore cycle must not leave it stuck open

      // attributed to the synthetic user, both the trash and the create
      const trashRows = await new Promise((resolve, reject) => {
        logModule.find(
          " where data->>'oid' = '" + originalArticleId + "' and data->>'table' = 'article' and data->>'user' = 'wp-backport' and data->>'property' = 'blog' and data->>'to' = 'Trash'",
          { column: "id", desc: false },
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      should(trashRows.length).eql(1);
    });

    it("should default patches to a no-op in replace mode (nothing to patch, everything is trash-then-create)", async function() {
      const response = await axios.post(
        baseLink + "/api/blogSync/testapikey/WN100/apply",
        { maxBlogNumber: 1000, mode: "replace", creates: [], patches: [] },
        { validateStatus: () => true }
      );
      should(response.status).eql(200);
      should(response.data.trashed).eql([{ id: originalArticleId }]);
      should(response.data.created).eql([]);
    });
  });
});
