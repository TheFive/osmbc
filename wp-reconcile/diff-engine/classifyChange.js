// Classifies a change between two versions of an article that exist on both
// sides: "Typos" for a small edit (few words changed relative to the
// article's length), "Text" for anything larger. A heuristic, not a precise
// judgment - tune the thresholds below if it misclassifies too often in
// practice. Shared by generateBackport.js (WN272+ backport) and
// scanTransitionalEra.js (WN272-304 link-matched findings).

import { diffWords } from "diff";

export function classifyChange(oldText, newText) {
  const parts = diffWords(oldText, newText);
  let changedWords = 0;
  let totalWords = 0;
  for (const part of parts) {
    const wordCount = part.value.trim().split(/\s+/).filter(Boolean).length;
    totalWords += wordCount;
    if (part.added || part.removed) changedWords += wordCount;
  }
  if (totalWords === 0) return "Text";
  const ratio = changedWords / totalWords;
  return (changedWords <= 4 || ratio < 0.15) ? "Typos" : "Text";
}

export default { classifyChange };
