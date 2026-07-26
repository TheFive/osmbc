// Extracts the weeklyOSM/Wochennotiz issue number from a WordPress post_title,
// covering both the old single-language table (wp_1_posts, plain titles like
// "Wochennotiz Nr. 523") and the current multi-language table (wp_posts,
// "[:en]weeklyOSM 825[:de]Wochennotiz 825...[:]" bracket titles).

import { parseShortcode } from "./parseShortcode.js";

const OLD_TITLE_RE = /Wochennotiz\s+Nr\.\s*(\d+)/i;
// Each language segment of a new-style title is "<localized label> <number>"
// (e.g. "weeklyOSM 825", "Wochennotiz 825", "hebdoOSM 825", "OSMkilawiki 825"),
// so match the trailing number rather than a specific label, since the label
// differs per language and there is no single word common to all of them.
const NEW_TITLE_RE = /(\d{2,4})\s*$/;

export function issueNumberFromOldTitle(title) {
  if (typeof title !== "string") return null;
  const m = title.match(OLD_TITLE_RE);
  return m ? Number(m[1]) : null;
}

export function issueNumberFromNewTitle(title) {
  if (typeof title !== "string") return null;
  const { languages } = parseShortcode(title);
  const candidates = languages.en ? [languages.en, ...Object.values(languages)] : Object.values(languages);
  for (const candidate of candidates) {
    const m = candidate.match(NEW_TITLE_RE);
    if (m) return Number(m[1]);
  }
  return null;
}

export default { issueNumberFromOldTitle, issueNumberFromNewTitle };
