// Reverse-parser for qTranslate's two shortcode conventions, both of which
// the real WordPress dump uses across different eras:
//   - "[:xx]content[:yy]content[:]" bracket style (osmbc itself also
//     produces this - routes/blog.js:renderBlogPreviewHeader,
//     model/blog.js:createInlineBundleWriter), used from ~issue 268 onward.
//   - the OLDER "<!--:xx-->content<!--:-->" HTML-comment style, used for
//     real weekly issues #219-257 (Sept 2014 - June 2015, verified: 27
//     posts, e.g. #221 - post_status='publish', found only by querying
//     wp_posts directly, since this parser silently returned "no markers
//     found" for all of them). Missing this meant this whole issue range's
//     multi-language content (EN/ES/JA/RO/...) was never even offered to
//     the backport pipeline - not "confirmed absent", just never looked at
//     correctly.
// Both segment styles are tried; whichever one actually finds markers wins.

const MARKER_RE = /\[:([a-z]{2})\]/g;
const HTML_COMMENT_OPEN_RE = /<!--:([a-z]{2})-->/gi;
const HTML_COMMENT_CLOSE = "<!--:-->";

function parseBracketShortcode(raw) {
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

function parseHtmlCommentShortcode(raw) {
  const warnings = [];
  const languages = {};
  const matches = [...raw.matchAll(HTML_COMMENT_OPEN_RE)];

  if (matches.length === 0) {
    return { languages, warnings: ["no <!--:xx--> markers found"] };
  }

  const leading = raw.slice(0, matches[0].index);
  if (leading.trim() !== "") {
    warnings.push(`content before first <!--:xx--> marker: ${JSON.stringify(leading.slice(0, 50))}`);
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const lang = match[1].toLowerCase();
    const contentStart = match.index + match[0].length;
    const closeIndex = raw.indexOf(HTML_COMMENT_CLOSE, contentStart);
    const contentEnd = closeIndex === -1 ? raw.length : closeIndex;
    if (closeIndex === -1) warnings.push(`no closing ${HTML_COMMENT_CLOSE} found for <!--:${lang}-->`);
    const content = raw.slice(contentStart, contentEnd);

    if (Object.prototype.hasOwnProperty.call(languages, lang)) {
      warnings.push(`duplicate language marker <!--:${lang}-->`);
    }
    languages[lang] = content;
  }

  return { languages, warnings };
}

export function parseShortcode(raw) {
  if (typeof raw !== "string") {
    return { languages: {}, warnings: ["input is not a string"] };
  }

  const bracketResult = parseBracketShortcode(raw);
  if (Object.keys(bracketResult.languages).length > 0) return { ...bracketResult, style: "bracket" };

  const htmlCommentResult = parseHtmlCommentShortcode(raw);
  if (Object.keys(htmlCommentResult.languages).length > 0) return { ...htmlCommentResult, style: "html-comment" };

  return { languages: {}, warnings: ["no [:xx] or <!--:xx--> markers found"], style: null };
}

export default { parseShortcode };
