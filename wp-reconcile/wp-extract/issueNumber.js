// Extracts the weeklyOSM/Wochennotiz issue number from a WordPress post_title,
// covering both the old single-language table (wp_1_posts, plain titles like
// "Wochennotiz Nr. 523") and the current multi-language table (wp_posts,
// "[:en]weeklyOSM 825[:de]Wochennotiz 825...[:]" bracket titles).

import { parseShortcode } from "./parseShortcode.js";

const OLD_TITLE_RE = /Wochennotiz\s+Nr\.\s*(\d+)/i;
// Each language segment of a bracket-style title is "<localized label> <number>"
// (e.g. "weeklyOSM 825", "Wochennotiz 825", "hebdoOSM 825", "OSMkilawiki 825"),
// so match the trailing number rather than a specific label, since the label
// differs per language and there is no single word common to all of them.
const BRACKET_TITLE_RE = /(\d{2,4})\s*$/;
// The older <!--:xx--> style instead appends a full date range, e.g.
// "weekly 221 – 07.10.-13.10.2014" - the trailing-anchored regex above would
// match "2014" (the year) instead of the real issue number "221". Match the
// first 2-4 digit run that isn't adjacent to a "." on either side, since
// every date component (day/month/year) always touches a "." while the
// issue number itself never does.
const HTML_COMMENT_TITLE_RE = /(?<![.\d])(\d{2,4})(?![.\d])/;

export function issueNumberFromOldTitle(title) {
  if (typeof title !== "string") return null;
  const m = title.match(OLD_TITLE_RE);
  return m ? Number(m[1]) : null;
}

export function issueNumberFromNewTitle(title) {
  if (typeof title !== "string") return null;
  const { languages, style } = parseShortcode(title);
  const candidates = languages.en ? [languages.en, ...Object.values(languages)] : Object.values(languages);
  const re = style === "html-comment" ? HTML_COMMENT_TITLE_RE : BRACKET_TITLE_RE;
  for (const candidate of candidates) {
    const m = candidate.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

export default { issueNumberFromOldTitle, issueNumberFromNewTitle };
