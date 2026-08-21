import should from "should";
import { qMarkRatio, isBetterLanguageEntry, mergeIssueResult } from "../wp-extract/mergeIssueRevisions.js";

describe("mergeIssueRevisions", function () {
  describe("qMarkRatio", function () {
    it("returns 0 for text with no question marks", function () {
      qMarkRatio("normal text.").should.equal(0);
    });

    it("returns a low ratio for a single legitimate question mark in a long text", function () {
      const text = "a".repeat(4857) + "?";
      qMarkRatio(text).should.be.below(0.001);
    });

    it("returns a high ratio for text dominated by literal ? characters (real case: WN279 RU)", function () {
      qMarkRatio("?????? ???? OpenStreetMap ??? Greasemonkey").should.be.above(0.25);
    });

    it("returns 0 for empty/missing text", function () {
      qMarkRatio("").should.equal(0);
      qMarkRatio(undefined).should.equal(0);
    });
  });

  describe("isBetterLanguageEntry", function () {
    it("prefers any candidate when there is no current entry yet", function () {
      isBetterLanguageEntry({ body: "??? ???" }, null).should.be.true();
    });

    it("prefers the markedly less corrupted candidate even if shorter (real case: WN279 RU revisions)", function () {
      const corrupted = { body: "?????? ???? OpenStreetMap ??? Greasemonkey ?????? ???? OpenStreetMap" };
      const clean = { body: "Некоторый текст про OpenStreetMap" };
      isBetterLanguageEntry(clean, corrupted).should.be.true();
      isBetterLanguageEntry(corrupted, clean).should.be.false();
    });

    it("falls back to the longer body when corruption levels are comparable", function () {
      const shorter = { body: "short body here" };
      const longer = { body: "a longer body here with more real content in it" };
      isBetterLanguageEntry(longer, shorter).should.be.true();
      isBetterLanguageEntry(shorter, longer).should.be.false();
    });
  });

  describe("mergeIssueResult", function () {
    it("keeps the cleaner revision's content for a language and tags it with sourcePostId", function () {
      const existing = {
        postId: 18260,
        postDate: "2025-11-10",
        postModified: "2025-11-10",
        perLanguage: { ru: { body: "?????? ???? OpenStreetMap" }, en: { body: "Real English content" } },
        warnings: []
      };
      const incoming = {
        postId: 6195,
        postDate: "2015-12-07",
        postModified: "2015-12-07",
        perLanguage: { ru: { body: "Некоторый текст про OpenStreetMap" } },
        warnings: ["some warning"]
      };
      mergeIssueResult(existing, incoming);
      existing.perLanguage.ru.body.should.equal("Некоторый текст про OpenStreetMap");
      existing.perLanguage.ru.sourcePostId.should.equal(6195);
      // untouched language keeps its own content, no spurious sourcePostId
      existing.perLanguage.en.body.should.equal("Real English content");
      should(existing.perLanguage.en.sourcePostId).be.undefined();
      existing.warnings.should.containEql("[postId 6195] some warning");
    });

    it("does not overwrite a language absent from the incoming row", function () {
      const existing = {
        postId: 1, postDate: "d1", postModified: "d1",
        perLanguage: { de: { body: "German content" } },
        warnings: []
      };
      const incoming = { postId: 2, postDate: "d2", postModified: "d2", perLanguage: {}, warnings: [] };
      mergeIssueResult(existing, incoming);
      existing.perLanguage.de.body.should.equal("German content");
    });
  });
});
