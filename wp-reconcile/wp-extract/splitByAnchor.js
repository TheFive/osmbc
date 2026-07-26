// Splits one language's rendered issue body back into per-article fragments,
// using the <li id="wn<issue>_<articleId>"> anchor convention osmbc's own
// HTML export emits (render/HtmlRenderer.js) and which survives into the real
// published WordPress post_content (confirmed against the live dump).

import { load } from "cheerio";

const ANCHOR_ID_RE = /^wn\d+_(\d+)$/i;

export function splitByAnchor(html) {
  if (typeof html !== "string" || html.trim() === "") {
    return { articles: {}, warnings: ["empty or non-string html"] };
  }

  const $ = load(html, null, false);
  const articles = {};
  const warnings = [];

  $("li[id]").each((_, el) => {
    const id = $(el).attr("id");
    const m = id && id.match(ANCHOR_ID_RE);
    if (!m) return;
    const articleId = m[1];
    if (Object.prototype.hasOwnProperty.call(articles, articleId)) {
      warnings.push(`duplicate anchor id ${id}`);
    }
    articles[articleId] = $(el).html();
  });

  if (Object.keys(articles).length === 0) {
    warnings.push("no wn<issue>_<id> anchors found");
  }

  return { articles, warnings };
}

export default { splitByAnchor };
