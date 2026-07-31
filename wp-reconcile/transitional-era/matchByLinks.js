// Matches osmbc articles to WordPress bullets for the transitional era
// (WN272-304 - verified "not-comparable" by scanAndReport.js's anchor-ratio
// gate) where exact <li id="wn<n>_<id>"> matching doesn't work: osmbc's
// CURRENT renderer always emits numeric-id anchors, but the real published
// WordPress HTML from this era used a different, now-obsolete id scheme
// (slug-based, e.g. id="wn295_eigenes_luftbild_als_josm-hintergrund" -
// confirmed against WN295) or no id at all - so there is no shared id
// between "what osmbc renders today" and "what was actually published back
// then" to match on directly.
//
// Instead, since a weeklyOSM article is fundamentally "a source link plus a
// short summary", articles are matched by the set of external links they
// contain (validated across WN285/295/300: 95-98% confident matches, 0
// ambiguous). Whatever is left over on both sides after link-matching is
// small per issue (verified) - paired 1:1 if the counts allow, otherwise
// left for manual review rather than guessed.

import { load } from "cheerio";

function normalizeUrl(url) {
  // Unwrap Google Translate's URL wrapping (seen throughout the real dump,
  // e.g. https://www-example-com.translate.goog/path?_x_tr_sl=auto&_x_tr_tl=EN)
  // so a translated and an original link to the same source compare equal.
  let u = url;
  const m = /^https?:\/\/([a-z0-9-]+(?:-[a-z0-9-]+)*)\.translate\.goog(\/[^?]*)/i.exec(u);
  if (m) u = "https://" + m[1].replace(/-/g, ".") + m[2];
  try {
    const parsed = new URL(u);
    const path = parsed.pathname.replace(/\/$/, "");
    return (parsed.hostname + path).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function extractLinks(html) {
  const $ = load(html || "", null, false);
  const links = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && /^https?:\/\//i.test(href)) links.add(normalizeUrl(href));
  });
  return links;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// osmbcArticles: { [articleId]: html }
// wpBullets: string[] (html)
// Returns: { matches: [{articleId, wpHtml, score}], unmatchedOsmbc: [{articleId, html}],
//            unmatchedWp: string[], ambiguous: [{articleId, html, candidates}] }
export function matchByLinks(osmbcArticles, wpBullets) {
  const wpCandidates = wpBullets.map((html) => ({ html, links: extractLinks(html), used: false }));
  const matches = [];
  const ambiguous = [];
  const unmatchedOsmbc = [];

  for (const [articleId, html] of Object.entries(osmbcArticles)) {
    const osmbcLinks = extractLinks(html);
    if (osmbcLinks.size === 0) {
      unmatchedOsmbc.push({ articleId, html });
      continue;
    }

    const scored = wpCandidates
      .filter((c) => !c.used)
      .map((c) => ({ ...c, score: jaccard(osmbcLinks, c.links) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      unmatchedOsmbc.push({ articleId, html });
    } else if (scored.length > 1 && scored[1].score > 0.3 && scored[0].score < 0.9) {
      ambiguous.push({ articleId, html, candidates: scored.slice(0, 3) });
    } else {
      matches.push({ articleId, wpHtml: scored[0].html, score: scored[0].score });
      const found = wpCandidates.find((c) => c.html === scored[0].html && !c.used);
      if (found) found.used = true;
    }
  }

  const unmatchedWp = wpCandidates.filter((c) => !c.used).map((c) => c.html);

  // "Blog as the master bracket": whatever is left over per issue/language
  // is small (verified), so a clean 1:1 leftover can be paired directly -
  // anything else (different counts) needs a human, not a guess.
  if (unmatchedOsmbc.length === 1 && unmatchedWp.length === 1) {
    matches.push({ articleId: unmatchedOsmbc[0].articleId, wpHtml: unmatchedWp[0], score: null, method: "leftover-pair" });
    return { matches, unmatchedOsmbc: [], unmatchedWp: [], ambiguous };
  }

  return { matches, unmatchedOsmbc, unmatchedWp, ambiguous };
}

export default { matchByLinks, extractLinks };
