import should from "should";
import { matchByReferenceLanguage } from "../transitional-era/positionalMatch.js";

describe("matchByReferenceLanguage", function () {
  it("maps by position when every category's bullet count matches exactly (real case: WN276 EN vs JP)", function () {
    const referenceWpSections = [
      { headingText: "Mapping", articlesHtml: ["<en bullet 1>", "<en bullet 2>"] },
      { headingText: "Community", articlesHtml: ["<en bullet 3>"] }
    ];
    const referenceMatches = [
      { articleId: "10157", wpHtml: "<en bullet 1>" },
      { articleId: "10152", wpHtml: "<en bullet 2>" },
      { articleId: "10147", wpHtml: "<en bullet 3>" }
    ];
    const targetWpSections = [
      { headingText: "マッピング", articlesHtml: ["<jp bullet 1>", "<jp bullet 2>"] },
      { headingText: "コミュニティ", articlesHtml: ["<jp bullet 3>"] }
    ];
    const map = matchByReferenceLanguage(referenceWpSections, referenceMatches, targetWpSections);
    should(map).not.be.null();
    map.get("10157").should.equal("<jp bullet 1>");
    map.get("10152").should.equal("<jp bullet 2>");
    map.get("10147").should.equal("<jp bullet 3>");
  });

  it("skips a position where the reference language itself never matched anything - no guess", function () {
    const referenceWpSections = [{ headingText: "Community", articlesHtml: ["<en bullet 1>", "<en bullet 2>"] }];
    const referenceMatches = [{ articleId: "10147", wpHtml: "<en bullet 1>" }]; // bullet 2 was unmatched-wp in the reference language
    const targetWpSections = [{ headingText: "コミュニティ", articlesHtml: ["<jp bullet 1>", "<jp bullet 2>"] }];
    const map = matchByReferenceLanguage(referenceWpSections, referenceMatches, targetWpSections);
    map.size.should.equal(1);
    map.get("10147").should.equal("<jp bullet 1>");
  });

  it("returns null when the category counts don't line up - refuses to guess", function () {
    const referenceWpSections = [{ headingText: "Mapping", articlesHtml: ["<en bullet 1>", "<en bullet 2>"] }];
    const referenceMatches = [];
    const targetWpSections = [{ headingText: "マッピング", articlesHtml: ["<jp bullet 1>"] }]; // only 1, not 2
    should(matchByReferenceLanguage(referenceWpSections, referenceMatches, targetWpSections)).be.null();
  });

  it("returns null when the number of categories differs", function () {
    const referenceWpSections = [
      { headingText: "Mapping", articlesHtml: ["<en bullet 1>"] },
      { headingText: "Community", articlesHtml: ["<en bullet 2>"] }
    ];
    const targetWpSections = [{ headingText: "マッピング", articlesHtml: ["<jp bullet 1>"] }];
    should(matchByReferenceLanguage(referenceWpSections, [], targetWpSections)).be.null();
  });
});
