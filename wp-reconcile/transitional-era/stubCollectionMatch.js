// Handles osmbc articles that have NO real written text in any language
// (rawMarkdown is empty, or the literal "no translation"/"german only"
// marker) but do have a "collection" link - the source the editor
// originally found, never written up in osmbc. Confirmed real cases
// (WN275 articles 10097, 10120): the story was instead written directly
// in WordPress, and the same link appears there.
//
// Per the project owner's explicit rule: this is only safe to auto-match
// when the collection link is GLOBALLY UNIQUE across the whole osmbc
// database (used by exactly one article) - a reused/generic link (e.g. a
// wiki homepage) is too ambiguous to auto-match and must go to manual
// review instead, since a "no translation"/"german only" marker is
// normally a deliberate editorial decision, not an accident.

import { extractLinks, normalizeUrl } from "./matchByLinks.js";

function collectionUrl(collection) {
  const m = collection && /https?:\/\/\S+/.exec(collection);
  return m ? normalizeUrl(m[0]) : null;
}

// linkCounts: { [normalizedUrl]: string[] of article ids } - from
// extractCollectionLinks.js's collectionLinkCounts.json
export function findStubMatch(collection, wpBullets, linkCounts) {
  const url = collectionUrl(collection);
  if (!url) return null;

  const wpHtml = wpBullets.find((html) => extractLinks(html).has(url));
  if (!wpHtml) return null; // link not found in this issue's WP content at all - nothing to flag

  const ids = linkCounts[url];
  if (!ids || ids.length !== 1) return { ambiguous: true, url };

  return { wpHtml, url };
}

export default { findStubMatch };
