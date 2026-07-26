import should from "should";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { splitByAnchor } from "../wp-extract/splitByAnchor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("splitByAnchor", function () {
  it("splits a synthetic two-article list into fragments keyed by article id", function () {
    const html = '<ul><li id="wn825_1">First article text.</li><li id="wn825_2">Second article text.</li></ul>';
    const { articles, warnings } = splitByAnchor(html);
    Object.keys(articles).should.have.length(2);
    articles["1"].should.equal("First article text.");
    articles["2"].should.equal("Second article text.");
    warnings.should.be.empty();
  });

  it("warns and returns an empty map when no anchors are found", function () {
    const { articles, warnings } = splitByAnchor("<p>No anchors here</p>");
    articles.should.eql({});
    warnings.length.should.be.above(0);
  });

  it("ignores li elements whose id doesn't match the wn<issue>_<id> pattern", function () {
    const html = '<li id="something-else">skip me</li><li id="wn290_1">keep me</li>';
    const { articles } = splitByAnchor(html);
    Object.keys(articles).should.eql(["1"]);
  });

  it("keeps a nested <li> (without its own id) fully inside its parent article, matching real WN825 markup", function () {
    // Real fragment pulled from wp_posts (issue 825, German segment): article
    // 34610 contains a nested <ul><li>...</li></ul> before its closing </li>.
    // A naive non-greedy regex on "<li id=...>...</li>" would truncate at the
    // *inner* </li> - this is exactly why splitByAnchor uses cheerio (DOM-based)
    // instead of a regex.
    const html = fs.readFileSync(path.join(__dirname, "fixtures", "wn825-real-fragment-de.html"), "utf8");
    const { articles, warnings } = splitByAnchor(html);

    Object.keys(articles).should.have.length(2);
    articles.should.have.keys("34610", "34612");
    warnings.should.be.empty();

    // the full nested <ul> must be preserved inside article 34610, not truncated
    articles["34610"].should.containEql("<ul>");
    articles["34610"].should.containEql("data_center:tier");
    articles["34610"].should.containEql("</ul>");

    // and article 34612's own text must not have leaked into 34610's fragment
    articles["34610"].should.not.containEql("Aerodrome Descriptive Tags");
    articles["34612"].should.containEql("Aerodrome Descriptive Tags");
  });
});
