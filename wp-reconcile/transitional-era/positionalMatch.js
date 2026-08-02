// Last-resort matching for a language that is essentially a total stub for
// one issue (every article lacks real translated text - confirmed real
// case: WN276 JP, osmbcArticles=0 despite 43 real published WP bullets):
// link-based matching and the collection-link fallback have nothing to
// work with when there's no real per-article text in that language at all.
//
// Idea (the project owner's own suggestion): WordPress publishes each
// language's translation of an issue following the same category
// structure and per-category bullet order (verified real case: WN276's
// EN and JP posts have identical category headings, in the same order,
// with the exact same bullet count in every one of the 10 categories). So
// the Nth WP bullet in a category, in a language that DID match well
// against osmbc, tells us which osmbc article the Nth WP bullet in the
// corresponding category of the otherwise-unmatched language must be.
//
// Deliberately built on WP-to-WP structural alignment, not osmbc's own
// per-language render order: osmbc's rendered category/article counts can
// differ slightly BETWEEN languages of the same issue even when one of
// them matched almost perfectly (confirmed: WN276's own EN render has 7
// articles under "Community" where the real WP EN post - and osmbc's own
// JP render - only has 6; the extra is exactly the one EN article that
// stayed unmatched). Using osmbc's render as the reference would silently
// misalign by one for every category downstream of a residual unmatched
// article - WP-to-WP alignment doesn't have that problem, since both
// sides are the real, already-published documents.

// referenceWpSections: parseOldBlogSections() output for a language that
// matched well against osmbc.
// referenceMatches: the `matches` array matchByLinks() returned for that
// same language (each {articleId, wpHtml}).
// targetWpSections: parseOldBlogSections() output for the otherwise-
// unmatched target language.
// Returns a Map(articleId -> target-language wpBulletHtml), built only for
// positions where the reference language actually had a confirmed match
// (an unmatched reference position contributes nothing here - no guess).
// Returns null outright if the category structure doesn't line up exactly
// between the two languages.
export function matchByReferenceLanguage(referenceWpSections, referenceMatches, targetWpSections) {
  if (referenceWpSections.length === 0 || referenceWpSections.length !== targetWpSections.length) return null;
  for (let i = 0; i < referenceWpSections.length; i++) {
    if (referenceWpSections[i].articlesHtml.length !== targetWpSections[i].articlesHtml.length) return null;
  }

  const articleIdByReferenceHtml = new Map(referenceMatches.map((m) => [m.wpHtml, m.articleId]));

  const map = new Map();
  for (let i = 0; i < referenceWpSections.length; i++) {
    for (let j = 0; j < referenceWpSections[i].articlesHtml.length; j++) {
      const articleId = articleIdByReferenceHtml.get(referenceWpSections[i].articlesHtml[j]);
      if (articleId) map.set(articleId, targetWpSections[i].articlesHtml[j]);
    }
  }
  return map;
}

export default { matchByReferenceLanguage };
