// Some issues have many separate wp_posts rows (real case: WN279, 20 rows
// spanning 2015-2025) - WordPress revisions, not just edits. Simply taking
// the latest by post_date (extractWpPosts.js's previous behaviour) is
// unsound: WN279's Russian content was corrupted (~29% literal "?"
// characters, verified against the raw MySQL bytes - a genuine historical
// encoding mishap, not an artifact of this script) in an early 2015-11-28
// revision, a real editor fixed it by 2015-12-07, but the LATEST row
// (2025-11-10, seemingly an unrelated automated re-save) reverted to the
// original 2015-11-28 corrupted text. Picking "latest" alone silently
// re-introduced already-fixed corruption - this cost a real regression:
// applyBackport.js later backported that corrupted text over a real
// editor's correct 2016 osmbc content for WN279/WN334/WN340/WN350.
//
// Merge per language instead, preferring whichever candidate is markedly
// less "?"-corrupted, and only falling back to "longer body wins"
// (mergeGermanFromOldBlog's existing convention, extractWpPosts.js) when
// corruption levels are comparable.

export function qMarkRatio(text) {
  if (!text) return 0;
  const q = (text.match(/\?/g) || []).length;
  return text.length ? q / text.length : 0;
}

export function isBetterLanguageEntry(candidate, current) {
  if (!current) return true;
  const candidateRatio = qMarkRatio(candidate.body);
  const currentRatio = qMarkRatio(current.body);
  if (Math.abs(candidateRatio - currentRatio) > 0.03) return candidateRatio < currentRatio;
  return (candidate.body || "").length > (current.body || "").length;
}

// Merges a new row's extraction result into the running per-issue result,
// language by language (see isBetterLanguageEntry) - rows are processed in
// post_date ASC order, so ties naturally prefer the latest revision.
export function mergeIssueResult(existing, incoming) {
  for (const [lang, entry] of Object.entries(incoming.perLanguage)) {
    const current = existing.perLanguage[lang];
    if (isBetterLanguageEntry(entry, current)) {
      existing.perLanguage[lang] = current && current.body !== entry.body
        ? { ...entry, sourcePostId: incoming.postId }
        : entry;
    }
  }
  existing.warnings.push(...incoming.warnings.map((w) => `[postId ${incoming.postId}] ${w}`));
  existing.postId = incoming.postId;
  existing.postDate = incoming.postDate;
  existing.postModified = incoming.postModified;
}

export default { qMarkRatio, isBetterLanguageEntry, mergeIssueResult };
