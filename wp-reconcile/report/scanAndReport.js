#!/usr/bin/env node
// Compares every issue we have both-side data for (osmbc export vs real
// WordPress post), across all languages except CZ (translated entirely
// outside osmbc, confirmed out of scope), using normalizeHtml.js to ignore
// WordPress's own cosmetic formatting artifacts.
//
// Produces:
//   wp-reconcile/data/reports/index.csv   - one row per issue: article/diff counts, status
//   wp-reconcile/data/reports/<issue>.md  - side-by-side diff detail, only for issues with real diffs
//
// Read-only: reads from wp-reconcile/data/wp/ and wp-reconcile/data/osmbc/
// (already extracted), never touches any database.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeHtml } from "../diff-engine/normalizeHtml.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OSMBC_DIR = path.join(__dirname, "..", "data", "osmbc");
const WP_DIR = path.join(__dirname, "..", "data", "wp", "wp_posts");
const REPORT_DIR = path.join(__dirname, "..", "data", "reports");

// osmbc language code -> WordPress-facing language code (model/language.js:wpExportName).
// CZ is intentionally excluded: translated entirely outside osmbc, out of scope.
const WP_LANG = {
  DE: "de", EN: "en", ES: "es", PT: "pt", TR: "tr", RU: "ru",
  JP: "ja", FR: "fr", ID: "id", NL: "nl", IT: "it", KO: "ko", SW: "sw",
  BR: "br", ZH: "zh", PL: "pl", UK: "uk", CN: "cn"
};

function extractArticles(body, issueNumber) {
  const articles = {};
  if (!body) return articles;
  const re = new RegExp(`id="wn${issueNumber}_(\\d+)">([\\s\\S]*?)</li>`, "g");
  let m;
  while ((m = re.exec(body)) !== null) articles[m[1]] = m[2];
  return articles;
}

