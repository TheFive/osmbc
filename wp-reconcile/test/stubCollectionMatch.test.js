import should from "should";
import { findStubMatch } from "../transitional-era/stubCollectionMatch.js";

describe("findStubMatch", function () {
  const wpBullets = [
    '<a href="https://okfn.de/blog/2015/10/die-bahn-kommt-auf-open-data/">Die Bahn</a> berichtet.',
    "Ein Bullet ohne passenden Link."
  ];

  it("matches a stub article to its real WP counterpart via a globally unique collection link (real case: WN275 article 10120)", function () {
    const linkCounts = { "okfn.de/blog/2015/10/die-bahn-kommt-auf-open-data": ["10120"] };
    const result = findStubMatch(" http://okfn.de/blog/2015/10/die-bahn-kommt-auf-open-data/", wpBullets, linkCounts);
    should(result).not.be.null();
    result.wpHtml.should.equal(wpBullets[0]);
  });

  it("flags as ambiguous when the collection link is used by more than one article", function () {
    const linkCounts = { "okfn.de/blog/2015/10/die-bahn-kommt-auf-open-data": ["10120", "99999"] };
    const result = findStubMatch(" http://okfn.de/blog/2015/10/die-bahn-kommt-auf-open-data/", wpBullets, linkCounts);
    result.should.have.property("ambiguous", true);
  });

  it("returns null when the link is unique but not actually found in this issue's WP content", function () {
    const linkCounts = { "example.com/nowhere": ["10120"] };
    const result = findStubMatch(" http://example.com/nowhere", wpBullets, linkCounts);
    should(result).be.null();
  });

  it("returns null (not ambiguous) when a globally non-unique link isn't found in this issue's WP content either - nothing to flag without a real match signal", function () {
    const linkCounts = { "example.com/nowhere": ["10120", "99999"] };
    const result = findStubMatch(" http://example.com/nowhere", wpBullets, linkCounts);
    should(result).be.null();
  });

  it("returns null when there is no collection value at all", function () {
    const result = findStubMatch("", wpBullets, {});
    should(result).be.null();
  });

  it("returns null when the collection value has no URL in it", function () {
    const result = findStubMatch("some note, not a link", wpBullets, {});
    should(result).be.null();
  });
});
