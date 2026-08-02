#!/usr/bin/env node
// Batch-applies the default policy the project owner set for whatever is
// still left in needs-review.csv after all matching (link/collection/stub/
// similarity): the goal is a Hugo export that reads close to the real
// published WordPress, not a perfectly-structured osmbc internal model -
// so rather than reviewing hundreds of items one at a time, apply the
// obvious default and only keep genuinely ambiguous cases for review:
//
//   - "unmatched-osmbc": this article's content never made it into the
//     published post -> set --unpublished-- (matches unpublishArticle.js's
//     one-off precedent, e.g. WN275 article 10075). Only when the article
//     has NO matched/changed entry in aenderungen.csv for ANY other
//     language either - unpublish is whole-article, all-languages, so a
//     real match in one language must block it even if another language
//     of the same article is unmatched.
//   - "unmatched-wp": real WordPress-only content -> create a new article
//     (matches createArticleFromWp.js's one-off precedent, e.g. WN276
//     article 46774). Only when the exact bullet can be found unambiguously
//     in the source (exactly one bullet with this normalized text) and its
//     WP heading maps to a real category in blog.categories - anything
//     else is left as a review item rather than guessed.
//   - "stub-ambiguous-collection", "ambiguous", "similar-text-candidate":
//     left untouched - these are exactly the cases that need a human,
//     not a default.
//
// Writes through article.setAndSave (audited, attributed to wp-backport),
// with the same blog-reopen dance the one-off scripts use.
//
// SAFETY: only runs with NODE_ENV=wpreconcile. Dry-run by default; --commit
// to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/applyDefaultResolutions.js --commit

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import language from "../../model/language.js";
import messageCenter from "../../notification/messageCenter.js";
import { normalizeHtml } from "../diff-engine/normalizeHtml.js";
import { parseOldBlogSections } from "../old-era/parseOldBlogSections.js";
import { htmlToMarkdown } from "../backport/htmlToMarkdown.js";
import { textSimilarity } from "./textSimilarity.js";
import { extractLinks } from "./matchByLinks.js";

// Below the main scan's SIMILARITY_THRESHOLD (0.5, confident-enough to
// surface as a review candidate) but still too close to risk creating a
// duplicate article - real case: WN300 article 11785 "Exuse" almost
// exactly matches a WN300 ES "unmatched-wp" bullet (a genuine wording
// correction, not a coincidence) - auto-creating a new article for that
// bullet would have duplicated 11785 instead of just needing its text
// corrected.
const DUPLICATE_CHECK_THRESHOLD = 0.3;

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "applyDefaultResolutions.js must run with NODE_ENV=wpreconcile."
);

const WP_LANG = {
  DE: "de", EN: "en", ES: "es", PT: "pt", TR: "tr", RU: "ru",
  JP: "ja", FR: "fr", ID: "id", NL: "nl", IT: "it", KO: "ko", SW: "sw",
  BR: "br", ZH: "zh", PL: "pl", UK: "uk", CN: "cn"
};

const USER = { OSMUser: "wp-backport" };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OSMBC_DIR = path.join(__dirname, "..", "..", "backport", "input", "osmbc");
const WP_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts");
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output", "transitional-era");

program
  .option("--commit", "actually write changes (default: dry-run)")
  .option("--verbose", "show every candidate in dry-run output, not just a sample")
  .parse(process.argv);
const options = program.opts();

