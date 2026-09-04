import should from "should";
import testutil from "../test/testutil.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import { rollbackArticle, rollbackBlog } from "../wp-reconcile/blog-sync-merger/rollback.js";
import { withReopenedBlog } from "../wp-reconcile/blog-sync-merger/withReopenedBlog.js";
import { SYNTHETIC_MIGRATION_USER_NAME } from "../notification/migrationFilter.js";

const migrationUser = { OSMUser: SYNTHETIC_MIGRATION_USER_NAME };

describe("merger/rollback", function() {
  beforeEach(async function() {
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
});
