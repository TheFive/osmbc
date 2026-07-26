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

const indexRows = [["issue", "languagesCompared", "articlesCompared", "articlesDiffering", "status"]];
const files = fs.readdirSync(OSMBC_DIR).filter((f) => f.endsWith(".json")).sort();

let issuesWithDiffs = 0;

for (const file of files) {
  const issue = file.replace(".json", "");
  const n = issue.replace(/^WN/i, "");
  const wpFile = path.join(WP_DIR, n + ".json");
  if (!fs.existsSync(wpFile)) continue;

  const osmbc = JSON.parse(fs.readFileSync(path.join(OSMBC_DIR, file), "utf8"));
  const wp = JSON.parse(fs.readFileSync(wpFile, "utf8"));

  let languagesCompared = 0;
  let articlesCompared = 0;
  const diffs = [];

  for (const [osmbcLang, wpLang] of Object.entries(WP_LANG)) {
    const osmbcBody = osmbc.perLanguage[osmbcLang] && osmbc.perLanguage[osmbcLang].body;
    const wpLangData = wp.perLanguage[wpLang];
    if (!osmbcBody || !wpLangData) continue;
    languagesCompared++;

    const osmbcArticles = extractArticles(osmbcBody, n);
    const wpArticles = wpLangData.articles || {};
    const commonIds = Object.keys(osmbcArticles).filter((id) => id in wpArticles);
    articlesCompared += commonIds.length;

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

  const status = diffs.length === 0 ? "equal" : "differs";
  indexRows.push([issue, languagesCompared, articlesCompared, diffs.length, status]);

  if (diffs.length > 0) {
    issuesWithDiffs++;
    let md = `# ${issue} - ${diffs.length} genuine difference(s) found\n\n`;
    md += `(CZ excluded - translated outside osmbc. Cosmetic WordPress formatting differences, e.g. self-closing tags, HTML entities, wpautop paragraph handling, are normalized out and not shown.)\n\n`;
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

console.info(`Compared ${indexRows.length - 1} issues. ${issuesWithDiffs} have at least one genuine (non-cosmetic, non-CZ) difference.`);
console.info(`Index: ${path.join(REPORT_DIR, "index.csv")}`);
console.info(`Per-issue detail files in: ${REPORT_DIR}`);
