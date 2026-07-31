#!/usr/bin/env node
// Generates a psql script (for manual review + execution on the production
// server, by a human, never run automatically by this tool) that backports
// every genuine (non-cosmetic, non-CZ) WordPress-only content difference
// found by wp-reconcile/report/scanAndReport.js into osmbc's article table,
// plus a matching human-readable documentation file and a changes-log
// (audit trail) entry per edit, mirroring exactly what article.setAndSave()
// would log (see model/logModule.js / notification/LogModuleReceiver.js).
//
// This script itself never connects to any database - it only reads the
// already-extracted JSON under wp-reconcile/data/{wp,osmbc}/ and writes SQL.
//
// Run with: NODE_ENV=wpreconcile node wp-reconcile/backport/generateBackport.js

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { diffWords } from "diff";

import configModule from "../../model/config.js";
import { normalizeHtml } from "../diff-engine/normalizeHtml.js";
import { htmlToMarkdown } from "./htmlToMarkdown.js";

// Classifies a change to an article that exists on both sides: "Typos" for a
// small edit (few words changed relative to the article's length), "Text"
// for anything larger. A heuristic, not a precise judgment - tune the
// thresholds below if it misclassifies too often in practice.
function classifyChange(oldText, newText) {
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

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "generateBackport.js must run with NODE_ENV=wpreconcile."
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OSMBC_DIR = path.join(__dirname, "..", "..", "backport", "input", "osmbc");
const WP_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts");
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output");

// osmbc language code -> WordPress-facing language code (model/language.js:wpExportName).
// CZ is intentionally excluded - confirmed out of scope by the user (translated
// entirely outside osmbc, not an osmbc/WordPress sync issue).
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
  const s = String(value === undefined || value === null ? "" : value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Dollar-quoting tag that is guaranteed not to appear in the content it wraps.
function dollarQuote(content) {
  let tag = "bp0";
  let n = 0;
  while (content.includes(`$${tag}$`)) {
    n++;
    tag = "bp" + n;
  }
  return `$${tag}$${content}$${tag}$`;
}

function main(done) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const changes = []; // drives backport.sql - only genuine both-sides-present edits
  const findings = []; // drives aenderungen.csv - changes + only-osmbc + only-wp, for review
  const files = fs.readdirSync(OSMBC_DIR).filter((f) => f.endsWith(".json")).sort();

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

    // 0 comparable articles for the WHOLE issue (across every closed
    // language) means osmbc's <li id="wn<n>_<id>"> anchor convention did not
    // exist yet in the real WordPress HTML for this era (~WN272-304) - there
    // is no structural way to match articles at all, so "gelöscht"/"neu"
    // would be meaningless noise (everything would look "gelöscht"). Skip
    // the whole issue in that case, exactly like scanAndReport.js's
    // "not-comparable" gate.
    let issueArticlesCompared = 0;
    for (const [osmbcLang, wpLang] of Object.entries(WP_LANG)) {
      if (!osmbc.closedLanguages || osmbc.closedLanguages[osmbcLang] !== true) continue;
      const osmbcBody = osmbc.perLanguage[osmbcLang] && osmbc.perLanguage[osmbcLang].body;
      const wpLangData = wp.perLanguage[wpLang];
      if (!osmbcBody || !wpLangData) continue;
      const osmbcArticles = extractArticles(osmbcBody, n);
      const wpArticles = wpLangData.articles || {};
      issueArticlesCompared += Object.keys(osmbcArticles).filter((id) => id in wpArticles).length;
    }
    if (issueArticlesCompared === 0) continue;

    for (const [osmbcLang, wpLang] of Object.entries(WP_LANG)) {
      // Only closed<LANG> languages were actually approved/released by the
      // editorial team for this issue - never backport content for a
      // language that was never closed for this specific issue, even if it
      // happens to render/differ from something in WordPress.
      if (!osmbc.closedLanguages || osmbc.closedLanguages[osmbcLang] !== true) continue;

      const osmbcBody = osmbc.perLanguage[osmbcLang] && osmbc.perLanguage[osmbcLang].body;
      const wpLangData = wp.perLanguage[wpLang];
      if (!osmbcBody || !wpLangData) continue;

      const osmbcArticles = extractArticles(osmbcBody, n);
      const wpArticles = wpLangData.articles || {};
      const commonIds = Object.keys(osmbcArticles).filter((id) => id in wpArticles);

      // "gelöscht": osmbc has a real translation for this article/language
      // that never made it into the published WordPress post. Informational
      // only - never written to backport.sql.
      for (const id of Object.keys(osmbcArticles)) {
        if (id in wpArticles || !hasRealTranslation(id, osmbcLang)) continue;
        const articleMeta = articleById.get(id);
        findings.push({
          issue, articleId: id, title: articleMeta && articleMeta.title, categoryEN: articleMeta && articleMeta.categoryEN,
          lang: osmbcLang, changeType: "gelöscht",
          oldValue: articleMeta && articleMeta.rawMarkdown ? articleMeta.rawMarkdown[osmbcLang] : "",
          newValue: ""
        });
      }
      // "neu": WordPress has this article/language with no matching osmbc
      // anchor at all. Informational only - never written to backport.sql.
      for (const id of Object.keys(wpArticles)) {
        if (id in osmbcArticles) continue;
        findings.push({
          issue, articleId: id, title: "", categoryEN: "",
          lang: osmbcLang, changeType: "neu",
          oldValue: "",
          newValue: htmlToMarkdown(wpArticles[id])
        });
      }

      for (const id of commonIds) {
        const a = normalizeHtml(osmbcArticles[id]);
        const b = normalizeHtml(wpArticles[id]);
        if (a.replace(/\s+/g, "") === b.replace(/\s+/g, "")) continue; // no genuine diff

        const articleMeta = articleById.get(id);
        if (!articleMeta) continue; // defensive: should always be found

        const field = "markdown" + osmbcLang;
        const oldValue = articleMeta.rawMarkdown ? articleMeta.rawMarkdown[osmbcLang] : undefined;
        const newValue = htmlToMarkdown(wpArticles[id]);
        const oldValueSafe = oldValue === undefined || oldValue === null ? "" : oldValue;

        const change = {
          issue,
          articleId: id,
          version: articleMeta.version,
          title: articleMeta.title,
          categoryEN: articleMeta.categoryEN,
          lang: osmbcLang,
          field,
          oldValue: oldValueSafe,
          newValue
        };
        changes.push(change);
        findings.push({
          issue, articleId: id, title: articleMeta.title, categoryEN: articleMeta.categoryEN,
          lang: osmbcLang, changeType: classifyChange(oldValueSafe, newValue),
          oldValue: oldValueSafe, newValue
        });
      }
    }
  }

  // --- SQL script ---
  const now = new Date().toISOString();
  let sql = `-- wp-reconcile backport script
-- Generated ${now}
-- ${changes.length} change(s): backports genuine WordPress-only content edits
-- into osmbc's article table (all languages except CZ, which is translated
-- entirely outside osmbc and out of scope).
--
-- Each change is: 1) an audit-log entry in "changes" (attributed to the
-- synthetic user "wp-backport", matching the shape article.setAndSave()
-- itself would write - see model/logModule.js), 2) an UPDATE of the
-- corresponding markdown<LANG> field plus a version bump, guarded by
-- WHERE version = <snapshot version> so it fails closed if the article
-- was edited again since this script was generated.
--
-- Review before running. Intended to be run once against the production
-- database via psql. Not run automatically by this tool.

BEGIN;

`;

  // Group by article: multiple language fields on the same article must be
  // combined into a single UPDATE with a single version bump. Emitting one
  // UPDATE per (article, language) pair - each independently bumping
  // version and checking against the same stale snapshot version - was
  // verified (via a local ROLLBACK test run) to silently no-op on every
  // change after the first for a given article, since the version the
  // WHERE clause checks for no longer matches after the first UPDATE ran.
  const changesByArticle = new Map();
  for (const c of changes) {
    if (!changesByArticle.has(c.articleId)) changesByArticle.set(c.articleId, []);
    changesByArticle.get(c.articleId).push(c);
  }

  for (const [articleId, articleChanges] of changesByArticle) {
    for (const c of articleChanges) {
      const changeJson = JSON.stringify({
        to: c.newValue,
        oid: String(c.articleId),
        blog: c.issue,
        from: c.oldValue,
        user: "wp-backport",
        table: "article",
        property: c.field,
        timestamp: now
      });
      sql += `-- ${c.issue} article ${c.articleId} [${c.lang}] (category: ${c.categoryEN})\n`;
      sql += `INSERT INTO changes (data) VALUES (${dollarQuote(changeJson)}::json);\n`;
    }

    const version = articleChanges[0].version;
    let dataExpr = "data";
    for (const c of articleChanges) {
      dataExpr = `jsonb_set(${dataExpr}, '{${c.field}}', to_jsonb(${dollarQuote(c.newValue)}::text))`;
    }
    dataExpr = `jsonb_set(${dataExpr}, '{version}', to_jsonb((data->>'version')::int + 1))`;
    sql += `UPDATE article SET data = ${dataExpr} WHERE id = ${parseInt(articleId, 10)} AND (data->>'version')::int = ${parseInt(version, 10)};\n\n`;
  }

  sql += "COMMIT;\n";
  fs.writeFileSync(path.join(OUT_DIR, "backport.sql"), sql);

  // --- Documentation (CSV) ---
  const csvRows = [["issue", "articleId", "category", "lang", "oldValue", "newValue"]];
  for (const c of changes) {
    csvRows.push([c.issue, c.articleId, c.categoryEN, c.lang, c.oldValue, c.newValue]);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "documentation.csv"),
    csvRows.map((row) => row.map(csvEscape).join(",")).join("\n")
  );

  // --- Spreadsheet for LibreOffice Calc (German headers, UTF-8 BOM so
  // umlauts display correctly on open without a manual encoding prompt).
  // Includes changes + only-osmbc ("gelöscht") + only-WordPress ("neu")
  // findings - broader than backport.sql, which only ever touches the
  // both-sides-present "Typos"/"Text" cases. ---
  const spreadsheetRows = [["Blog", "Sprache", "ArtikelNummer", "ArtikelName", "Änderungsart", "Text vorher", "Text nachher"]];
  for (const f of findings) {
    spreadsheetRows.push([f.issue, f.lang, f.articleId, f.title || "", f.changeType, f.oldValue, f.newValue]);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "aenderungen.csv"),
    "﻿" + spreadsheetRows.map((row) => row.map(csvEscape).join(",")).join("\r\n")
  );

  const byType = {};
  for (const f of findings) byType[f.changeType] = (byType[f.changeType] || 0) + 1;

  console.info(`${changes.length} change(s) across ${changesByArticle.size} article(s) written to backport.sql.`);
  console.info(`${findings.length} finding(s) written to aenderungen.csv: ${JSON.stringify(byType)}`);
  console.info(`SQL script: ${path.join(OUT_DIR, "backport.sql")}`);
  console.info(`Documentation: ${path.join(OUT_DIR, "documentation.csv")}`);
  console.info(`Spreadsheet (LibreOffice Calc): ${path.join(OUT_DIR, "aenderungen.csv")}`);
  done();
}

configModule.initialise(function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  main(function () {});
});
