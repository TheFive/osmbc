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
import { addCollectionFallbackLink } from "./collectionFallback.js";
import { findStubMatch } from "./stubCollectionMatch.js";
import { parseOldBlogSections } from "../old-era/parseOldBlogSections.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OSMBC_DIR = path.join(__dirname, "..", "..", "backport", "input", "osmbc");
const WP_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts");
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output", "transitional-era");
const linkCounts = JSON.parse(fs.readFileSync(path.join(OSMBC_DIR, "collectionLinkCounts.json"), "utf8"));

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
// Same columns/format as wp-reconcile/backport/generateBackport.js's
// aenderungen.csv - but only confirmed link-matched Typos/Text changes go
// here. Unmatched/ambiguous cases are NOT "gelöscht"/"neu": unlike the
// WN272+ tool's exact anchor match, a link-matcher "no match" can just mean
// the matcher failed (e.g. an article with no links at all), not a
// confirmed absence - those stay in needs-review.csv for a human to judge
// (per explicit user decision, asked rather than assumed).
const aenderungenRows = [["Blog", "Sprache", "ArtikelNummer", "ArtikelName", "Änderungsart", "Text vorher", "Text nachher"]];
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

    // Osmbc's export usually still emits an anchor per article even when
    // there is no real translation for this language (verified early on via
    // CZ/SW: a placeholder/title-only render) - excluding those here avoids
    // polluting the link-matcher with content that has no links to match on
    // in the first place. But a fully-unwritten stub (rawMarkdown is empty
    // or the literal "no translation"/"german only" marker in EVERY
    // language - confirmed real cases WN275 articles 10097/10120) gets NO
    // anchor at all, so it never appears in osmbcArticlesRaw - stub
    // candidates have to be sourced from the full per-issue article list
    // instead (osmbc.articles), not from what actually got rendered.
    const osmbcArticlesRaw = extractOsmbcArticles(osmbcBody, n);
    const osmbcArticles = {}; // original html - used for diffing/display
    const osmbcArticlesForMatching = {}; // may have a collection-link fallback appended - used for matching only
    for (const [id, html] of Object.entries(osmbcArticlesRaw)) {
      if (!hasRealTranslation(id, osmbcLang)) continue;
      osmbcArticles[id] = html;
      const articleMeta = articleById.get(id);
      osmbcArticlesForMatching[id] = addCollectionFallbackLink(html, articleMeta && articleMeta.collection);
    }
    // Stub candidates: no real written text in ANY language, AND not
    // already deliberately excluded from output (categoryEN
    // "--unpublished--" already means "this isn't part of the output" -
    // resurrecting it via a coincidental link match doesn't make sense).
    const stubArticleIds = osmbc.articles
      .map((a) => a.id)
      .filter((id) => {
        const meta = articleById.get(id);
        return !hasRealTranslation(id, osmbcLang) && !(id in osmbcArticles) &&
          (!meta || meta.categoryEN !== "--unpublished--");
      });
    if (Object.keys(osmbcArticles).length === 0 && stubArticleIds.length === 0) continue;
    const { sections } = parseOldBlogSections(wpLangData.body);
    const wpBullets = sections.flatMap((s) => s.articlesHtml);
    if (wpBullets.length === 0) continue;

    const { matches, unmatchedOsmbc, unmatchedWp, ambiguous } = matchByLinks(osmbcArticlesForMatching, wpBullets);

    let changed = 0;
    for (const m of matches) {
      const a = normalizeHtml(osmbcArticles[m.articleId]);
      const b = normalizeHtml(m.wpHtml);
      if (a.replace(/\s+/g, "") === b.replace(/\s+/g, "")) continue;
      changed++;
      totalChanged++;
      const articleMeta = articleById.get(m.articleId);
      aenderungenRows.push([issue, osmbcLang, m.articleId, (articleMeta && articleMeta.title) || "", classifyChange(a, b), a, b]);
    }

    // Stub matching runs AFTER the normal matcher, against only what's left
    // in unmatchedWp - a real, already-written article must always get
    // first claim on a bullet over a never-written stub. Running this
    // first (an earlier version of this script did) let an already-
    // unpublished duplicate stub (WN276 article 10162, collection link
    // shared with the real, already-matching article 10136) steal the
    // bullet the real article needed, before it ever got a chance to match.
    let remainingWp = unmatchedWp;
    for (const id of stubArticleIds) {
      const articleMeta = articleById.get(id);
      const collection = articleMeta && articleMeta.collection;
      if (!collection) continue;
      const stubResult = findStubMatch(collection, remainingWp, linkCounts);
      if (!stubResult) continue; // unique link, but genuinely not published here (or already claimed above) - correctly stays invisible
      if (stubResult.ambiguous) {
        reviewRows.push([issue, osmbcLang, "stub-ambiguous-collection", id, collection.trim()]);
        totalAmbiguous++;
        continue;
      }
      const b = normalizeHtml(stubResult.wpHtml);
      totalChanged++;
      aenderungenRows.push([issue, osmbcLang, id, (articleMeta && articleMeta.title) || "", "Text", "", b]);
      remainingWp = remainingWp.filter((html) => html !== stubResult.wpHtml);
    }

    for (const u of unmatchedOsmbc) {
      reviewRows.push([issue, osmbcLang, "unmatched-osmbc", u.articleId, normalizeHtml(osmbcArticles[u.articleId])]);
      totalUnmatched++;
    }
    for (const html of remainingWp) {
      reviewRows.push([issue, osmbcLang, "unmatched-wp", "", normalizeHtml(html)]);
      totalUnmatched++;
    }
    for (const a of ambiguous) {
      reviewRows.push([issue, osmbcLang, "ambiguous", a.articleId, normalizeHtml(osmbcArticles[a.articleId])]);
      totalAmbiguous++;
    }

    summaryRows.push([issue, osmbcLang, Object.keys(osmbcArticles).length, wpBullets.length, matches.length, changed, unmatchedOsmbc.length, remainingWp.length, ambiguous.length]);
  }
}

fs.writeFileSync(path.join(OUT_DIR, "summary.csv"), summaryRows.map((r) => r.map(csvEscape).join(",")).join("\n"));
// UTF-8 BOM + CRLF, same convention as generateBackport.js's aenderungen.csv,
// so it opens correctly in LibreOffice Calc without an encoding prompt.
fs.writeFileSync(
  path.join(OUT_DIR, "aenderungen.csv"),
  "﻿" + aenderungenRows.map((r) => r.map(csvEscape).join(",")).join("\r\n")
);
fs.writeFileSync(path.join(OUT_DIR, "needs-review.csv"), reviewRows.map((r) => r.map(csvEscape).join(",")).join("\n"));

console.info(`Issues ${FIRST_ISSUE}-${LAST_ISSUE}: ${aenderungenRows.length - 1} genuine change(s) found via link-matching, ${totalUnmatched} item(s) need manual review, ${totalAmbiguous} ambiguous match(es).`);
console.info(`Summary: ${path.join(OUT_DIR, "summary.csv")}`);
console.info(`Spreadsheet (LibreOffice Calc): ${path.join(OUT_DIR, "aenderungen.csv")}`);
console.info(`Needs review: ${path.join(OUT_DIR, "needs-review.csv")}`);
