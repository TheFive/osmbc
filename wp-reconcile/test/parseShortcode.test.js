import should from "should";
import { parseShortcode } from "../wp-extract/parseShortcode.js";

// Real post_title row from wp_posts, issue 825 (WP Data/weeklyDump).
const REAL_WN825_TITLE = "[:en]weeklyOSM 825[:de]Wochennotiz 825[:pt]semanárioOSM 825[:es]semanarioOSM 825[:ja]週刊OSM 825[:br]semanárioOSM 825[:cz]týdeník 825[:fr]hebdoOSM 825[:it]Notiziario Settimanale OSM 825[:ko]주간 OSM 825[:ru]Еженедельник OSM 825[:uk]Тижневик OSM 825[:zh]週刊OSM 825[:tr]HaftalıkOSM 825[:id]OSM Mingguan 825[:nl]weeklyOSM 825[:sw]OSMkilawiki 825[:pl]Tygodnik OSM 825[:cn]OSM周刊 825[:]";

describe("parseShortcode", function () {
  it("parses every language segment of a real multi-language WN825 title", function () {
    const { languages, warnings } = parseShortcode(REAL_WN825_TITLE);
    languages.should.have.property("en", "weeklyOSM 825");
    languages.should.have.property("de", "Wochennotiz 825");
    languages.should.have.property("pt", "semanárioOSM 825");
    languages.should.have.property("ja", "週刊OSM 825");
    languages.should.have.property("cn", "OSM周刊 825");
    Object.keys(languages).should.have.length(19);
    warnings.should.be.empty();
  });

  it("warns and returns an empty map for a title with no [:xx] markers", function () {
    const { languages, warnings } = parseShortcode("Wochennotiz Nr. 523");
    languages.should.eql({});
    warnings.length.should.be.above(0);
  });

  it("warns on non-string input without throwing", function () {
    const { languages, warnings } = parseShortcode(undefined);
    languages.should.eql({});
    warnings.length.should.be.above(0);
  });

  it("warns when content precedes the first marker", function () {
    const { warnings } = parseShortcode("stray text[:en]content[:]");
    warnings.length.should.be.above(0);
  });

  it("warns on a duplicate language marker but keeps the last value", function () {
    const { languages, warnings } = parseShortcode("[:en]first[:en]second[:]");
    languages.en.should.equal("second");
    warnings.length.should.be.above(0);
  });
});
