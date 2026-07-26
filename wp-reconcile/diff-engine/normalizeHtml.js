// Canonicalizes an HTML article fragment (from either osmbc's own export or
// a real WordPress post_content) into comparable plain text, so that
// WordPress's own content-filter artifacts (wpautop paragraph insertion,
// self-closing <img/> normalization, HTML entity re-encoding, ...) don't show
// up as false "drift" - only genuine textual differences should remain.

import { convert } from "html-to-text";

const HTML_TO_TEXT_OPTIONS = {
  wordwrap: false,
  selectors: [
    { selector: "a", options: { ignoreHref: true } },
    { selector: "img", format: "skip" }
  ]
};

export function normalizeHtml(html) {
  if (typeof html !== "string" || html.trim() === "") return "";
  return convert(html, HTML_TO_TEXT_OPTIONS)
    .replace(/\s+/g, " ")
    .trim();
}

export default { normalizeHtml };
