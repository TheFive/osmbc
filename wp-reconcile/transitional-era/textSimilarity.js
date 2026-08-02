// Word-level text similarity ratio (same formula as Python's
// difflib.SequenceMatcher.ratio(): 2*M / T, where M is the number of
// matching words and T is the total word count of both texts combined),
// reusing the same diffWords() already used by classifyChange.js rather
// than adding a new dependency.
//
// Purpose: a last-resort fallback for the transitional era, after link-
// based matching (matchByLinks.js) and the collection-link fallback both
// find nothing - two bullets can be the same real story with no shared
// link at all (e.g. an editor described a story without linking it the
// same way in osmbc and WordPress). Deliberately NOT auto-matched: unlike
// a shared link (close to a unique identifier), text similarity is fuzzy -
// two unrelated bullets can coincidentally share a lot of wording. Only
// ever surfaced as a candidate for manual review (see scanTransitionalEra.js
// "similar-text-candidate"), never written to aenderungen.csv directly.
import { diffWords } from "diff";

export function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const parts = diffWords(a, b);
  let matching = 0;
  let total = 0;
  for (const part of parts) {
    const words = part.value.trim().split(/\s+/).filter(Boolean).length;
    if (part.added) {
      total += words;
    } else if (part.removed) {
      total += words;
    } else {
      matching += words;
      total += 2 * words; // counted once in each of a/b
    }
  }
  if (total === 0) return 0;
  return (2 * matching) / total;
}

export default { textSimilarity };
