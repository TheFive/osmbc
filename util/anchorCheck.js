// Footnote anchors "#wn<issue>_<articleId>", used in Picture article
// captions (e.g. "[[1](#wn796_33564)]"). The Hugo renderer turns them into
// links to the article; an anchor to a missing, unpublished or wrong-issue
// article breaks the Hugo rendering (issue #1130). OSMBC's own preview never
// emits these ids, so they can only be checked against the database.

import articleModule from "../model/article.js";
import { UNPUBLISHED } from "../model/specialCategories.js";

export const ANCHOR_RE = /^#wn(\d+)_(\d+)$/i;
// anchors as link targets inside markdown, e.g. "](#wn796_33564)"
const ANCHOR_IN_MARKDOWN_RE = /\]\((#wn\d+_\d+)\)/gi;

/**
 * Check one anchor against the database.
 * @param {string} anchor e.g. "#wn796_33564"
 * @param {string|null} expectedBlog blog the anchor must belong to (e.g.
 *   "WN796" when closing that blog), null to accept any issue
 * @param {function(Error|null, string=)} callback "OK" or a message for the editor
 */
export function checkAnchor(anchor, expectedBlog, callback) {
  const m = ANCHOR_RE.exec(anchor);
  if (!m) return callback(null, `"${anchor}" is not an anchor like #wn<issue>_<article id>`);
  const issue = "WN" + m[1];
  if (expectedBlog && issue.toUpperCase() !== expectedBlog.toUpperCase()) {
    return callback(null, `Anchor "${anchor}" points to ${issue}, not ${expectedBlog}`);
  }
  articleModule.findById(parseInt(m[2], 10), function(err, article) {
    if (err) return callback(err);
    if (!article) return callback(null, `Anchor "${anchor}" refers to a non-existing article`);
    if (article.blog !== issue) return callback(null, `Anchor "${anchor}" points to an article in ${article.blog}, not ${issue}`);
    if (article.categoryEN === UNPUBLISHED) return callback(null, `Anchor "${anchor}" points to an unpublished article`);
    return callback(null, "OK");
  });
}

/**
 * All distinct footnote anchors used as link targets in a markdown text.
 * @param {string} markdown article text
 * @returns {string[]} e.g. ["#wn796_33564"]
 */
export function findAnchors(markdown) {
  if (typeof markdown !== "string") return [];
  const result = new Set();
  for (const match of markdown.matchAll(ANCHOR_IN_MARKDOWN_RE)) result.add(match[1]);
  return Array.from(result);
}
