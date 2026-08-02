// A handful of early transitional-era articles are missing the source link
// inside the article text itself (a real editor mistake, confirmed against
// WN276 article 10165: "Mikel Maron [...] HOT from 2005-2010." has zero
// links in any language's rawMarkdown) - but the real source link still
// exists in the article's own "collection" field (the raw link an editor
// pastes in when first collecting the story), and matches the link WordPress
// actually published. Used only to help matchByLinks.js find the right
// counterpart - never shown in the diff/review text itself, since the
// article's real content genuinely has no link.
//
// Also applied even when the article already has other links (confirmed
// real case: WN276 article 10164 - its one inline link changed path between
// osmbc and WP, https://ifs.hsr.ch/index.php?id=12520 vs .../Geometa-Lab.
// 12520+..., a genuine, unnormalizable URL drift - but the collection field
// still has the real twitter.com/.../status/... link WP actually published
// inline, that osmbc never inlined at all). Per the project owner's
// explicit rule: only add it when the collection link is "halbwegs
// eindeutig" (reasonably unique) globally - gated on the same
// extractCollectionLinks.js uniqueness index used by stubCollectionMatch.js,
// so a generic/reused collection link never gets injected as if it were a
// confident signal.
import { extractLinks, normalizeUrl } from "./matchByLinks.js";

export function addCollectionFallbackLink(html, collection, linkCounts) {
  const m = collection && /https?:\/\/\S+/.exec(collection);
  if (!m) return html;
  const url = normalizeUrl(m[0]);
  const ids = linkCounts && linkCounts[url];
  if (!ids || ids.length !== 1) return html; // not reasonably unique - don't risk it
  if (extractLinks(html).has(url)) return html; // already present, nothing to add
  return `${html} <a href="${m[0]}">collection</a>`;
}

export default { addCollectionFallbackLink };
