import should from "should";
import { addCollectionFallbackLink } from "../transitional-era/collectionFallback.js";

describe("addCollectionFallbackLink", function () {
  it("appends the collection link when the article text has no link at all (real case: WN276 article 10165)", function () {
    const html = "Mikel Maron beleuchtet die Entwicklung von HOT in der Zeit von 2005-2010.";
    const result = addCollectionFallbackLink(html, "https://www.youtube.com/watch?v=jZyLZpz5XBA");
    result.should.containEql('href="https://www.youtube.com/watch?v=jZyLZpz5XBA"');
  });

  it("leaves the html untouched when it already has a real link", function () {
    const html = 'Mikel Maron <a href="https://example.com/blog">writes</a> about HOT.';
    const result = addCollectionFallbackLink(html, "https://www.youtube.com/watch?v=other");
    result.should.equal(html);
  });

  it("leaves the html untouched when there is no collection value", function () {
    const html = "Text with no link.";
    const result = addCollectionFallbackLink(html, "");
    result.should.equal(html);
  });

  it("leaves the html untouched when collection has no URL in it", function () {
    const html = "Text with no link.";
    const result = addCollectionFallbackLink(html, "some note, not a link");
    result.should.equal(html);
  });
});
