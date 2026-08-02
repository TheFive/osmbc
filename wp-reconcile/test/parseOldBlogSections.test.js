import should from "should";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseOldBlogSections } from "../old-era/parseOldBlogSections.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function fixture(name) {
  return fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

describe("parseOldBlogSections", function () {
  it("parses the <h2 id=slug> era (real excerpt, issue 100)", function () {
    const { sections, warnings } = parseOldBlogSections(fixture("old-era-h2-id.html"));
    sections.should.have.length(2);
    sections[0].headingText.should.equal("Talk, Forum, Wiki & Blog");
    sections[0].articlesHtml.should.have.length(2);
    sections[1].headingText.should.equal("ODbL");
    sections[1].articlesHtml.should.have.length(1);
    warnings.should.be.empty();
  });

  it("parses the <h2><a id=slug></a>Heading</h2> era (real excerpt, issue 271)", function () {
    const { sections, warnings } = parseOldBlogSections(fixture("old-era-h2-nested-anchor.html"));
    sections.should.have.length(2);
    sections[0].headingText.should.equal("Mapping");
    sections[0].articlesHtml.should.have.length(2);
    sections[1].headingText.should.equal("Karten");
    sections[1].articlesHtml.should.have.length(1);
    warnings.should.be.empty();
  });

  it("parses the no-<h2>, <strong>/<span><strong> era (real excerpt, issue 1)", function () {
    const { sections, warnings } = parseOldBlogSections(fixture("old-era-issue1-strong.html"));
    sections.should.have.length(2);
    sections[0].headingText.should.equal("SotM 2010 Girona");
    sections[0].articlesHtml.should.have.length(2);
    sections[1].headingText.should.equal("Talk-de & Forum");
    sections[1].articlesHtml.should.have.length(1);
    warnings.should.be.empty();
  });

  it("keeps <em>/<a> emphasis inside a bullet without treating it as a new heading", function () {
    const html = `<h2 id="mapping">Mapping</h2><ul><li>Text mit <em>addr:housename</em> und <a href="#">Link</a>.</li></ul>`;
    const { sections } = parseOldBlogSections(html);
    sections.should.have.length(1);
    sections[0].articlesHtml[0].should.containEql("<em>addr:housename</em>");
  });

  it("warns and returns an empty section list for non-string input", function () {
    const { sections, warnings } = parseOldBlogSections(undefined);
    sections.should.eql([]);
    warnings.length.should.be.above(0);
  });

  it("treats a whole <table> as one article bullet, not one per row (real excerpt, issue 296 Releases - osmbc holds the whole table as a single article)", function () {
    const html = `<h2 id="wn296_releases">Releases</h2>
<table>
<thead>
<tr><th>Software</th><th>Version</th><th>Release Datum</th><th>Änderungen</th></tr>
</thead>
<tbody>
<tr><td><a href="http://www.locusmap.eu/">Locus Map Free</a></td><td><a href="http://www.locusmap.eu/news-version-3-16-0">3.16.0</a></td><td>14.3.2016</td><td>"Stop Tracking"-Button und einige Erweiterungen</td></tr>
<tr><td><a href="http://ideditor.com/">iD</a></td><td><a href="https://github.com/openstreetmap/iD/blob/master/CHANGELOG.md">1.9.2</a></td><td>18.3.2016</td><td>-</td></tr>
</tbody>
</table>`;
    const { sections, warnings } = parseOldBlogSections(html);
    sections.should.have.length(1);
    sections[0].headingText.should.equal("Releases");
    sections[0].articlesHtml.should.have.length(1);
    sections[0].articlesHtml[0].should.containEql('href="http://www.locusmap.eu/"');
    sections[0].articlesHtml[0].should.containEql('href="http://ideditor.com/"');
    warnings.should.be.empty();
  });

  it("unwraps a single top-level <div id=\"preview\"> container (real structural variant, issues 231/253)", function () {
    const html = `<div id="preview">\r\n\r\n16.12.-22.12.2014\r\n\r\n<h2 id="mapping">Mapping</h2><ul><li>Text mit <a href="#">Link</a>.</li></ul></div>`;
    const { sections, warnings } = parseOldBlogSections(html);
    sections.should.have.length(1);
    sections[0].headingText.should.equal("Mapping");
    sections[0].articlesHtml.should.have.length(1);
    warnings.should.be.empty();
  });

  it("treats <ol> the same as <ul> (real case: WN279 DE \"Humanitarian OSM\" section)", function () {
    const html = `<h2 id="wn279_humanitarian osm">Humanitarian OSM</h2><ol><li>Für die FOSSGIS 2017 wird ein Ort <a href="http://fossgis-konferenz.de/2017/">gesucht</a>.</li></ol>`;
    const { sections, warnings } = parseOldBlogSections(html);
    sections.should.have.length(1);
    sections[0].headingText.should.equal("Humanitarian OSM");
    sections[0].articlesHtml.should.have.length(1);
    sections[0].articlesHtml[0].should.containEql("FOSSGIS 2017");
    warnings.should.be.empty();
  });

  it("warns but still captures bullets that appear before any heading", function () {
    const html = `<ul><li>orphan bullet</li></ul><h2 id="mapping">Mapping</h2><ul><li>real bullet</li></ul>`;
    const { sections, warnings } = parseOldBlogSections(html);
    sections.should.have.length(2);
    sections[0].headingText.should.equal("");
    sections[1].headingText.should.equal("Mapping");
    warnings.length.should.be.above(0);
  });
});
