// Anchor-relative positional matching for the old era's language backfill.
//
// Real case that motivated this (WN225, EN): the DE osmbc article links a
// mailing-list message reporting Field Papers had an outage
// (.../071416.html), while EN/ES/JA/RO's translation links a LATER message
// in the same thread saying it's back up (.../071422.html) - DE was
// published first, the translations followed later and picked the more
// current message. No link overlap, so matchByLinks/bridgeMatch can't
// connect them. But both sides sit immediately next to the SAME
// already-matched neighbour (the UNMIL Liberia import, one bullet later in
// both DE and EN) - that shared anchor makes the correspondence safe to
// infer without ever comparing the two bullets' content.
//
// Unlike the transitional era's positionalMatch.js, this does NOT require
// equal category counts between languages - real old-era translations
// routinely drop entire categories (e.g. WN225 EN never translated
// "Wochenvorschau"/"In eigener Sache" at all: DE has 14 categories, EN 11,
// ES 10). So categories are aligned to each other empirically, using the
// already-matched bullets as evidence of which DE category a given
// target-language category corresponds to - never by heading text
// (translated) or by raw position/count.
//
// Within one aligned category pair, already-matched bullets partition both
// sequences into gaps. A gap is only filled when it holds EXACTLY ONE
// unmatched bullet on BOTH sides - the same "leftover pairing" rule
// matchByLinks.js already uses globally per issue, just applied locally
// between anchors instead of across a whole category. Multi-item gaps are
// left alone; guessing an order within them would be exactly the kind of
// content-blind coincidence this project has repeatedly found unsafe.

// deSections: [{ headingText, articleIds }] - articleIds[i] is the osmbc
//   article id for the DE bullet at position i in that section (from
//   matching the freshly re-parsed wp_1_posts DE body against osmbc's own
//   markdownDE via the same htmlToMarkdown conversion rebuildOldBlog.js
//   used to create them - see backfillLanguages.js).
// targetSections: [{ headingText, articlesHtml }] - from parseOldBlogSections
//   on the target language's wp_posts body.
// directMatches: [{ articleId, wpHtml }] - matchByLinks' direct-match output
//   for this language (wpHtml must be the exact string found in one of
//   targetSections' articlesHtml arrays).
//
// Returns: [{ articleId, wpHtml }] - inferred pairs, same shape as
// directMatches, for the caller to treat like bridge matches (report for
// manual confirmation, don't auto-write).
export function anchorPositionalMatch({ deSections, targetSections, directMatches }) {
  const dePos = new Map(); // articleId -> { si, ii }
  deSections.forEach((sec, si) => {
    sec.articleIds.forEach((id, ii) => {
      if (id != null) dePos.set(id, { si, ii });
    });
  });

  const targetPos = new Map(); // html -> { si, ii }
  targetSections.forEach((sec, si) => {
    sec.articlesHtml.forEach((html, ii) => targetPos.set(html, { si, ii }));
  });

  // Empirically align DE section index -> target section index, using
  // direct matches as evidence. A DE section is only used as an anchor
  // source if ALL its matched bullets agree on the same target section -
  // any disagreement means the evidence is too weak to align that section
  // at all, so it's dropped rather than guessed.
  const sectionPairs = new Map(); // deSectionIndex -> Set(targetSectionIndex)
  const anchorsByPair = new Map(); // "deSi|targetSi" -> [{deIi, targetIi}]
  for (const m of directMatches) {
    const d = dePos.get(m.articleId);
    const t = targetPos.get(m.wpHtml);
    if (!d || !t) continue;
    if (!sectionPairs.has(d.si)) sectionPairs.set(d.si, new Set());
    sectionPairs.get(d.si).add(t.si);
    const key = `${d.si}|${t.si}`;
    if (!anchorsByPair.has(key)) anchorsByPair.set(key, []);
    anchorsByPair.get(key).push({ deIi: d.ii, targetIi: t.ii });
  }

  const results = [];
  for (const [deSi, targetSiSet] of sectionPairs) {
    if (targetSiSet.size !== 1) continue; // ambiguous evidence, don't align this section
    const targetSi = [...targetSiSet][0];
    const anchors = anchorsByPair.get(`${deSi}|${targetSi}`).sort((a, b) => a.deIi - b.deIi);

    const deSection = deSections[deSi];
    const targetSection = targetSections[targetSi];
    const alreadyMatchedTargetHtml = new Set(directMatches.map((m) => m.wpHtml));
    const alreadyMatchedArticleId = new Set(directMatches.map((m) => m.articleId));

    // Boundaries: section start, each anchor, section end.
    const deBounds = [-1, ...anchors.map((a) => a.deIi), deSection.articleIds.length];
    const targetBounds = [-1, ...anchors.map((a) => a.targetIi), targetSection.articlesHtml.length];

    for (let k = 0; k < deBounds.length - 1; k++) {
      const deGap = [];
      for (let ii = deBounds[k] + 1; ii < deBounds[k + 1]; ii++) {
        const id = deSection.articleIds[ii];
        if (id != null && !alreadyMatchedArticleId.has(id)) deGap.push(id);
      }
      const targetGap = [];
      for (let ii = targetBounds[k] + 1; ii < targetBounds[k + 1]; ii++) {
        const html = targetSection.articlesHtml[ii];
        if (!alreadyMatchedTargetHtml.has(html)) targetGap.push(html);
      }
      if (deGap.length === 1 && targetGap.length === 1) {
        results.push({ articleId: deGap[0], wpHtml: targetGap[0] });
      }
    }
  }
  return results;
}

export default { anchorPositionalMatch };
