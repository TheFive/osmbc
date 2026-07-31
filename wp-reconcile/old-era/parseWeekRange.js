// Parses the date range stated at the very start of an old wp_1_posts body
// (e.g. "10.6.–16.6.", "6.1. - 14.1.2013", "22.09.2015 - 28.09.2015") into
// startDate/endDate - this is the real, editor-stated week the issue covers,
// which is more accurate than deriving it from the post's publish date
// (verified: publish date trails the real end of the week by several days,
// e.g. WN272 endDate 2015-10-05 vs. its real WordPress post_date 2015-10-09).
//
// The historical text is inconsistently formatted (dash vs. en-dash, year
// present on neither/one/both sides, optional leading zeros) and at least
// one real issue (WN250) has an outright typo ("28.14." - month 14 doesn't
// exist). Parsed results are sanity-checked (valid dates, a 3-10 day span,
// landing within a plausible window before the post's publish date) and
// fall back to a fixed 6-day span ending on the publish date if anything
// looks wrong, rather than trusting a malformed date silently.

const RANGE_RE = /^\s*(\d{1,2})\.(\d{1,2})\.?(\d{4})?\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.?(\d{4})?/;

function fallback(post) {
  const end = new Date(Date.UTC(post.getUTCFullYear(), post.getUTCMonth(), post.getUTCDate()));
  const start = new Date(end.getTime() - 6 * 24 * 3600 * 1000);
  return { startDate: start.toISOString(), endDate: end.toISOString(), method: "fallback" };
}

export function parseWeekRange(text, postDate) {
  const post = new Date(postDate);
  const m = RANGE_RE.exec(text || "");
  if (!m) return fallback(post);

  const [, d1, mo1, y1, d2, mo2, y2] = m;
  const endYear = y2 ? parseInt(y2, 10) : post.getUTCFullYear();
  const startYear = y1 ? parseInt(y1, 10) : endYear;
  const start = new Date(Date.UTC(startYear, parseInt(mo1, 10) - 1, parseInt(d1, 10)));
  const end = new Date(Date.UTC(endYear, parseInt(mo2, 10) - 1, parseInt(d2, 10)));

  const spanDays = (end - start) / (24 * 3600 * 1000);
  const daysBeforePost = (post - end) / (24 * 3600 * 1000);
  if (isNaN(start) || isNaN(end) || spanDays < 3 || spanDays > 10 || daysBeforePost < -2 || daysBeforePost > 45) {
    return fallback(post);
  }
  return { startDate: start.toISOString(), endDate: end.toISOString(), method: "parsed" };
}

export default { parseWeekRange };
