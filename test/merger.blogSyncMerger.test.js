import should from "should";
import blogSyncMerger from "../wp-reconcile/blog-sync-merger/blogSyncMerger.js";

const {
  extractBlogNumber,
  checkBlogEligibility,
  planArticleMerge,
  planCategoriesMerge,
  remapPredecessorIds,
  planMerge,
  BASE_TRACKED_FIELDS
} = blogSyncMerger;

const TRACKED = [...BASE_TRACKED_FIELDS, "markdownDE", "markdownEN"];

describe("merger/blogSyncMerger", function() {
  describe("extractBlogNumber", function() {
    it("should parse a WN name", function() {
      should(extractBlogNumber("WN842")).eql(842);
    });
    it("should be case insensitive", function() {
      should(extractBlogNumber("wn12")).eql(12);
    });
    it("should return null for a non-WN name", function() {
      should(extractBlogNumber("TBC")).eql(null);
    });
    it("should return null for non-string input", function() {
      should(extractBlogNumber(undefined)).eql(null);
    });
  });

  describe("checkBlogEligibility", function() {
    it("should be eligible for a closed WN blog under the ceiling", function() {
      const result = checkBlogEligibility({ name: "WN100", status: "closed" }, { maxBlogNumber: 200 });
      should(result).eql({ eligible: true });
    });
    it("should reject a missing blog", function() {
      const result = checkBlogEligibility(null, { maxBlogNumber: 200 });
      should(result.eligible).eql(false);
    });
    it("should reject a non-WN blog", function() {
      const result = checkBlogEligibility({ name: "TBC", status: "closed" }, { maxBlogNumber: 200 });
      should(result.eligible).eql(false);
      should(result.reason).match(/not a WN issue/);
    });
    it("should reject a blog above maxBlogNumber (still active/too recent)", function() {
      const result = checkBlogEligibility({ name: "WN300", status: "closed" }, { maxBlogNumber: 200 });
      should(result.eligible).eql(false);
      should(result.reason).match(/above maxBlogNumber/);
    });
    it("should reject a blog that is not closed, even if under the ceiling", function() {
      const result = checkBlogEligibility({ name: "WN100", status: "edit" }, { maxBlogNumber: 200 });
      should(result.eligible).eql(false);
      should(result.reason).match(/only "closed" blogs/);
    });
    it("should allow an unbounded check (no maxBlogNumber given)", function() {
      const result = checkBlogEligibility({ name: "WN9999", status: "closed" });
      should(result).eql({ eligible: true });
    });
  });

  describe("planArticleMerge", function() {
    it("should classify a local-only article as toCreate", function() {
      const local = [{ id: 1, categoryEN: "Mapping", markdownDE: "* a", markdownEN: "* a" }];
      const remote = [];
      const plan = planArticleMerge(local, remote, TRACKED);
      should(plan.toCreate).eql(local);
      should(plan.toPatch).eql([]);
      should(plan.unchanged).eql([]);
      should(plan.remoteOnly).eql([]);
    });

    it("should classify a matched, identical article as unchanged", function() {
      const shared = { id: 5, categoryEN: "Mapping", predecessorId: null, title: "T", markdownDE: "* a", markdownEN: "* a" };
      const plan = planArticleMerge([shared], [shared], TRACKED);
      should(plan.toCreate).eql([]);
      should(plan.toPatch).eql([]);
      should(plan.unchanged).eql([{ id: 5 }]);
    });

    it("should classify a matched article with a content diff as toPatch, with old values from remote", function() {
      const local = { id: 5, categoryEN: "Mapping", markdownDE: "* corrected", markdownEN: "* a" };
      const remote = { id: 5, categoryEN: "Mapping", markdownDE: "* original", markdownEN: "* a" };
      const plan = planArticleMerge([local], [remote], TRACKED);
      should(plan.toPatch).eql([{ id: 5, changes: { markdownDE: "* corrected" }, old: { markdownDE: "* original" } }]);
    });

    it("should not treat a \\r\\n vs \\n line-ending difference as a real change", function() {
      const local = { id: 5, markdownDE: "* a\n* b" };
      const remote = { id: 5, markdownDE: "* a\r\n* b" };
      const plan = planArticleMerge([local], [remote], TRACKED);
      should(plan.toPatch).eql([]);
      should(plan.unchanged).eql([{ id: 5 }]);
    });

    it("should never push a field the local article does not have an opinion on (undefined)", function() {
      const local = { id: 5, categoryEN: "Mapping" }; // no markdownEN field at all
      const remote = { id: 5, categoryEN: "Mapping", markdownEN: "* remote only text" };
      const plan = planArticleMerge([local], [remote], TRACKED);
      should(plan.toPatch).eql([]);
    });

    it("should classify a remote-only article (created after the snapshot) separately, untouched", function() {
      const remote = { id: 9, categoryEN: "Mapping", title: "New in prod" };
      const plan = planArticleMerge([], [remote], TRACKED);
      should(plan.toCreate).eql([]);
      should(plan.remoteOnly).eql([{ id: 9, categoryEN: "Mapping", title: "New in prod" }]);
    });

    it("should handle multiple articles with mixed classifications in one pass", function() {
      const local = [
        { id: 1, categoryEN: "Mapping" }, // toCreate
        { id: 2, categoryEN: "Mapping" }, // unchanged
        { id: 3, categoryEN: "Events" } // toPatch (was "Mapping" remotely)
      ];
      const remote = [
        { id: 2, categoryEN: "Mapping" },
        { id: 3, categoryEN: "Mapping" },
        { id: 4, categoryEN: "Community" } // remoteOnly
      ];
      const plan = planArticleMerge(local, remote, TRACKED);
      should(plan.toCreate.map((a) => a.id)).eql([1]);
      should(plan.unchanged.map((a) => a.id)).eql([2]);
      should(plan.toPatch.map((a) => a.id)).eql([3]);
      should(plan.remoteOnly.map((a) => a.id)).eql([4]);
    });

    // Found via a real re-run of the same blog through the merger twice:
    // an article the first run had created got created AGAIN on the
    // second, because its new remote id (bigserial) is permanently
    // unrelated to the local id that produced it. Fixed via a
    // caller-supplied `knownRemoteIds` map (syncState.js keeps this in a
    // local, gitignored file - see CLAUDE.local.md - deliberately never
    // written into the remote data itself).
    describe("knownRemoteIds matching (idempotent re-runs)", function() {
      it("should match an already-migrated article by its remembered remote id, not create it again, and report it under the REMOTE id", function() {
        const local = { id: 47680, categoryEN: "Mapping", markdownDE: "* text" };
        const remote = { id: 36886, categoryEN: "Mapping", markdownDE: "* text" };
        const knownRemoteIds = new Map([["47680", "36886"]]);
        const plan = planArticleMerge([local], [remote], TRACKED, knownRemoteIds);
        should(plan.toCreate).eql([]);
        should(plan.unchanged).eql([{ id: 36886 }]);
      });

      it("should patch (not duplicate) an already-migrated article whose content has since drifted, using the remote id", function() {
        const local = { id: 47680, categoryEN: "Mapping", markdownDE: "* corrected again" };
        const remote = { id: 36886, categoryEN: "Mapping", markdownDE: "* stale" };
        const knownRemoteIds = new Map([["47680", "36886"]]);
        const plan = planArticleMerge([local], [remote], TRACKED, knownRemoteIds);
        should(plan.toCreate).eql([]);
        should(plan.toPatch).eql([{ id: 36886, changes: { markdownDE: "* corrected again" }, old: { markdownDE: "* stale" } }]);
      });

      it("should not count a knownRemoteIds-matched article as remoteOnly", function() {
        const local = { id: 47680, categoryEN: "Mapping" };
        const remote = { id: 36886, categoryEN: "Mapping" };
        const knownRemoteIds = new Map([["47680", "36886"]]);
        const plan = planArticleMerge([local], [remote], TRACKED, knownRemoteIds);
        should(plan.remoteOnly).eql([]);
      });

      it("should translate a predecessorId pointing at an already-migrated article to its real remote id (toPatch case)", function() {
        const predecessorLocal = { id: 47680, categoryEN: "Mapping", markdownDE: "* pred" };
        const predecessorRemote = { id: 36886, categoryEN: "Mapping", markdownDE: "* pred" };
        // this one's own content is unchanged, but its predecessorId (a
        // LOCAL id) must never be written as-is onto the remote article
        const followerLocal = { id: 47690, predecessorId: 47680, categoryEN: "Mapping", markdownDE: "* follower" };
        const followerRemote = { id: 36887, predecessorId: "", categoryEN: "Mapping", markdownDE: "* follower" };
        const knownRemoteIds = new Map([["47680", "36886"], ["47690", "36887"]]);

        const plan = planArticleMerge([predecessorLocal, followerLocal], [predecessorRemote, followerRemote], TRACKED, knownRemoteIds);
        should(plan.toPatch).eql([{ id: 36887, changes: { predecessorId: 36886 }, old: { predecessorId: "" } }]);
      });

      it("should translate a predecessorId pointing at an already-migrated article to its real remote id (toCreate case)", function() {
        const predecessorLocal = { id: 47680, categoryEN: "Mapping", markdownDE: "* pred" };
        const predecessorRemote = { id: 36886, categoryEN: "Mapping", markdownDE: "* pred" };
        const newLocal = { id: 99999, predecessorId: 47680, categoryEN: "Mapping", markdownDE: "* brand new" };
        const knownRemoteIds = new Map([["47680", "36886"]]);

        const plan = planArticleMerge([predecessorLocal, newLocal], [predecessorRemote], TRACKED, knownRemoteIds);
        should(plan.toCreate).eql([{ id: 99999, predecessorId: 36886, categoryEN: "Mapping", markdownDE: "* brand new" }]);
      });
    });
  });

  describe("remapPredecessorIds", function() {
    it("should remap a predecessorId pointing at a newly-created local id", function() {
      const articles = [{ localId: "a", predecessorId: "b" }];
      const createdIdMap = new Map([["b", 4242]]);
      const result = remapPredecessorIds(articles, createdIdMap);
      should(result).eql([{ localId: "a", predecessorId: 4242 }]);
    });

    it("should leave a predecessorId pointing at a pre-existing shared id untouched", function() {
      const articles = [{ localId: "a", predecessorId: 17 }];
      const createdIdMap = new Map(); // nothing created this run
      const result = remapPredecessorIds(articles, createdIdMap);
      should(result).eql(articles);
    });

    it("should leave an unset predecessorId untouched", function() {
      const articles = [{ localId: "a", predecessorId: null }];
      const result = remapPredecessorIds(articles, new Map());
      should(result).eql(articles);
    });
  });

  describe("planMerge", function() {
    it("should short-circuit to an empty, ineligible plan when the blog is not eligible", function() {
      const plan = planMerge({
        localBlog: { categories: [] },
        localArticles: [{ id: 1 }],
        remoteBlog: { name: "WN300", status: "closed", categories: [] },
        remoteArticles: [],
        trackedFields: TRACKED,
        maxBlogNumber: 200
      });
      should(plan.eligible).eql(false);
      should(plan.toCreate).eql([]);
      should(plan.reason).match(/above maxBlogNumber/);
    });

    it("should produce a full plan for an eligible blog", function() {
      const plan = planMerge({
        localBlog: { categories: ["Mapping"] },
        localArticles: [{ id: 1, categoryEN: "Mapping" }],
        remoteBlog: { name: "WN100", status: "closed", categories: ["Mapping"] },
        remoteArticles: [],
        trackedFields: TRACKED,
        maxBlogNumber: 200
      });
      should(plan.eligible).eql(true);
      should(plan.blog).eql("WN100");
      should(plan.toCreate.map((a) => a.id)).eql([1]);
      should(plan.missingCategories).eql([]);
    });

    it("should flag a local category the remote blog does not have yet, without applying it", function() {
      const plan = planMerge({
        localBlog: { categories: ["Mapping", "Community"] },
        localArticles: [],
        remoteBlog: { name: "WN100", status: "closed", categories: ["Mapping"] },
        remoteArticles: [],
        trackedFields: TRACKED,
        maxBlogNumber: 200
      });
      should(plan.eligible).eql(true);
      should(plan.missingCategories).eql(["Community"]);
    });

    // Real production data stores each category as a per-language label
    // object (e.g. { EN: "Mapping", DE: "Mapping", FR: "Cartographie" }),
    // not a plain string - found by an actual local-vs-local-prod-copy dry
    // run, where jsonb's lack of guaranteed key order made every single
    // category falsely show up as "missing" under a naive JSON.stringify
    // comparison.
    it("should match per-language category objects by their EN label, ignoring jsonb key order", function() {
      const mapping = { EN: "Mapping", DE: "Mapping", FR: "Cartographie" };
      const mappingReordered = { FR: "Cartographie", DE: "Mapping", EN: "Mapping" }; // same category, different key order
      const plan = planMerge({
        localBlog: { categories: [mapping] },
        localArticles: [],
        remoteBlog: { name: "WN100", status: "closed", categories: [mappingReordered] },
        remoteArticles: [],
        trackedFields: TRACKED,
        maxBlogNumber: 200
      });
      should(plan.missingCategories).eql([]);
    });

    it("should flag a per-language category object as missing only when its EN label truly isn't present remotely", function() {
      const mapping = { EN: "Mapping", DE: "Mapping" };
      const community = { EN: "Community", DE: "Community" };
      const plan = planMerge({
        localBlog: { categories: [mapping, community] },
        localArticles: [],
        remoteBlog: { name: "WN100", status: "closed", categories: [mapping] },
        remoteArticles: [],
        trackedFields: TRACKED,
        maxBlogNumber: 200
      });
      should(plan.missingCategories).eql([community]);
    });

    // Blog-level field diff (e.g. teamString<LANG>) - found missing after a
    // real osmbc_prod_copie vs. osmbc Hugo-export byte-diff (see
    // CLAUDE.local.md). Reuses the same diffFields logic as article
    // fields, but as its own opt-in `trackedBlogFields` list - separate
    // from `trackedFields`, and never auto-applied via categories/status.
    it("should return no blogPatch when trackedBlogFields is omitted (backward compatible default)", function() {
      const plan = planMerge({
        localBlog: { categories: [], teamStringDE: "Alice" },
        localArticles: [],
        remoteBlog: { name: "WN100", status: "closed", categories: [], teamStringDE: "" },
        remoteArticles: [],
        trackedFields: TRACKED,
        maxBlogNumber: 200
      });
      should(plan.blogPatch).eql(null);
    });

    it("should diff a tracked blog field and carry the remote value as `old` for the concurrency check", function() {
      const plan = planMerge({
        localBlog: { categories: [], teamStringDE: "Alice, Bob" },
        localArticles: [],
        remoteBlog: { name: "WN100", status: "closed", categories: [], teamStringDE: "" },
        remoteArticles: [],
        trackedFields: TRACKED,
        trackedBlogFields: ["teamStringDE", "teamStringEN"],
        maxBlogNumber: 200
      });
      should(plan.blogPatch).eql({ changes: { teamStringDE: "Alice, Bob" }, old: { teamStringDE: "" } });
    });

    it("should return null blogPatch when tracked blog fields already match", function() {
      const plan = planMerge({
        localBlog: { categories: [], teamStringDE: "Alice" },
        localArticles: [],
        remoteBlog: { name: "WN100", status: "closed", categories: [], teamStringDE: "Alice" },
        remoteArticles: [],
        trackedFields: TRACKED,
        trackedBlogFields: ["teamStringDE"],
        maxBlogNumber: 200
      });
      should(plan.blogPatch).eql(null);
    });

    it("should never push a blog field the local side has no opinion on (undefined)", function() {
      const plan = planMerge({
        localBlog: { categories: [] }, // no teamStringDE at all
        localArticles: [],
        remoteBlog: { name: "WN100", status: "closed", categories: [], teamStringDE: "Alice" },
        remoteArticles: [],
        trackedFields: TRACKED,
        trackedBlogFields: ["teamStringDE"],
        maxBlogNumber: 200
      });
      should(plan.blogPatch).eql(null);
    });

    it("should return null blogPatch for an ineligible blog", function() {
      const plan = planMerge({
        localBlog: { categories: [], teamStringDE: "Alice" },
        localArticles: [],
        remoteBlog: { name: "WN100", status: "edit", categories: [], teamStringDE: "" },
        remoteArticles: [],
        trackedFields: TRACKED,
        trackedBlogFields: ["teamStringDE"],
        maxBlogNumber: 200
      });
      should(plan.eligible).eql(false);
      should(plan.blogPatch).eql(null);
    });
  });

  // Found via a real 100-blog Hugo-export byte-diff (WN300-399,
  // osmbc_prod_copie vs. osmbc): a missing category doesn't just get
  // silently skipped, it makes the Hugo renderer emit a "Blog Missing Cat"
  // fallback block instead of the article's real section - so this needs
  // to be an actionable merge, not just an informational flag.
  describe("planCategoriesMerge", function() {
    it("should report \"none\" when both sides are already identical", function() {
      const cats = [{ EN: "Mapping", DE: "Mapping" }, { EN: "Community", DE: "Community" }];
      const plan = planCategoriesMerge(cats, cats);
      should(plan).eql({ action: "none", localCategories: cats, remoteCategories: cats });
    });

    it("should report \"none\" for equal content even if jsonb reordered the keys within a category", function() {
      const local = [{ EN: "Mapping", DE: "Mapping" }];
      const remote = [{ DE: "Mapping", EN: "Mapping" }];
      const plan = planCategoriesMerge(local, remote);
      should(plan.action).eql("none");
    });

    it("should report \"replace\" for a pure insertion (remote's order preserved, local only added categories)", function() {
      const mapping = { EN: "Mapping" };
      const community = { EN: "Community" };
      const releases = { EN: "Releases" }; // new, inserted in the middle
      const local = [mapping, releases, community];
      const remote = [mapping, community];
      const plan = planCategoriesMerge(local, remote);
      should(plan.action).eql("replace");
      should(plan.categories).eql(local);
      should(plan.old).eql(remote);
    });

    it("should report \"replace\" when a shared category's translation text drifted, order otherwise unchanged", function() {
      const local = [{ EN: "Programming", CZ: "Programování" }];
      const remote = [{ EN: "Programming", CZ: "Programming" }]; // stale/untranslated
      const plan = planCategoriesMerge(local, remote);
      should(plan.action).eql("replace");
      should(plan.categories).eql(local);
    });

    it("should report \"review\" when a category present remotely is entirely missing locally", function() {
      const mapping = { EN: "Mapping" };
      const community = { EN: "Community" };
      const local = [mapping];
      const remote = [mapping, community];
      const plan = planCategoriesMerge(local, remote);
      should(plan.action).eql("review");
      should(plan.localCategories).eql(local);
      should(plan.remoteCategories).eql(remote);
    });

    it("should report \"review\" when two existing categories were reordered relative to each other", function() {
      const mapping = { EN: "Mapping" };
      const community = { EN: "Community" };
      const local = [community, mapping]; // swapped
      const remote = [mapping, community];
      const plan = planCategoriesMerge(local, remote);
      should(plan.action).eql("review");
    });

    it("should treat missing/non-array categories as empty arrays", function() {
      const plan = planCategoriesMerge(undefined, undefined);
      should(plan).eql({ action: "none", localCategories: [], remoteCategories: [] });
    });
  });
});
