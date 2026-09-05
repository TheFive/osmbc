import should from "should";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import testutil from "../test/testutil.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import { rollbackArticle, rollbackBlog, rollbackReplace } from "../wp-reconcile/blog-sync-merger/rollback.js";
import { withReopenedBlog } from "../wp-reconcile/blog-sync-merger/withReopenedBlog.js";
import { SYNTHETIC_MIGRATION_USER_NAME } from "../notification/migrationFilter.js";
import syncState from "../wp-reconcile/blog-sync-merger/syncState.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "..", "wp-reconcile", "blog-sync-merger", ".sync-state.json");

const migrationUser = { OSMUser: SYNTHETIC_MIGRATION_USER_NAME };

describe("merger/rollback", function() {
  // rollbackReplace reads the real, gitignored .sync-state.json (not a
  // test-scoped file) via syncState.loadReplacedCreatedIds - preserve
  // whatever a human running the actual tool has accumulated there, same
  // precaution as test/merger.syncState.test.js.
  let originalStateContent;
  before(function() {
    try {
      originalStateContent = fs.readFileSync(STATE_FILE, "utf8");
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      originalStateContent = null;
    }
  });
  after(function() {
    if (originalStateContent === null) {
      try { fs.unlinkSync(STATE_FILE); } catch (err) { if (err.code !== "ENOENT") throw err; }
    } else {
      fs.writeFileSync(STATE_FILE, originalStateContent, "utf8");
    }
  });

  beforeEach(async function() {
    fs.writeFileSync(STATE_FILE, "{}\n", "utf8"); // isolate from other tests; restored in the outer after()
    await testutil.importData({
      initialise: true,
      clear: true,
      blog: [{ name: "WN100", status: "closed", categories: ["Mapping"] }],
      article: [{ blog: "WN100", title: "Article one", categoryEN: "Mapping", markdownDE: "* original" }]
    });
  });

  describe("rollbackArticle", function() {
    it("should be a no-op when the migration never touched the article", async function() {
      const article = (await articleModule.find({ blog: "WN100" }))[0];
      const result = await new Promise((resolve, reject) => rollbackArticle(article.id, (err, r) => (err ? reject(err) : resolve(r))));
      should(result).eql({ articleId: article.id, reverted: [], skipped: true });
      const after = await articleModule.findById(article.id);
      should(after.markdownDE).eql("* original");
    });

    it("should revert a field the migration changed back to its pre-migration value", async function() {
      const article = (await articleModule.find({ blog: "WN100" }))[0];
      await new Promise((resolve, reject) => {
        article.setAndSave(migrationUser, { markdownDE: "* corrected by migration", old: { markdownDE: "* original" } }, (err) => (err ? reject(err) : resolve()));
      });

      const result = await new Promise((resolve, reject) => rollbackArticle(article.id, (err, r) => (err ? reject(err) : resolve(r))));
      should(result.reverted).eql(["markdownDE"]);

      const after = await articleModule.findById(article.id);
      should(after.markdownDE).eql("* original");
    });

    it("should revert to the value before the FIRST migration write, when the migration touched a field more than once", async function() {
      const article = (await articleModule.find({ blog: "WN100" }))[0];
      await new Promise((resolve, reject) => {
        article.setAndSave(migrationUser, { markdownDE: "* first migration pass", old: { markdownDE: "* original" } }, (err) => (err ? reject(err) : resolve()));
      });
      const reloaded = await articleModule.findById(article.id);
      await new Promise((resolve, reject) => {
        reloaded.setAndSave(migrationUser, { markdownDE: "* second migration pass", old: { markdownDE: "* first migration pass" } }, (err) => (err ? reject(err) : resolve()));
      });

      const result = await new Promise((resolve, reject) => rollbackArticle(article.id, (err, r) => (err ? reject(err) : resolve(r))));
      should(result.reverted).eql(["markdownDE"]);

      const after = await articleModule.findById(article.id);
      should(after.markdownDE).eql("* original");
    });

    it("should report a conflict instead of clobbering a real editor's change made after the migration ran", async function() {
      const article = (await articleModule.find({ blog: "WN100" }))[0];
      await new Promise((resolve, reject) => {
        article.setAndSave(migrationUser, { markdownDE: "* corrected by migration", old: { markdownDE: "* original" } }, (err) => (err ? reject(err) : resolve()));
      });
      const afterMigration = await articleModule.findById(article.id);
      await new Promise((resolve, reject) => {
        afterMigration.setAndSave({ OSMUser: "TheFive" }, { markdownDE: "* a real editor improved this afterwards", old: { markdownDE: "* corrected by migration" } }, (err) => (err ? reject(err) : resolve()));
      });

      const result = await new Promise((resolve, reject) => rollbackArticle(article.id, (err, r) => (err ? reject(err) : resolve(r))));
      should(result.conflict).eql(true);

      // the real editor's change must survive untouched
      const after = await articleModule.findById(article.id);
      should(after.markdownDE).eql("* a real editor improved this afterwards");
    });

    it("should treat reverting to the same value as a no-op (net-zero migration edits)", async function() {
      const article = (await articleModule.find({ blog: "WN100" }))[0];
      await new Promise((resolve, reject) => {
        article.setAndSave(migrationUser, { markdownDE: "* temporary", old: { markdownDE: "* original" } }, (err) => (err ? reject(err) : resolve()));
      });
      const reloaded = await articleModule.findById(article.id);
      await new Promise((resolve, reject) => {
        reloaded.setAndSave(migrationUser, { markdownDE: "* original", old: { markdownDE: "* temporary" } }, (err) => (err ? reject(err) : resolve()));
      });

      const result = await new Promise((resolve, reject) => rollbackArticle(article.id, (err, r) => (err ? reject(err) : resolve(r))));
      should(result.reverted).eql([]);

      const after = await articleModule.findById(article.id);
      should(after.markdownDE).eql("* original");
    });
  });

  describe("rollbackBlog", function() {
    it("should revert every migration-touched article in the blog, independently of each other's outcome", async function() {
      const article = (await articleModule.find({ blog: "WN100" }))[0];
      // categoryEN is locked by Article.isChangeAllowed while the blog is
      // closed (see merger/withReopenedBlog.js) - simulate the real write
      // path (routes/api.js applyBlogSync) reopening the blog around it,
      // exactly like the actual migration would.
      const blog = await blogModule.findOne({ name: "WN100" });
      await new Promise((resolve, reject) => {
        withReopenedBlog(blog, migrationUser, function(done) {
          article.setAndSave(migrationUser, { markdownDE: "* corrected", categoryEN: "Community", old: { markdownDE: "* original", categoryEN: "Mapping" } }, done);
        }, (err) => (err ? reject(err) : resolve()));
      });

      const results = await new Promise((resolve, reject) => rollbackBlog("WN100", (err, r) => (err ? reject(err) : resolve(r))));
      should(results.length).eql(1);
      should(results[0].reverted.sort()).eql(["categoryEN", "markdownDE"]);

      const after = await articleModule.findById(article.id);
      should(after.markdownDE).eql("* original");
      should(after.categoryEN).eql("Mapping");
    });

    it("should return an empty result for a blog the migration never touched", async function() {
      const results = await new Promise((resolve, reject) => rollbackBlog("WN100", (err, r) => (err ? reject(err) : resolve(r))));
      should(results).eql([]);
    });
  });

  describe("rollbackReplace (old-era wholesale replace, see merger/blogSyncMerger.js planReplace)", function() {
    // Mirrors exactly what routes/api.js applyBlogSync's doTrashExisting
    // does for one article: categoryEN -> "--unpublished--", THEN
    // blog -> "Trash", each a separate setAndSave (see model/article.js).
    function trashLikeReplaceRun(blog, article, cb) {
      withReopenedBlog(blog, migrationUser, function(done) {
        article.setAndSave(migrationUser, { categoryEN: "--unpublished--", unpublishReason: "superseded by rebuild", version: article.version }, function(err) {
          if (err) return done(err);
          articleModule.findById(article.id, function(err, reloaded) {
            if (err) return done(err);
            reloaded.setAndSave(migrationUser, { blog: "Trash", unpublishReason: "superseded by rebuild", version: reloaded.version }, done);
          });
        });
      }, cb);
    }

    // Mirrors routes/api.js applyBlogSync's doCreates for one article.
    function createLikeReplaceRun(blog, fields, cb) {
      withReopenedBlog(blog, migrationUser, function(done) {
        articleModule.createNewArticle(function(err, article) {
          if (err) return done(err);
          article.setAndSave(migrationUser, { ...fields, version: article.version }, function(err) {
            done(err, article);
          });
        });
      }, cb);
    }

    it("should un-trash the original article and trash the article the replace run created", async function() {
      const original = (await articleModule.find({ blog: "WN100" }))[0];
      const blog = await blogModule.findOne({ name: "WN100" });

      await new Promise((resolve, reject) => trashLikeReplaceRun(blog, original, (err) => (err ? reject(err) : resolve())));
      const created = await new Promise((resolve, reject) => {
        createLikeReplaceRun(blog, { blog: "WN100", categoryEN: "Mapping", title: "Rebuilt", markdownDE: "* rebuilt" }, (err, article) => (err ? reject(err) : resolve(article)));
      });
      syncState.markReplaced("WN100", [{ localId: "local-1", id: created.id }]);

      const result = await new Promise((resolve, reject) => rollbackReplace("WN100", (err, r) => (err ? reject(err) : resolve(r))));
      should(result.untrashed.length).eql(1);
      should(result.untrashed[0].reverted).containEql("blog");
      should(result.untrashed[0].reverted).containEql("categoryEN");
      should(result.trashed).eql([{ articleId: created.id, trashed: true }]);

      const revertedOriginal = await articleModule.findById(original.id);
      should(revertedOriginal.blog).eql("WN100");
      should(revertedOriginal.categoryEN).eql("Mapping");

      const nowTrashedCreated = await articleModule.findById(created.id);
      should(nowTrashedCreated.blog).eql("Trash");
      should(nowTrashedCreated.categoryEN).eql("--unpublished--");
    });

    it("should be a no-op for a blog the migration never replaced", async function() {
      const result = await new Promise((resolve, reject) => rollbackReplace("WN100", (err, r) => (err ? reject(err) : resolve(r))));
      should(result).eql({ untrashed: [], trashed: [] });
    });

    it("should still un-trash the original even when the syncState marker for the created article is missing", async function() {
      const original = (await articleModule.find({ blog: "WN100" }))[0];
      const blog = await blogModule.findOne({ name: "WN100" });
      await new Promise((resolve, reject) => trashLikeReplaceRun(blog, original, (err) => (err ? reject(err) : resolve())));
      // deliberately no syncState.markReplaced call - simulates rolling
      // back after the local .sync-state.json was lost/cleared

      const result = await new Promise((resolve, reject) => rollbackReplace("WN100", (err, r) => (err ? reject(err) : resolve(r))));
      should(result.untrashed.length).eql(1);
      should(result.trashed).eql([]);

      const revertedOriginal = await articleModule.findById(original.id);
      should(revertedOriginal.blog).eql("WN100");
    });
  });
});
