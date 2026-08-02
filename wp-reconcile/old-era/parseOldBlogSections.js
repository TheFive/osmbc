// Splits one issue's raw wp_1_posts body HTML (the old, pre-osmbc blog.openstreetmap.de,
// 2010-2015, German-only) into an ordered list of category sections with their
// article bullets. This era predates osmbc's <li id="wn<n>_<id>"> anchor
// convention entirely (see wp-extract/splitByAnchor.js for that, later
// convention) - there is no per-article id to rely on at all.
//
// Category heading markup changed twice across the real 2010-2015 archive
// (verified by sampling issues spread across the whole range):
//   - most of the era: <h2 id="slug">Heading</h2>, or (from ~#271) with the
//     id moved into a nested empty anchor: <h2><a id="slug"></a>Heading</h2>.
//     Some later issues have stale ids that don't match the visible heading
//     text (leftover template copy-paste) - the TEXT, never the id, is used.
//   - issue #1 (WN001) has no <h2> at all: categories are plain top-level
//     <strong>Heading</strong> or <span style="..."><strong>Heading</strong></span>
//     blocks instead.
// Both conventions are handled uniformly here by walking the body's
// top-level nodes in document order and treating any <h2>, top-level
// <strong>, or <span> wrapping a <strong> as a new section heading, and any
// <ul> OR <ol> as that section's article bullets (one <li> per article -
// verified bullets stay single-topic even when long). A handful of
// sections use <ol> instead of <ul> for no apparent reason (confirmed real
// case: WN279 DE "Humanitarian OSM") - without treating it the same as
// <ul>, every bullet in that section was silently invisible to matching
// entirely (not a matching failure - the bullets were never even offered
// as candidates).
//
// Some categories (verified: "Releases"/"Software Watchlist" issue 296,
// "Upcoming Events" calendar issue 300) are published as a single <table>
// instead of a <ul><li> list - but on the osmbc side each of these is one
// whole article containing the entire table as its markdown (confirmed
// against both real examples: e.g. WN300's full multi-row event calendar
// is one single osmbc article, not one per row). So the WHOLE <table> is
// treated as one article bullet, not one bullet per <tr> - splitting per
// row was tried first and made matching far worse (a large calendar table
// alone contributed dozens of bulk unmatched "bullets" with no 1:1 osmbc
// counterpart, since there is no such counterpart - the row/article
// correspondence isn't 1:1 for these tables).
//
// A handful of issues (verified: WN231, WN253) wrap the entire body in a
// single top-level <div id="preview">...</div> instead of putting the
// headings/lists/tables directly at the top level - without unwrapping
// this, the walk below finds nothing at all ("no sections found"). Detected
// generically (exactly one top-level tag, and it's a <div>) rather than by
// matching the "preview" id, since that id isn't guaranteed to be stable.

import { load } from "cheerio";

const HEADING_TAGS = new Set(["h2", "strong"]);

export function parseOldBlogSections(html) {
  if (typeof html !== "string" || html.trim() === "") {
    return { sections: [], warnings: ["empty or non-string html"] };
  }

  const $ = load(html, null, false);
  let root = $.root();
  const topLevelTags = root.contents().toArray().filter((n) => n.type === "tag");
  if (topLevelTags.length === 1 && (topLevelTags[0].tagName || topLevelTags[0].name) === "div") {
    root = $(topLevelTags[0]);
  }

  const sections = [];
  const warnings = [];
  let current = null;

  root.contents().each((_, node) => {
    if (node.type !== "tag") return;
    const tag = node.tagName || node.name;
    const $el = $(node);

    const isHeading = HEADING_TAGS.has(tag) || (tag === "span" && $el.find("strong").length > 0);
    if (isHeading) {
      const headingText = $el.text().trim();
      if (headingText) {
        current = { headingText, articlesHtml: [] };
        sections.push(current);
      }
      return;
    }

    if (tag === "ul" || tag === "ol") {
      if (!current) {
        current = { headingText: "", articlesHtml: [] };
        sections.push(current);
        warnings.push(`found <${tag}> before any heading - using an empty heading placeholder`);
      }
      $el.children("li").each((__, li) => {
        current.articlesHtml.push($(li).html());
      });
    }

    if (tag === "table") {
      if (!current) {
        current = { headingText: "", articlesHtml: [] };
        sections.push(current);
        warnings.push("found <table> before any heading - using an empty heading placeholder");
      }
      current.articlesHtml.push($el.html());
    }
  });

  if (sections.length === 0) warnings.push("no sections found");
  return { sections, warnings };
}

export default { parseOldBlogSections };
