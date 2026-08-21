import should from "should";
import { anchorPositionalMatch } from "../old-era/anchorPositionalMatch.js";

// Modeled on the real case that motivated this (WN225, "Talk, Forum, Wiki &
// Blog"): DE has 9 bullets, EN only translated 7 (dropping DE positions 2
// and 4 - "Obelixx" and "WiMobil"). DE position 8 ("Field Papers had an
// outage") links a mailing-list message from before the translations were
// made; EN position 6 ("Field Papers is back up") links a LATER message in
// the same thread - no link overlap, but both sit directly before the same
// already-matched neighbour (UNMIL Liberia import).
function realCaseSections() {
  const deSections = [{
    headingText: "Talk, Forum, Wiki & Blog",
    articleIds: [101, 102, 103, 104, 105, 106, 107, 108, 109]
  }];
  const targetSections = [{
    headingText: "Talk, Forum, Wiki & Blog",
    articlesHtml: ["en-1", "en-3", "en-5", "en-6", "en-7", "en-fieldpapers-backup", "en-unmil"]
  }];
  const directMatches = [
    { articleId: 101, wpHtml: "en-1" },
    { articleId: 103, wpHtml: "en-3" },
    { articleId: 105, wpHtml: "en-5" },
    { articleId: 106, wpHtml: "en-6" },
    { articleId: 107, wpHtml: "en-7" },
    { articleId: 109, wpHtml: "en-unmil" }
    // 108 ("Field Papers outage") and "en-fieldpapers-backup" are the only
    // unmatched items, both sitting in the single-item gap right before
    // the 109/"en-unmil" anchor.
  ];
  return { deSections, targetSections, directMatches };
}

describe("anchorPositionalMatch", function () {
  it("pairs the single unmatched item in a single-item gap on both sides (real case: WN225)", function () {
    const { deSections, targetSections, directMatches } = realCaseSections();
    const result = anchorPositionalMatch({ deSections, targetSections, directMatches });
    result.should.have.length(1);
    result[0].should.eql({ articleId: 108, wpHtml: "en-fieldpapers-backup" });
  });

  it("does not pair anything when the gap holds more than one unmatched item on either side", function () {
    const deSections = [{ headingText: "Karten", articleIds: [1, 2, 3, 4] }];
    const targetSections = [{ headingText: "Maps", articlesHtml: ["a", "b", "c", "d"] }];
    const directMatches = [
      { articleId: 1, wpHtml: "a" },
      { articleId: 4, wpHtml: "d" }
      // gap between them: DE has {2,3} (two items), target has {b,c} (two
      // items) - ambiguous which maps to which, must not guess.
    ];
    const result = anchorPositionalMatch({ deSections, targetSections, directMatches });
    result.should.eql([]);
  });

  it("does not align a DE section whose anchors point at more than one target section (ambiguous evidence)", function () {
    const deSections = [{ headingText: "Karten", articleIds: [1, 2, 3] }];
    const targetSections = [
      { headingText: "Maps", articlesHtml: ["a", "x"] },
      { headingText: "Misc", articlesHtml: ["b"] }
    ];
    const directMatches = [
      { articleId: 1, wpHtml: "a" },
      { articleId: 3, wpHtml: "b" } // same DE section, but matches land in two different target sections
    ];
    const result = anchorPositionalMatch({ deSections, targetSections, directMatches });
    result.should.eql([]);
  });

  it("fills a gap before the first anchor (section start) and after the last anchor (section end)", function () {
    const deSections = [{ headingText: "Karten", articleIds: [1, 2, 3, 4] }];
    const targetSections = [{ headingText: "Maps", articlesHtml: ["p", "b", "c", "q"] }];
    const directMatches = [
      { articleId: 2, wpHtml: "b" },
      { articleId: 3, wpHtml: "c" }
    ];
    const result = anchorPositionalMatch({ deSections, targetSections, directMatches });
    result.should.have.length(2);
    result.should.containDeep([{ articleId: 1, wpHtml: "p" }, { articleId: 4, wpHtml: "q" }]);
  });

  it("returns nothing when there are no direct matches to anchor on", function () {
    const deSections = [{ headingText: "Karten", articleIds: [1, 2] }];
    const targetSections = [{ headingText: "Maps", articlesHtml: ["a", "b"] }];
    const result = anchorPositionalMatch({ deSections, targetSections, directMatches: [] });
    result.should.eql([]);
  });
});
