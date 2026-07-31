#!/usr/bin/env node
// Report-only scan (never writes anywhere - no backport.sql, unlike
// generateBackport.js) for WN272-304: the transitional era where osmbc's
// <li id="wn<n>_<id>"> anchor convention doesn't help, because osmbc's
// CURRENT renderer emits numeric-id anchors but the real published
// WordPress HTML from this era used a different, now-obsolete id scheme
// (or none at all) - confirmed "not-comparable" by scanAndReport.js's
// anchor-ratio gate for exactly this range.
//
// Matches articles by shared external links instead (see
// transitional-era/matchByLinks.js) - validated across WN285/295/300:
// 95-98% confident matches, 0 ambiguous. Lower confidence than the
// WN272+ tool's exact anchor matching, so this only ever produces a
// report for human review - no SQL, no writes.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeHtml } from "../diff-engine/normalizeHtml.js";
import { classifyChange } from "../diff-engine/classifyChange.js";
import { matchByLinks } from "./matchByLinks.js";
import { parseOldBlogSections } from "../old-era/parseOldBlogSections.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OSMBC_DIR = path.join(__dirname, "..", "..", "backport", "input", "osmbc");
const WP_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts");
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output", "transitional-era");

// Verified exact range: scanAndReport.js's index.csv shows every issue
// WN272-304 as "not-comparable", and WN305 onward as reliably anchor-matched.
const FIRST_ISSUE = 272;
const LAST_ISSUE = 304;

// osmbc language code -> WordPress-facing language code (model/language.js:wpExportName).
// CZ excluded - confirmed out of scope (translated entirely outside osmbc).
const WP_LANG = {
  DE: "de", EN: "en", ES: "es", PT: "pt", TR: "tr", RU: "ru",
  JP: "ja", FR: "fr", ID: "id", NL: "nl", IT: "it", KO: "ko", SW: "sw",
  BR: "br", ZH: "zh", PL: "pl", UK: "uk", CN: "cn"
};

function extractOsmbcArticles(body, n) {
  const articles = {};
  const re = new RegExp(`id="wn${n}_(\\d+)">([\\s\\S]*?)</li>`, "g");
  let m;
  while ((m = re.exec(body)) !== null) articles[m[1]] = m[2];
  return articles;
}

function csvEscape(value) {
  const s = String(value === undefined || value === null ? "" : value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const summaryRows = [["issue", "lang", "osmbcArticles", "wpBullets", "matched", "changed", "unmatchedOsmbc", "unmatchedWp", "ambiguous"]];
const findingsRows = [["issue", "lang", "articleId", "changeType", "matchScore", "textVorher", "textNachher"]];
const reviewRows = [["issue", "lang", "type", "articleId", "text"]];

let totalChanged = 0, totalUnmatched = 0, totalAmbiguous = 0;

for (let n = FIRST_ISSUE; n <= LAST_ISSUE; n++) {
  const issue = "WN" + n;
  const osmbcFile = path.join(OSMBC_DIR, issue + ".json");
  const wpFile = path.join(WP_DIR, n + ".json");
  if (!fs.existsSync(osmbcFile) || !fs.existsSync(wpFile)) continue;

  const osmbc = JSON.parse(fs.readFileSync(osmbcFile, "utf8"));
  const wp = JSON.parse(fs.readFileSync(wpFile, "utf8"));
  const articleById = new Map(osmbc.articles.map((a) => [a.id, a]));

  function hasRealTranslation(id, lang) {
    const raw = articleById.get(id) && articleById.get(id).rawMarkdown && articleById.get(id).rawMarkdown[lang];
    return Boolean(raw) && raw.trim() !== "" && raw !== "no translation";
  }

  for (const [osmbcLang, wpLang] of Object.entries(WP_LANG)) {
    if (!osmbc.closedLanguages || osmbc.closedLanguages[osmbcLang] !== true) continue;
    const osmbcBody = osmbc.perLanguage[osmbcLang] && osmbc.perLanguage[osmbcLang].body;
    const wpLangData = wp.perLanguage[wpLang];
    if (!osmbcBody || !wpLangData) continue;

    // Osmbc's export always emits an anchor per article even when there is
    // no real translation for this language (verified early on: the
    // fallback is a placeholder/title-only render) - excluding those here
    // avoids polluting the link-matcher with content that has no links to
    // match on in the first place, and isn't a real "missing from WP" case.
    const osmbcArticlesRaw = extractOsmbcArticles(osmbcBody, n);
    const osmbcArticles = {};
    for (const [id, html] of Object.entries(osmbcArticlesRaw)) {
      if (hasRealTranslation(id, osmbcLang)) osmbcArticles[id] = html;
    }
    if (Object.keys(osmbcArticles).length === 0) continue;
    const { sections } = parseOldBlogSections(wpLangData.body);
    const wpBullets = sections.flatMap((s) => s.articlesHtml);
    if (wpBullets.length === 0) continue;

    const { matches, unmatchedOsmbc, unmatchedWp, ambiguous } = matchByLinks(osmbcArticles, wpBullets);

    let changed = 0;
    for (const m of matches) {
      const a = normalizeHtml(osmbcArticles[m.articleId]);
      const b = normalizeHtml(m.wpHtml);
      if (a.replace(/\s+/g, "") === b.replace(/\s+/g, "")) continue;
      changed++;
      totalChanged++;
      findingsRows.push([issue, osmbcLang, m.articleId, classifyChange(a, b), m.score === null ? "leftover" : m.score.toFixed(2), a, b]);
    }

    for (const u of unmatchedOsmbc) {
      reviewRows.push([issue, osmbcLang, "unmatched-osmbc", u.articleId, normalizeHtml(u.html)]);
      totalUnmatched++;
    }
    for (const html of unmatchedWp) {
      reviewRows.push([issue, osmbcLang, "unmatched-wp", "", normalizeHtml(html)]);
      totalUnmatched++;
    }
    for (const a of ambiguous) {
      reviewRows.push([issue, osmbcLang, "ambiguous", a.articleId, normalizeHtml(a.html)]);
      totalAmbiguous++;
    }

    summaryRows.push([issue, osmbcLang, Object.keys(osmbcArticles).length, wpBullets.length, matches.length, changed, unmatchedOsmbc.length, unmatchedWp.length, ambiguous.length]);
  }
}

fs.writeFileSync(path.join(OUT_DIR, "summary.csv"), summaryRows.map((r) => r.map(csvEscape).join(",")).join("\n"));
fs.writeFileSync(path.join(OUT_DIR, "findings.csv"), findingsRows.map((r) => r.map(csvEscape).join(",")).join("\n"));
fs.writeFileSync(path.join(OUT_DIR, "needs-review.csv"), reviewRows.map((r) => r.map(csvEscape).join(",")).join("\n"));

console.info(`Issues ${FIRST_ISSUE}-${LAST_ISSUE}: ${findingsRows.length - 1} genuine change(s) found via link-matching, ${totalUnmatched} item(s) need manual review, ${totalAmbiguous} ambiguous match(es).`);
console.info(`Summary: ${path.join(OUT_DIR, "summary.csv")}`);
console.info(`Findings: ${path.join(OUT_DIR, "findings.csv")}`);
console.info(`Needs review: ${path.join(OUT_DIR, "needs-review.csv")}`);
