import should from "should";
import nock from "nock";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import testutil from "../test/testutil.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import blogSyncMerger from "../wp-reconcile/blog-sync-merger/blogSyncMerger.js";
import { buildApplyBody, runSync, resolveMode } from "../wp-reconcile/blog-sync-merger/syncBlog.js";
import syncState from "../wp-reconcile/blog-sync-merger/syncState.js";

const REMOTE = "http://fake-remote.test";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "..", "wp-reconcile", "blog-sync-merger", ".sync-state.json");

describe("wp-reconcile/blog-sync-merger/syncBlog", function() {
  // resolveMode/runReplace read+write the real, gitignored .sync-state.json
  // (not a test-scoped file) - preserve whatever a human running the actual
  // tool has accumulated there, same precaution as test/merger.syncState.test.js.
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

  describe("resolveMode (replace-vs-merge auto-detect)", function() {
    it("should pick \"replace\" when local and remote share zero article ids and both sides have articles", function() {
      const local = [{ id: 35281 }, { id: 35282 }];
      const remote = [{ id: 246 }, { id: 247 }];
      should(resolveMode("auto", local, remote)).eql("replace");
    });

    it("should pick \"merge\" when at least one article id is shared", function() {
      const local = [{ id: 11520 }, { id: 47687 }]; // one shared, one new
      const remote = [{ id: 11520 }];
      should(resolveMode("auto", local, remote)).eql("merge");
    });

    it("should pick \"merge\" when either side has no articles at all (nothing to distinguish rebuild-from-scratch from a genuinely empty/new blog)", function() {
      should(resolveMode("auto", [], [{ id: 1 }])).eql("merge");
      should(resolveMode("auto", [{ id: 1 }], [])).eql("merge");
      should(resolveMode("auto", [], [])).eql("merge");
    });

    it("should honor an explicit mode regardless of id overlap", function() {
      should(resolveMode("merge", [{ id: 1 }], [{ id: 2 }])).eql("merge");
      should(resolveMode("replace", [{ id: 1 }], [{ id: 1 }])).eql("replace");
    });
  });

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

    it("should include the full local closeFlags snapshot whenever localCloseFlags is non-empty", function() {
      const plan = { toCreate: [], toPatch: [], localCloseFlags: { closeCZ: true, closeDE: false } };
      const body = buildApplyBody(plan, 500, false);
      should(body.closeFlags).eql({ closeCZ: true, closeDE: false });
    });

    it("should omit closeFlags entirely when localCloseFlags is empty or absent", function() {
      should(buildApplyBody({ toCreate: [], toPatch: [], localCloseFlags: {} }, 500, false)).not.have.property("closeFlags");
      should(buildApplyBody({ toCreate: [], toPatch: [] }, 500, false)).not.have.property("closeFlags");
    });

    it("should include mode: \"replace\" when the plan is a replace plan, and omit it otherwise", function() {
      const replacePlan = { mode: "replace", toCreate: [], toPatch: [] };
      should(buildApplyBody(replacePlan, 500, false).mode).eql("replace");
      const mergePlan = { toCreate: [], toPatch: [] };
      should(buildApplyBody(mergePlan, 500, false)).not.have.property("mode");
    });
  });

  describe("runSync (against a mocked remote)", function() {
    beforeEach(async function() {
      nock.cleanAll();
      fs.writeFileSync(STATE_FILE, "{}\n", "utf8"); // isolate replace-idempotency tests from each other; restored in the outer after()
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
            { id: localArticle.id, categoryEN: "Mapping", predecessorId: "", unpublishReason: "", title: "Existing article", markdownDE: "* stale remote text" }
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

    describe("old-era replace mode (auto-detect + idempotency, see CLAUDE.local.md)", function() {
      it("should auto-detect replace mode when local and remote share zero article ids, and send mode:\"replace\" to /apply", async function() {
        const localArticle = (await articleModule.find({ blog: "WN100" }))[0];
        const remoteOnlyId = localArticle.id + 999999; // guaranteed disjoint from the local id

        nock(REMOTE)
          .get("/api/blogSync/testkey/WN100")
          .reply(200, {
            blog: { id: 999, name: "WN100", status: "closed", categories: ["Not Translated"] },
            trackedFields: [...blogSyncMerger.BASE_TRACKED_FIELDS, "markdownDE"],
            articles: [{ id: remoteOnlyId, categoryEN: "Not Translated", predecessorId: "", title: "old stub", markdownDE: "* raw import" }]
          });

        let capturedBody;
        nock(REMOTE)
          .post("/api/blogSync/testkey/WN100/apply", (body) => { capturedBody = body; return true; })
          .reply(200, { trashed: [{ id: remoteOnlyId }], created: [{ localId: localArticle.id, id: 555 }], patched: [], conflicts: [], errors: [] });

        const { plan, applyResult } = await runSync({ blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true });

        should(plan.mode).eql("replace");
        should(plan.toTrash).eql([{ id: remoteOnlyId, categoryEN: "Not Translated", title: "old stub" }]);
        should(plan.toCreate.map((a) => a.id)).eql([localArticle.id]);
        should(plan.categoriesPlan.action).eql("replace");

        should(capturedBody.mode).eql("replace");
        should(capturedBody.creates).eql([{ localId: localArticle.id, fields: { categoryEN: "Mapping", predecessorId: "", unpublishReason: "", title: "Existing article", markdownDE: "* local corrected text" } }]);

        should(applyResult.created).eql([{ localId: localArticle.id, id: 555 }]);
        // the create must have been recorded as a replace-marker, not the
        // plain knownRemoteIds map a normal merge run would use
        should(syncState.isReplaced("WN100")).eql(true);
        should(syncState.loadReplacedCreatedIds("WN100")).eql(["555"]);
        should(syncState.loadKnownRemoteIds("WN100").size).eql(0);
      });

      it("should skip the /apply call entirely on a re-run once already marked replaced with a matching article count", async function() {
        const localArticle = (await articleModule.find({ blog: "WN100" }))[0];
        syncState.markReplaced("WN100", [{ localId: localArticle.id, id: 555 }]);

        nock(REMOTE)
          .get("/api/blogSync/testkey/WN100")
          .reply(200, {
            blog: { id: 999, name: "WN100", status: "closed", categories: ["Mapping"] },
            trackedFields: [...blogSyncMerger.BASE_TRACKED_FIELDS, "markdownDE"],
            // remote now has exactly 1 article (the earlier replace's own
            // creation) - same count as local, so the marker short-circuits.
            articles: [{ id: 555, categoryEN: "Mapping", predecessorId: "", title: "Existing article", markdownDE: "* local corrected text" }]
          });
        // deliberately no POST .../apply interceptor - nock would throw if
        // runSync tried to call it anyway.

        const { plan, applyResult } = await runSync({ blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true });

        should(plan.mode).eql("replace");
        should(applyResult.skipped).match(/already replaced/);
      });

      // Real full-range-run finding (see CLAUDE.local.md): after a replace,
      // both sides independently assign fresh ids to that blog's articles -
      // those ranges can coincidentally overlap even though neither id was
      // ever derived from the other. A naive re-run of the 0-shared-ids
      // test would then see a nonzero overlap and misroute into a merge
      // that patches unrelated articles sharing only a numeric id.
      it("should stay in replace mode on a re-run even when a coincidental id overlap would otherwise fool the 0-shared-ids test", async function() {
        const localArticle = (await articleModule.find({ blog: "WN100" }))[0];
        // A previous replace run completed and recorded its marker...
        syncState.markReplaced("WN100", [{ localId: localArticle.id, id: 999999 }]);

        // ...but this mock simulates the coincidence found for real: the
        // CURRENT remote article set happens to include an id numerically
        // equal to the LOCAL article's own id (pure coincidence, unrelated
        // content) - and the remote count (2) differs from local's (1), so
        // the marker+count skip-check must NOT short-circuit either; this
        // must go through a real replace (trash both remote articles,
        // create the local one), never a merge patch.
        nock(REMOTE)
          .get("/api/blogSync/testkey/WN100")
          .reply(200, {
            blog: { id: 999, name: "WN100", status: "closed", categories: ["Mapping"] },
            trackedFields: [...blogSyncMerger.BASE_TRACKED_FIELDS, "markdownDE"],
            articles: [
              { id: localArticle.id, categoryEN: "Community", predecessorId: "", title: "unrelated coincidence", markdownDE: "* unrelated content" },
              { id: 42, categoryEN: "Mapping", predecessorId: "", title: "another leftover", markdownDE: "* leftover" }
            ]
          });

        let capturedBody;
        nock(REMOTE)
          .post("/api/blogSync/testkey/WN100/apply", (body) => { capturedBody = body; return true; })
          .reply(200, { trashed: [{ id: localArticle.id }, { id: 42 }], created: [{ localId: localArticle.id, id: 1234 }], patched: [], conflicts: [], errors: [] });

        const { plan } = await runSync({ blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true, mode: "auto" });

        should(plan.mode).eql("replace");
        should(capturedBody.mode).eql("replace");
        should(capturedBody.patches).eql([]);
      });

      it("should honor an explicit --mode merge even when ids don't overlap, never switching to replace on its own", async function() {
        const localArticle = (await articleModule.find({ blog: "WN100" }))[0];
        const remoteOnlyId = localArticle.id + 999999;

        nock(REMOTE)
          .get("/api/blogSync/testkey/WN100")
          .reply(200, {
            blog: { id: 999, name: "WN100", status: "closed", categories: ["Mapping"] },
            trackedFields: [...blogSyncMerger.BASE_TRACKED_FIELDS, "markdownDE"],
            articles: [{ id: remoteOnlyId, categoryEN: "Mapping", predecessorId: "", title: "unrelated", markdownDE: "* x" }]
          });

        let capturedBody;
        nock(REMOTE)
          .post("/api/blogSync/testkey/WN100/apply", (body) => { capturedBody = body; return true; })
          .reply(200, { created: [{ localId: localArticle.id, id: 555 }], patched: [], conflicts: [], errors: [] });

        const { plan } = await runSync({ blogName: "WN100", remoteUrl: REMOTE, apiKey: "testkey", maxBlogNumber: 500, commit: true, mode: "merge" });

        should(plan.mode || "merge").eql("merge");
        should(capturedBody).not.have.property("mode");
      });
    });
  });
});
