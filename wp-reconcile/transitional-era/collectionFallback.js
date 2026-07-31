// A handful of early transitional-era articles are missing the source link
// inside the article text itself (a real editor mistake, confirmed against
// WN276 article 10165: "Mikel Maron [...] HOT from 2005-2010." has zero
// links in any language's rawMarkdown) - but the real source link still
// exists in the article's own "collection" field (the raw link an editor
// pastes in when first collecting the story), and matches the link WordPress
// actually published. Used only to help matchByLinks.js find the right
// counterpart - never shown in the diff/review text itself, since the
// article's real content genuinely has no link.
import { extractLinks } from "./matchByLinks.js";

export function addCollectionFallbackLink(html, collection) {
  if (extractLinks(html).size > 0) return html;
  if (!collection) return html;
  const m = /https?:\/\/\S+/.exec(collection);
  if (!m) return html;
  return `${html} <a href="${m[0]}">collection</a>`;
}

export default { addCollectionFallbackLink };
