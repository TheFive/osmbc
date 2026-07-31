import should from "should";
import { matchByLinks, extractLinks } from "../transitional-era/matchByLinks.js";

// Real excerpts from WN300 (osmbc's current export vs. the actually
// published WordPress post) - the ASTER imagery story, which really was
// updated in WordPress after export ("is not open" -> "is _now_ (UPDATE)
// open") and never made it back into osmbc. Confirms link-matching finds
// the right pair even though the text genuinely differs.
const OSMBC_ASTER = 'Christoph Hormann <a href="http://blog.imagico.de/free-access-to-aster-images/">notes</a> that ASTER imagery (known from DEM data) is not open to the public.';
const WP_ASTER = 'Christoph Hormann <a href="http://blog.imagico.de/free-access-to-aster-images/">notes</a> that ASTER imagery (known from DEM data) is _now_ (UPDATE) open to the public.';
const WP_UNRELATED = 'User PT-53 <a href="http://forum.openstreetmap.org/viewtopic.php?id=54325">complains</a> on the German forum about a deleted roundabout.';

describe("matchByLinks", function () {
  it("matches a real article to its real published counterpart by shared link, even though the text differs (real WN300 drift example)", function () {
    const { matches, unmatchedOsmbc, unmatchedWp } = matchByLinks(
      { "11696": OSMBC_ASTER },
      [WP_UNRELATED, WP_ASTER]
    );
    matches.should.have.length(1);
    matches[0].articleId.should.equal("11696");
    matches[0].wpHtml.should.equal(WP_ASTER);
    matches[0].score.should.equal(1);
    unmatchedOsmbc.should.be.empty();
    unmatchedWp.should.have.length(1);
    unmatchedWp[0].should.equal(WP_UNRELATED);
  });

  it("treats an osmbc article with no links as unmatched, not as a guess", function () {
    // Two WP bullets in play (not just one), so the "clean 1:1 leftover"
    // pairing below doesn't mask this case - it should stay unmatched.
    const html = "... Florian Pigorschs <em>Flopp's map</em> with some neat geographic functions.";
    const { matches, unmatchedOsmbc } = matchByLinks({ "1": html }, [WP_ASTER, WP_UNRELATED]);
    matches.should.be.empty();
    unmatchedOsmbc.should.have.length(1);
    unmatchedOsmbc[0].articleId.should.equal("1");
  });

  it("pairs a clean 1:1 leftover per issue (\"blog as the master bracket\") when no link matched either side", function () {
    const osmbcOnly = '<a href="https://example.com/a">a story with a link nothing else shares</a>';
    const wpOnly = "A completely reworded version of the same story with no links at all.";
    const { matches, unmatchedOsmbc, unmatchedWp } = matchByLinks({ "5": osmbcOnly.replace(/<[^>]+>/g, "no link here") }, [wpOnly]);
    matches.should.have.length(1);
    matches[0].method.should.equal("leftover-pair");
    matches[0].articleId.should.equal("5");
    matches[0].wpHtml.should.equal(wpOnly);
    unmatchedOsmbc.should.be.empty();
    unmatchedWp.should.be.empty();
  });

  it("flags an ambiguous match (two similarly, imperfectly-scored candidates) for manual review instead of guessing", function () {
    // Query shares exactly one link with each candidate, and each candidate
    // has one link the other doesn't - neither is a strong (>=0.9) match,
    // so this must be flagged rather than silently picking one.
    const query = '<a href="https://example.com/shared">shared</a> <a href="https://example.com/only-query">q</a>';
    const candidateA = '<a href="https://example.com/shared">shared</a> <a href="https://example.com/only-a">a</a>';
    const candidateB = '<a href="https://example.com/shared">shared</a> <a href="https://example.com/only-b">b</a>';
    const { matches, ambiguous } = matchByLinks({ "9": query }, [candidateA, candidateB]);
    matches.should.be.empty();
    ambiguous.should.have.length(1);
    ambiguous[0].articleId.should.equal("9");
  });

  it("extractLinks unwraps translate.goog links so a translated and an original link to the same source compare equal", function () {
    const original = extractLinks('<a href="https://www.example.com/path">x</a>');
    const translated = extractLinks('<a href="https://www-example-com.translate.goog/path?_x_tr_sl=auto&_x_tr_tl=EN">x</a>');
    [...original].should.eql([...translated]);
  });
});
