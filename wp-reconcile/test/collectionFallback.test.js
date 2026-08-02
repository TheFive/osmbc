import should from "should";
import { addCollectionFallbackLink } from "../transitional-era/collectionFallback.js";

describe("addCollectionFallbackLink", function () {
  it("appends the collection link when the article text has no link at all (real case: WN276 article 10165)", function () {
    const html = "Mikel Maron beleuchtet die Entwicklung von HOT in der Zeit von 2005-2010.";
    const linkCounts = { "www.youtube.com/watch?v=jzylzpz5xba": ["10165"] }; // normalizeUrl lowercases the whole key
    const result = addCollectionFallbackLink(html, "https://www.youtube.com/watch?v=jZyLZpz5XBA", linkCounts);
    result.should.containEql('href="https://www.youtube.com/watch?v=jZyLZpz5XBA"');
  });

  it("also appends the collection link when the article already has a different, unrelated link (real case: WN276 article 10164 - inline link's URL drifted, but the collection field has the real twitter link WP published)", function () {
    const html = 'GeometaLab <a href="http://www.ifs.hsr.ch/index.php?id=12520">of Hochschule Rapperwil</a> announced...';
    const linkCounts = { "twitter.com/geometalab/status/659810824819752961": ["10164"] };
    const result = addCollectionFallbackLink(html, "https://twitter.com/geometalab/status/659810824819752961", linkCounts);
    result.should.containEql('href="http://www.ifs.hsr.ch/index.php?id=12520"');
    result.should.containEql('href="https://twitter.com/geometalab/status/659810824819752961"');
  });

  it("does not append the collection link when it is not globally unique - not a confident enough signal", function () {
    const html = "Text with no link.";
    const linkCounts = { "www.youtube.com/watch?v=jzylzpz5xba": ["10165", "99999"] };
    const result = addCollectionFallbackLink(html, "https://www.youtube.com/watch?v=jZyLZpz5XBA", linkCounts);
    result.should.equal(html);
  });

  it("leaves the html untouched when the collection link is already present in the text", function () {
    const html = 'Mikel Maron <a href="https://www.youtube.com/watch?v=jZyLZpz5XBA">talk</a> about HOT.';
    const linkCounts = { "www.youtube.com/watch?v=jzylzpz5xba": ["10165"] };
    const result = addCollectionFallbackLink(html, "https://www.youtube.com/watch?v=jZyLZpz5XBA", linkCounts);
    result.should.equal(html);
  });

  it("leaves the html untouched when there is no collection value", function () {
    const html = "Text with no link.";
    const result = addCollectionFallbackLink(html, "", {});
    result.should.equal(html);
  });

  it("leaves the html untouched when collection has no URL in it", function () {
    const html = "Text with no link.";
    const result = addCollectionFallbackLink(html, "some note, not a link", {});
    result.should.equal(html);
  });
});