function parseCsv(text) {
  // Minimal CSV parser sufficient for our own csvEscape() output (quotes
  // doubled, fields quoted only when they contain a comma/quote/newline).
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const reviewRows = parseCsv(fs.readFileSync(path.join(OUT_DIR, "needs-review.csv"), "utf8")).slice(1);
// Every article id confidently matched in ANY language, INCLUDING a clean
// match with no text difference - aenderungen.csv alone is NOT enough here,
// since it only records genuine changes and silently omits clean matches
// (confirmed real case: WN280 article 10438 matched cleanly in DE, so has
// no aenderungen.csv row at all, but was genuinely unmatched in EN - using
// aenderungen.csv alone would have wrongly unpublished it, destroying its
// real, correctly-matched DE content too).
const matchedArticleIds = new Set(JSON.parse(fs.readFileSync(path.join(OUT_DIR, "matchedArticleIds.json"), "utf8")));

const unmatchedOsmbcByArticle = new Map(); // articleId -> [{issue, lang}]
for (const row of reviewRows) {
  if (row.length < 5) continue;
  const [issue, lang, type, articleId] = row;
  if (type === "unmatched-osmbc") {
    if (!unmatchedOsmbcByArticle.has(articleId)) unmatchedOsmbcByArticle.set(articleId, []);
    unmatchedOsmbcByArticle.get(articleId).push({ issue, lang });
  }
}

// Manually verified false positives that no automated check here catches:
// the article's content genuinely exists in the real WP post, but with
// zero links on both sides AND a text-similarity score just under
// SIMILARITY_THRESHOLD (real case: WN300 article 11785 "Exuse" - a genuine
// wording correction, "sobre el terreno" -> "sobre el terremoto en
// Ecuador", not just a typo). Add ids here as they're found rather than
// lowering the shared threshold globally.
const KNOWN_FALSE_POSITIVES = new Set(["11785"]);

const toUnpublish = [...unmatchedOsmbcByArticle.keys()].filter((id) => !matchedArticleIds.has(id) && !KNOWN_FALSE_POSITIVES.has(id));
const skippedUnpublish = [...unmatchedOsmbcByArticle.keys()].filter((id) => matchedArticleIds.has(id) || KNOWN_FALSE_POSITIVES.has(id));

console.info(`${toUnpublish.length} article(s) to unpublish (unmatched in every language it appears in, no match anywhere else).`);
if (skippedUnpublish.length) {
  console.info(`${skippedUnpublish.length} article(s) skipped - unmatched in one language but matched in another: ${skippedUnpublish.join(", ")}`);
}

function findWpBullet(issue, lang) {
  const n = issue.replace(/^WN/i, "");
  const wpFile = path.join(WP_DIR, n + ".json");
  if (!fs.existsSync(wpFile)) return { skip: "no WP source file" };
  const wp = JSON.parse(fs.readFileSync(wpFile, "utf8"));
  const wpLang = WP_LANG[lang];
  const body = wp.perLanguage[wpLang] && wp.perLanguage[wpLang].body;
  if (!body) return { skip: "no WP body" };

  const { sections } = parseOldBlogSections(body);
  const osmbcFile = path.join(OSMBC_DIR, issue + ".json");
  const osmbc = JSON.parse(fs.readFileSync(osmbcFile, "utf8"));
  const blogCategories = osmbc.categories || [];
  const articles = osmbc.articles || [];

  const matches = [];
  for (const section of sections) {
    for (const html of section.articlesHtml) {
      matches.push({ heading: section.headingText, html });
    }
  }
  return { matches, blogCategories, articles };
}

function stripMarkdownLinks(md) {
  return (md || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

// Is this WP bullet suspiciously similar to an EXISTING osmbc article's own
// text (any article in the issue, not just the ones flagged unmatched) -
// if so, it likely needs that article's text corrected, not a brand-new
// duplicate article.
function findNearDuplicate(text, lang, articles) {
  let best = null;
  for (const a of articles) {
    const raw = a.rawMarkdown && a.rawMarkdown[lang];
    if (!raw || raw.trim() === "" || raw === "no translation") continue;
    const score = textSimilarity(text, stripMarkdownLinks(raw));
    if (score >= DUPLICATE_CHECK_THRESHOLD && (!best || score > best.score)) best = { id: a.id, score };
  }
  return best;
}

function categoryEnFor(heading, wpLang, blogCategories) {
  const needle = heading.trim().toLowerCase();
  const entry = blogCategories.find((c) => (c[wpLang.toUpperCase()] || "").trim().toLowerCase() === needle);
  return entry && entry.EN;
}

const toCreate = [];
const skippedCreate = [];

// Re-derive each unmatched-wp row's real bullet by exact normalized-text
// match (needs-review.csv only stores the flattened text) - build once per
// (issue, lang) pair, not per row, since many rows share the same source.
const byIssueLang = new Map();
for (const row of reviewRows) {
  if (row[2] !== "unmatched-wp") continue;
  const key = row[0] + "|" + row[1];
  if (!byIssueLang.has(key)) byIssueLang.set(key, []);
  byIssueLang.get(key).push(row[4]);
}

for (const [key, texts] of byIssueLang) {
  const [issue, lang] = key.split("|");
  const found = findWpBullet(issue, lang);
  if (found.skip) {
    for (const text of texts) skippedCreate.push({ issue, lang, text, reason: found.skip });
    continue;
  }
  for (const text of texts) {
    const candidates = found.matches.filter((m) => normalizeHtml(m.html) === text);
    if (candidates.length !== 1) {
      skippedCreate.push({ issue, lang, text, reason: candidates.length === 0 ? "bullet not found (source may have changed)" : `${candidates.length} bullets share this exact text - ambiguous` });
      continue;
    }
    const { heading, html } = candidates[0];

    // A bare category-label bullet (e.g. "Releases" wrapped in its own
    // <li>, then a separate sibling <table> - see parseOldBlogSections.js's
    // whole-table handling) is not real content on its own - auto-creating
    // an article for just the word "Releases" would be useless noise. Same
    // for a bullet that's just a label ending in ":" with nothing after it
    // (real case: WN286 TR "Yeni sürüm ve güncellemeler:" - "New version
    // and updates:").
    if (text.trim().split(/\s+/).length < 4 || /:\s*$/.test(text.trim())) {
      skippedCreate.push({ issue, lang, text, reason: "too short to be real content (likely a bare category label, not an article)" });
      continue;
    }
    // Several bullets are cut off mid-word with a literal "..." - a real
    // WordPress-side truncation/placeholder artifact, not intentional
    // ellipsis (confirmed real cases: WN280 ES "...Smartw...", WN281 RU
    // "Anonymaps: What's next for @Ma..." - the latter isn't even a Russian
    // translation at all, just the English title leaking through
    // untranslated and truncated). Not real, usable content either way.
    if (/\S\.\.\.$/.test(text.trim())) {
      skippedCreate.push({ issue, lang, text, reason: "cut off mid-word with \"...\" - a WordPress-side truncation artifact, not real content" });
      continue;
    }
    // A short bullet with no link at all and no sentence structure is
    // usually the same untranslated-title-leaked-through problem without
    // the tell-tale "..." (real case: WN281 RU "GPX Own Cloud Apps" - its
    // own anchor id, wn281_gpx_own_cloud_apps, is literally the English
    // title as a slug - a batch translation gap, not real Russian content).
    if (extractLinks(html).size === 0 && text.trim().split(/\s+/).length <= 6) {
      skippedCreate.push({ issue, lang, text, reason: "short, no link, no sentence structure - likely an untranslated title fragment, not real content" });
      continue;
    }
    // A whole combined table (e.g. a "Releases" table covering several
    // pieces of software) usually duplicates content that already has its
    // own individual osmbc article per row (real case: WN276 - Route
    // Converter/JOSM/BRouter/SQLite/Atlas each already exist separately) -
    // auto-creating ONE new article for the whole table would duplicate
    // that content rather than fill a real gap. Needs a human to check
    // whether each row already has its own article or not.
    if (/<table|<tr>|<td>/i.test(html)) {
      skippedCreate.push({ issue, lang, text, reason: "a whole combined table - check whether individual articles already exist per row before creating anything" });
      continue;
    }

    const categoryEN = categoryEnFor(heading, WP_LANG[lang], found.blogCategories);
    if (!categoryEN) {
      skippedCreate.push({ issue, lang, text, reason: `WP heading "${heading}" doesn't match any known category` });
      continue;
    }

    const dup = findNearDuplicate(text, lang, found.articles);
    if (dup) {
      skippedCreate.push({ issue, lang, text, reason: `possible near-duplicate of existing article ${dup.id} (${Math.round(dup.score * 100)}% similar) - needs its text corrected, not a new article` });
      continue;
    }

    toCreate.push({ issue, lang, heading, categoryEN, markdown: htmlToMarkdown(html), text });
  }
}

console.info(`${toCreate.length} new article(s) to create.`);
if (skippedCreate.length) {
  console.info(`${skippedCreate.length} unmatched-wp item(s) skipped (left for manual review):`);
  const byReason = new Map();
  for (const s of skippedCreate) byReason.set(s.reason, (byReason.get(s.reason) || 0) + 1);
  for (const [reason, count] of byReason) console.info(`  ${count}x ${reason}`);
}

if (!options.commit) {
  console.info("\nDRY RUN - pass --commit to actually write changes.");
  const n = options.verbose ? toUnpublish.length : 5;
  console.info(`\n${options.verbose ? "" : "Sample "}unpublish targets:`, toUnpublish.slice(0, n));
  console.info(`\n${options.verbose ? "" : "Sample "}create targets:`);
  for (const c of toCreate.slice(0, options.verbose ? toCreate.length : 5)) {
    console.info(`  ${c.issue} [${c.lang}] "${c.heading}" -> ${c.categoryEN}: ${options.verbose ? c.markdown : c.markdown.slice(0, 80) + "..."}`);
  }
  process.exit(0);
}

function withReopenedBlog(blogName, action, callback) {
  blogModule.findOne({ name: blogName }, function (err, blog) {
    if (err) return callback(err);
    if (!blog) return callback(new Error(`No blog found for ${blogName}`));

    const langlist = language.getLanguages();
    const original = { status: blog.status };
    const openData = { status: "edit" };
    for (const l in langlist) {
      original["close" + l] = blog["close" + l];
      original["exported" + l] = blog["exported" + l];
      openData["close" + l] = false;
      openData["exported" + l] = false;
    }

    blog.setAndSave(USER, openData, function (err) {
      if (err) return callback(err);
      action(function (actionErr) {
        blog.setAndSave(USER, original, function (restoreErr) {
          if (actionErr) return callback(actionErr);
          if (restoreErr) return callback(restoreErr);
          callback();
        });
      });
    });
  });
}

function unpublishOne(id, callback) {
  articleModule.findById(parseInt(id, 10), function (err, article) {
    if (err) return callback(err);
    if (!article) return callback(new Error(`No article found for id ${id}`));
    if (article.categoryEN === "--unpublished--") return callback();

    withReopenedBlog(article.blog, function (done) {
      article._blog = null;
      article.setAndSave(
        USER,
        { categoryEN: "--unpublished--", unpublishReason: "Never made it into the published WordPress post - confirmed via transitional-era reconciliation, unmatched in every language it appears in", version: article.version },
        done
      );
    }, function (err) {
      if (err) return callback(err);
      console.info(`Article ${id}: unpublished.`);
      callback();
    });
  });
}

function createOne(c, callback) {
  const field = "markdown" + c.lang.toUpperCase();
  articleModule.createNewArticle({}, function (err, article) {
    if (err) return callback(err);
    article.setAndSave(USER, { blog: c.issue, categoryEN: c.categoryEN, [field]: c.markdown, version: article.version }, function (err) {
      if (err) return callback(err);
      console.info(`${c.issue}: created article ${article.id} [${c.lang}] "${c.heading}".`);
      callback();
    });
  });
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  async.series(
    [
      (cb) => async.eachSeries(toUnpublish, unpublishOne, cb),
      (cb) => async.eachSeries(toCreate, createOne, cb)
    ],
    function (err) {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.info("\nDone.");
    }
  );
});
