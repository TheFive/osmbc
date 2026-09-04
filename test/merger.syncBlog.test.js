import should from "should";
import nock from "nock";
import testutil from "../test/testutil.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import blogSyncMerger from "../wp-reconcile/blog-sync-merger/blogSyncMerger.js";
import { buildApplyBody, runSync } from "../wp-reconcile/blog-sync-merger/syncBlog.js";

const REMOTE = "http://fake-remote.test";

describe("wp-reconcile/blog-sync-merger/syncBlog", function() {
  describe("buildApplyBody", function() {
    it("should turn toCreate entries into { localId, fields } without the id key", function() {
      const plan = { toCreate: [{ id: 7, categoryEN: "Mapping", predecessorId: "" }], toPatch: [] };
      const body = buildApplyBody(plan, 500, true);
      should(body).eql({
        maxBlogNumber: 500,
        dryRun: true,
        creates: [{ localId: 7, fields: { categoryEN: "Mapping", predecessorId: "" } }],
        patches: []
      });
    });

    it("should pass toPatch entries straight through", function() {
      const plan = { toCreate: [], toPatch: [{ id: 5, changes: { markdownDE: "* a" }, old: { markdownDE: "* b" } }] };
      const body = buildApplyBody(plan, 500, false);
      should(body.patches).eql([{ id: 5, changes: { markdownDE: "* a" }, old: { markdownDE: "* b" } }]);
      should(body.dryRun).eql(false);
    });

    it("should include blogPatch when the plan has one", function() {
      const plan = { toCreate: [], toPatch: [], blogPatch: { changes: { teamStringDE: "Alice" }, old: { teamStringDE: "" } } };
      const body = buildApplyBody(plan, 500, false);
      should(body.blogPatch).eql({ changes: { teamStringDE: "Alice" }, old: { teamStringDE: "" } });
    });

    it("should omit blogPatch entirely when the plan has none", function() {
      const plan = { toCreate: [], toPatch: [], blogPatch: null };
      const body = buildApplyBody(plan, 500, false);
      should(body).not.have.property("blogPatch");
    });

    it("should include the raw local categories array whenever categoriesPlan carries one, regardless of its action", function() {
      const localCategories = [{ EN: "Mapping" }, { EN: "Releases" }];
      const plan = { toCreate: [], toPatch: [], categoriesPlan: { action: "review", localCategories, remoteCategories: [] } };
      const body = buildApplyBody(plan, 500, false);
      should(body.categories).eql(localCategories);
    });

    it("should omit categories entirely when there is no categoriesPlan", function() {
      const plan = { toCreate: [], toPatch: [] };
      const body = buildApplyBody(plan, 500, false);
      should(body).not.have.property("categories");
    });
  });

  describe("runSync (against a mocked remote)", function() {
    beforeEach(async function() {
      nock.cleanAll();
      await testutil.importData({
        initialise: true,
        clear: true,
        blog: [{ name: "WN100", status: "closed", categories: ["Mapping"] }],
        article: [
          { blog: "WN100", title: "Existing article", categoryEN: "Mapping", markdownDE: "* local corrected text" }
        ]
      });
    });

    afterEach(function() {
      nock.cleanAll();
    });

    it("should compute a plan and apply it against the mocked remote when commit is true", async function() {
      const localArticle = (await articleModule.find({ blog: "WN100" }))[0];
      const trackedFields = [...blogSyncMerger.BASE_TRACKED_FIELDS, "markdownDE"];

      nock(REMOTE)
        .get("/api/blogSync/testkey/WN100")
        .reply(200, {
          blog: { id: 999, name: "WN100", status: "closed", categories: ["Mapping"] },
          trackedFields,
          articles: [
            { id: localArticle.id, categoryEN: "Mapping", predecessorId: "", title: "Existing article", markdownDE: "* stale remote text" }
          ]
        });

      let capturedBody;
      nock(REMOTE)
        .post("/api/blogSync/testkey/WN100/apply", (body) => { capturedBody = body; return true; })
        .reply(200, { created: [], patched: [{ id: localArticle.id }], conflicts: [], errors: [] });

      const { plan, applyResult } = await runSync({
        blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true
      });

      should(plan.eligible).eql(true);
      should(plan.toPatch).eql([{ id: localArticle.id, changes: { markdownDE: "* local corrected text" }, old: { markdownDE: "* stale remote text" } }]);

      should(capturedBody.dryRun).eql(false);
      should(capturedBody.maxBlogNumber).eql(500);
      should(capturedBody.patches).eql([{ id: localArticle.id, changes: { markdownDE: "* local corrected text" }, old: { markdownDE: "* stale remote text" } }]);

      should(applyResult).eql({ created: [], patched: [{ id: localArticle.id }], conflicts: [], errors: [] });
      should(nock.isDone()).be.True();
    });

    it("should compute a blog-level field diff (e.g. teamStringDE) and include it in the apply body, reading the local blog as a live model instance", async function() {
      const localBlog = await blogModule.findOne({ name: "WN100" });
      await new Promise((resolve, reject) => {
        localBlog.setAndSave({ OSMUser: "wp-backport" }, { teamStringDE: "Alice, Bob" }, (err) => (err ? reject(err) : resolve()));
      });

      nock(REMOTE)
        .get("/api/blogSync/testkey/WN100")
        .reply(200, {
          blog: { id: 999, name: "WN100", status: "closed", categories: ["Mapping"], teamStringDE: "" },
          trackedFields: [...blogSyncMerger.BASE_TRACKED_FIELDS, "markdownDE"],
          trackedBlogFields: ["teamStringDE"],
          articles: []
        });

      let capturedBody;
      nock(REMOTE)
        .post("/api/blogSync/testkey/WN100/apply", (body) => { capturedBody = body; return true; })
        .reply(200, { created: [], patched: [], conflicts: [], errors: [], blogPatched: ["teamStringDE"], blogConflicts: {} });

      const { plan } = await runSync({ blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true });

      should(plan.blogPatch).eql({ changes: { teamStringDE: "Alice, Bob" }, old: { teamStringDE: "" } });
      should(capturedBody.blogPatch).eql({ changes: { teamStringDE: "Alice, Bob" }, old: { teamStringDE: "" } });
    });

    it("should send dryRun:true in the apply body when commit is false", async function() {
      const localArticle = (await articleModule.find({ blog: "WN100" }))[0];
      const trackedFields = [...blogSyncMerger.BASE_TRACKED_FIELDS, "markdownDE"];

      nock(REMOTE)
        .get("/api/blogSync/testkey/WN100")
        .reply(200, {
          blog: { id: 999, name: "WN100", status: "closed", categories: ["Mapping"] },
          trackedFields,
          articles: [{ id: localArticle.id, categoryEN: "Mapping", predecessorId: "", title: "Existing article", markdownDE: "* local corrected text" }]
        });

      let capturedBody;
      nock(REMOTE)
        .post("/api/blogSync/testkey/WN100/apply", (body) => { capturedBody = body; return true; })
        .reply(200, { blog: "WN100", wouldCreate: 0, wouldPatch: 0 });

      await runSync({ blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: false });

      should(capturedBody.dryRun).eql(true);
    });

    it("should never call the apply endpoint when the remote reports the blog as ineligible", async function() {
      nock(REMOTE)
        .get("/api/blogSync/testkey/WN100")
        .reply(200, {
          blog: { id: 999, name: "WN100", status: "edit", categories: ["Mapping"] }, // not closed
          trackedFields: [...blogSyncMerger.BASE_TRACKED_FIELDS, "markdownDE"],
          articles: []
        });
      // deliberately no POST .../apply interceptor - if runSync tried to
      // call it anyway, nock would throw on the unmatched request.

      const { plan, applyResult } = await runSync({
        blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true
      });

      should(plan.eligible).eql(false);
      should(applyResult).eql(null);
    });

    it("should reject when the local blog does not exist (never even calls the remote)", async function() {
      // deliberately no nock interceptor at all - if runSync tried to
      // reach the remote before checking the local blog, this would fail
      // with a network error instead of the expected message.
      let caught;
      try {
        await runSync({ blogName: "WN_MISSING", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true });
      } catch (err) {
        caught = err;
      }
      should.exist(caught);
      should(caught.message).match(/Local blog WN_MISSING not found/);
    });

    it("should reject with a descriptive error when the remote GET fails", async function() {
      nock(REMOTE).get("/api/blogSync/testkey/WN100").reply(401, "Not Authorised");
      let caught;
      try {
        await runSync({ blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true });
      } catch (err) {
        caught = err;
      }
      should.exist(caught);
      should(caught.message).match(/HTTP 401/);
    });
  });
});
