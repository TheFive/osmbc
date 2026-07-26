// Reverse-parser for the qTranslate-style "[:xx]content[:yy]content[:]" bracket
// convention that osmbc itself produces (routes/blog.js:renderBlogPreviewHeader,
// model/blog.js:createInlineBundleWriter) and that the real WordPress dump uses
// for both post_title and post_content.

const MARKER_RE = /\[:([a-z]{2})\]/g;

export function parseShortcode(raw) {
  if (typeof raw !== "string") {
    return { languages: {}, warnings: ["input is not a string"] };
  }

  const warnings = [];
  const languages = {};
  const matches = [...raw.matchAll(MARKER_RE)];

  if (matches.length === 0) {
    return { languages, warnings: ["no [:xx] markers found"] };
  }

  const leading = raw.slice(0, matches[0].index);
  if (leading.trim() !== "") {
    warnings.push(`content before first [:xx] marker: ${JSON.stringify(leading.slice(0, 50))}`);
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const lang = match[1];
    const contentStart = match.index + match[0].length;
    const contentEnd = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    let content = raw.slice(contentStart, contentEnd);

    // the format is terminated by a bare "[:]" with no language code,
    // which MARKER_RE does not match, so it is left dangling on the last segment
    if (i === matches.length - 1 && content.endsWith("[:]")) {
      content = content.slice(0, -3);
    }

    if (Object.prototype.hasOwnProperty.call(languages, lang)) {
      warnings.push(`duplicate language marker [:${lang}]`);
    }
    languages[lang] = content;
  }

  return { languages, warnings };
}

export default { parseShortcode };
