import should from "should";
import { textSimilarity } from "../transitional-era/textSimilarity.js";

describe("textSimilarity", function () {
  it("returns 1 for identical texts", function () {
    textSimilarity("Der Hund läuft schnell.", "Der Hund läuft schnell.").should.equal(1);
  });

  it("returns a low ratio for completely unrelated texts", function () {
    textSimilarity("Der Hund läuft schnell.", "Die Katze schläft ruhig heute.").should.be.below(0.2);
  });

  it("returns a high ratio for a small wording change (same story, minor edit)", function () {
    const a = "Klaus Tockloth stellt im OSM-Forum wmsbigmap vor, ein Perl-Skript.";
    const b = "Klaus Tockloth (toc-rox) stellt im OSM-Forum wmsbigmap vor, ein Perl-Skript.";
    textSimilarity(a, b).should.be.above(0.8);
  });

  it("returns 0 when either text is empty", function () {
    textSimilarity("", "some text").should.equal(0);
    textSimilarity("some text", "").should.equal(0);
  });
});