function csvEscape(value) {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

fs.mkdirSync(REPORT_DIR, { recursive: true });

const indexRows = [[
  "issue", "languagesCompared", "articlesCompared", "articlesDiffering",
  "articlesOnlyInOsmbc", "articlesOnlyInWp", "status"
]];
const files = fs.readdirSync(OSMBC_DIR).filter((f) => f.endsWith(".json")).sort();

let issuesWithDiffs = 0;
let totalOnlyOsmbc = 0;
let totalOnlyWp = 0;

for (const file of files) {
  const issue = file.replace(".json", "");
  const n = issue.replace(/^WN/i, "");
  const wpFile = path.join(WP_DIR, n + ".json");
  if (!fs.existsSync(wpFile)) continue;

  const osmbc = JSON.parse(fs.readFileSync(path.join(OSMBC_DIR, file), "utf8"));
  const wp = JSON.parse(fs.readFileSync(wpFile, "utf8"));
  const articleById = new Map(osmbc.articles.map((a) => [a.id, a]));

  function hasRealTranslation(id, lang) {
    const raw = articleById.get(id) && articleById.get(id).rawMarkdown && articleById.get(id).rawMarkdown[lang];
    return Boolean(raw) && raw.trim() !== "" && raw !== "no translation";
  }

  let languagesCompared = 0;
  let articlesCompared = 0;
  const diffs = [];
  // Union across all compared languages: an article's <li id="..."> anchor
  // is a structural marker (present regardless of translation completeness,
  // confirmed even for "no translation" placeholders - see the CZ finding),
  // so if it's missing from every language on one side, that side genuinely
  // doesn't have the article, not just an incomplete translation.
  const onlyOsmbcIds = new Set();
  const onlyWpIds = new Set();

  for (const [osmbcLang, wpLang] of Object.entries(WP_LANG)) {
    // Only closed<LANG> languages were actually approved/released by the
    // editorial team for this issue - a language can be left unfinished
    // ("hanging") in osmbc while others are done. Never compare or backport
    // content for a language that was never closed for this specific issue.
    if (!osmbc.closedLanguages || osmbc.closedLanguages[osmbcLang] !== true) continue;

    const osmbcBody = osmbc.perLanguage[osmbcLang] && osmbc.perLanguage[osmbcLang].body;
    const wpLangData = wp.perLanguage[wpLang];
    if (!osmbcBody || !wpLangData) continue;
    languagesCompared++;

    const osmbcArticles = extractArticles(osmbcBody, n);
    const wpArticles = wpLangData.articles || {};
    const commonIds = Object.keys(osmbcArticles).filter((id) => id in wpArticles);
    articlesCompared += commonIds.length;

    // Only count an article as "missing from WordPress" if osmbc actually
    // has a real translation for it in this language - osmbc's HTML export
    // always emits an anchor even when markdown<LANG> is empty/"no
    // translation" (confirmed with CZ and, to a lesser degree, SW/TR/RU/IT/
    // CN/ID/PL/KO), while WordPress's real HTML simply omits the bullet
    // entirely when there's no translation. Without this filter the count
    // was dominated by that rendering difference, not by real drift.
    for (const id of Object.keys(osmbcArticles)) {
      if (!(id in wpArticles) && hasRealTranslation(id, osmbcLang)) onlyOsmbcIds.add(id);
    }
    for (const id of Object.keys(wpArticles)) if (!(id in osmbcArticles)) onlyWpIds.add(id);

    for (const id of commonIds) {
      const a = normalizeHtml(osmbcArticles[id]);
      const b = normalizeHtml(wpArticles[id]);
      // Compare with whitespace fully stripped: WordPress sometimes merges
      // adjacent paragraphs without the space our paragraph-to-space
      // conversion inserts (e.g. "arrived!Alles" vs "arrived! Alles") - that
      // is paragraph-structure noise, not a real content edit. The readable,
      // spaced form is still what gets shown in the report.
      if (a.replace(/\s+/g, "") !== b.replace(/\s+/g, "")) {
        diffs.push({ lang: osmbcLang, articleId: id, osmbc: a, wp: b });
      }
    }
  }

  // 0 comparable articles is NOT the same as "equal" - for the earliest
  // issues (~WN272-304), osmbc's <li id="wn<n>_<id>"> anchor convention
  // did not exist yet in the real WordPress HTML, so nothing could be
  // matched at all. Only articlesCompared > 0 constitutes a verified match.
  // Below that threshold, onlyOsmbc/onlyWp counts are not meaningful either
  // (there's no reliable anchor structure to compare), so they are blanked
  // out rather than reported as if they were a real finding.
  const comparable = articlesCompared > 0;
  const status = !comparable ? "not-comparable" : (diffs.length === 0 && onlyOsmbcIds.size === 0 && onlyWpIds.size === 0 ? "equal" : "differs");
  const reportedOnlyOsmbc = comparable ? onlyOsmbcIds.size : "";
  const reportedOnlyWp = comparable ? onlyWpIds.size : "";
  indexRows.push([issue, languagesCompared, articlesCompared, diffs.length, reportedOnlyOsmbc, reportedOnlyWp, status]);
  if (comparable) { totalOnlyOsmbc += onlyOsmbcIds.size; totalOnlyWp += onlyWpIds.size; }

  if (diffs.length > 0 || (comparable && (onlyOsmbcIds.size > 0 || onlyWpIds.size > 0))) {
    issuesWithDiffs++;
    let md = `# ${issue} - ${diffs.length} genuine difference(s), ${onlyOsmbcIds.size} article(s) only in osmbc, ${onlyWpIds.size} article(s) only in WordPress\n\n`;
    md += `(CZ excluded - translated outside osmbc. Cosmetic WordPress formatting differences, e.g. self-closing tags, HTML entities, wpautop paragraph handling, are normalized out and not shown.)\n\n`;
    if (onlyOsmbcIds.size > 0) {
      md += `## Articles only in osmbc (not found in the published WordPress post - possibly removed/unpublished on WordPress)\n\n`;
      md += [...onlyOsmbcIds].map((id) => `- article ${id}`).join("\n") + "\n\n";
    }
    if (onlyWpIds.size > 0) {
      md += `## Articles only in WordPress (not found in osmbc - possibly added directly on WordPress)\n\n`;
      md += [...onlyWpIds].map((id) => `- article ${id}`).join("\n") + "\n\n";
    }
    for (const d of diffs) {
      md += `## [${d.lang}] Article ${d.articleId}\n\n`;
      md += `**osmbc (current):**\n\n> ${d.osmbc}\n\n`;
      md += `**WordPress (published):**\n\n> ${d.wp}\n\n`;
      md += `---\n\n`;
    }
    fs.writeFileSync(path.join(REPORT_DIR, `${issue}.md`), md);
  }
}

const csv = indexRows.map((row) => row.map(csvEscape).join(",")).join("\n");
fs.writeFileSync(path.join(REPORT_DIR, "index.csv"), csv);

console.info(`Compared ${indexRows.length - 1} issues. ${issuesWithDiffs} have at least one genuine (non-cosmetic, non-CZ) finding.`);
console.info(`Articles only in osmbc (across all comparable issues): ${totalOnlyOsmbc}`);
console.info(`Articles only in WordPress (across all comparable issues): ${totalOnlyWp}`);
console.info(`Index: ${path.join(REPORT_DIR, "index.csv")}`);
console.info(`Per-issue detail files in: ${REPORT_DIR}`);
