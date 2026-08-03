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
import { textSimilarity } from "./textSimilarity.js";
import { matchByReferenceLanguage } from "./positionalMatch.js";
import { parseOldBlogSections } from "../old-era/parseOldBlogSections.js";

// A last-resort fallback for whatever neither link-matching nor the
// collection-link fallback found anything for: two bullets can be the same
// real story with no shared link at all. Deliberately not auto-matched
// (text similarity is fuzzy, unlike a shared link) - only ever surfaced as
// a candidate for the project owner's own review.
const SIMILARITY_THRESHOLD = 0.5;

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
// Every article id that confidently matched in ANY language, INCLUDING a
// clean match with no text difference at all - aenderungen.csv only records
// genuine changes, so a clean match never appears there at all. Consumers
// that need "did this article match somewhere" (e.g.
// applyDefaultResolutions.js deciding whether an unmatched-in-one-language
// article is safe to unpublish) must use this, not aenderungen.csv, or they
// will incorrectly treat a perfectly-matched-elsewhere article as never
// matched at all (confirmed real case: WN280 article 10438 matched cleanly
// in DE - identical text, so no aenderungen.csv row - but was unmatched in
// EN, since it was genuinely never published in English).
const matchedArticleIds = new Set();

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

  // Pass 1: run the normal link-based matching for every closed language
  // and cache the results - needed for the main output below, and also as
  // potential positional-matching reference material (see
  // positionalMatch.js) for any OTHER language in this same issue that
  // turns out to be a total stub (no real per-article content anywhere).
  const perLang = {};
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
      osmbcArticlesForMatching[id] = addCollectionFallbackLink(html, articleMeta && articleMeta.collection, linkCounts);
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
    perLang[osmbcLang] = { osmbcArticles, stubArticleIds, wpSections: sections, wpBullets, matches, unmatchedOsmbc, unmatchedWp, ambiguous };
  }

  // Candidate reference languages for positional matching, EN first
  // (per the project owner: EN is the language every other translation is
  // actually derived from - DE only "led" in the very first issues, back
  // when the team was still German-only), then the rest by most confident
  // real matches. Only used for OTHER languages that turn out to be a
  // total stub below - a language with its own real matches never needs
  // this. Tries candidates in order rather than only the single best one:
  // the best-matching language isn't necessarily structurally comparable
  // to the stub language (real case: WN276 - DE has the most matches (49)
  // but also more overall content than JP (51 WP bullets vs JP's 43), so
  // DE's category counts don't line up with JP's at all; EN (42 matches,
  // 43 WP bullets) does line up exactly).
  const referenceCandidates = Object.keys(perLang).sort((a, b) => {
    if (a === "EN") return -1;
    if (b === "EN") return 1;
    return perLang[b].matches.length - perLang[a].matches.length;
  });

  // Pass 2: emit findings per language.
  for (const [osmbcLang, data] of Object.entries(perLang)) {
    const { osmbcArticles, stubArticleIds, wpSections, wpBullets, matches, unmatchedOsmbc, ambiguous } = data;

    let changed = 0;
    for (const m of matches) {
      matchedArticleIds.add(m.articleId);
      const a = normalizeHtml(osmbcArticles[m.articleId]);
      const b = normalizeHtml(m.wpHtml);
      if (a.replace(/\s+/g, "") === b.replace(/\s+/g, "")) continue;
      changed++;
      totalChanged++;
      const articleMeta = articleById.get(m.articleId);
      aenderungenRows.push([issue, osmbcLang, m.articleId, (articleMeta && articleMeta.title) || "", classifyChange(a, b), a, b]);
    }

    // Positional matching only ever fills in stubArticleIds (articles with
    // no real translation in THIS language) below, so it can't conflict
    // with this language's own real link-based matches above regardless of
    // how many of those exist - gating on "zero real content anywhere in
    // this language" was too strict (real case: WN276 JP - filling in just
    // one stub article, 46780 "Releases", with its real JP text made
    // osmbcArticles.length go from 0 to 1, which turned positional matching
    // off for every OTHER still-stub JP article in the same issue as a
    // side effect).
    let positionalMap = new Map();
    for (const candidateLang of referenceCandidates) {
      if (candidateLang === osmbcLang) continue;
      const ref = perLang[candidateLang];
      const attempt = matchByReferenceLanguage(ref.wpSections, ref.matches, wpSections);
      if (attempt) {
        positionalMap = attempt;
        break;
      }
    }

    // Stub matching runs AFTER the normal matcher, against only what's left
    // in unmatchedWp - a real, already-written article must always get
    // first claim on a bullet over a never-written stub. Running this
    // first (an earlier version of this script did) let an already-
    // unpublished duplicate stub (WN276 article 10162, collection link
    // shared with the real, already-matching article 10136) steal the
    // bullet the real article needed, before it ever got a chance to match.
    // Positional matching (built from the reference language's OWN real
    // matches) takes priority over collection-link stub matching when both
    // could apply to the same article - it's the more specific signal.
    let remainingWp = data.unmatchedWp;
    for (const id of stubArticleIds) {
      const articleMeta = articleById.get(id);

      if (positionalMap.has(id)) {
        matchedArticleIds.add(id);
        const wpHtml = positionalMap.get(id);
        const b = normalizeHtml(wpHtml);
        totalChanged++;
        aenderungenRows.push([issue, osmbcLang, id, (articleMeta && articleMeta.title) || "", "Text", "", b]);
        remainingWp = remainingWp.filter((html) => html !== wpHtml);
        continue;
      }

      const collection = articleMeta && articleMeta.collection;
      if (!collection) continue;
      const stubResult = findStubMatch(collection, remainingWp, linkCounts);
      if (!stubResult) continue; // unique link, but genuinely not published here (or already claimed above) - correctly stays invisible
      if (stubResult.ambiguous) {
        reviewRows.push([issue, osmbcLang, "stub-ambiguous-collection", id, collection.trim()]);
        totalAmbiguous++;
        continue;
      }
      matchedArticleIds.add(id);
      const b = normalizeHtml(stubResult.wpHtml);
      totalChanged++;
      aenderungenRows.push([issue, osmbcLang, id, (articleMeta && articleMeta.title) || "", "Text", "", b]);
      remainingWp = remainingWp.filter((html) => html !== stubResult.wpHtml);
    }

    // Last resort: for whatever is still unmatched on both sides, check for
    // high text similarity even with no shared link at all - greedily pairs
    // each unmatched osmbc article with its best-scoring available WP
    // bullet (if any clears SIMILARITY_THRESHOLD), removing that bullet
    // from the pool so it isn't also claimed by another article. A result
    // that's textually IDENTICAL (after whitespace normalization) has zero
    // ambiguity left - e.g. confirmed real cases WN276 articles 10147/10165
    // in ES/ID, both 100% identical, just missing a link in those specific
    // languages - so it's treated as a clean match, same as an identical
    // link-based match, not surfaced as a "candidate" needing a human to
    // confirm the obvious.
    const claimedWp = new Set();
    const similarityCandidates = [];
    for (const u of unmatchedOsmbc) {
      const osmbcText = normalizeHtml(osmbcArticles[u.articleId]);
      let best = null;
      for (const html of remainingWp) {
        if (claimedWp.has(html)) continue;
        const score = textSimilarity(osmbcText, normalizeHtml(html));
        if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) best = { html, score };
      }
      if (best) {
        claimedWp.add(best.html);
        const wpText = normalizeHtml(best.html);
        if (osmbcText.replace(/\s+/g, "") === wpText.replace(/\s+/g, "")) {
          matchedArticleIds.add(u.articleId);
          continue;
        }
        similarityCandidates.push({ articleId: u.articleId, osmbcText, wpText, score: best.score });
      }
    }

    for (const c of similarityCandidates) {
      reviewRows.push([issue, osmbcLang, "similar-text-candidate", c.articleId, `(${Math.round(c.score * 100)}%) OSMBC: ${c.osmbcText} || WP: ${c.wpText}`]);
      totalAmbiguous++;
    }
    for (const u of unmatchedOsmbc) {
      if (similarityCandidates.some((c) => c.articleId === u.articleId)) continue;
      if (matchedArticleIds.has(u.articleId)) continue; // resolved via an identical (clean) text-similarity match above
      reviewRows.push([issue, osmbcLang, "unmatched-osmbc", u.articleId, normalizeHtml(osmbcArticles[u.articleId])]);
      totalUnmatched++;
    }
    for (const html of remainingWp) {
      if (claimedWp.has(html)) continue;
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
fs.writeFileSync(path.join(OUT_DIR, "matchedArticleIds.json"), JSON.stringify([...matchedArticleIds], null, 2));

console.info(`Issues ${FIRST_ISSUE}-${LAST_ISSUE}: ${aenderungenRows.length - 1} genuine change(s) found via link-matching, ${totalUnmatched} item(s) need manual review, ${totalAmbiguous} ambiguous match(es).`);
console.info(`Summary: ${path.join(OUT_DIR, "summary.csv")}`);
console.info(`Spreadsheet (LibreOffice Calc): ${path.join(OUT_DIR, "aenderungen.csv")}`);
console.info(`Needs review: ${path.join(OUT_DIR, "needs-review.csv")}`);
