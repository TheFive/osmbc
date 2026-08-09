#!/usr/bin/env node
// Backfills non-German language content for old-era issues (WN001-271)
// that were rebuilt from wp_1_posts (German-only) but ALSO have real
// multi-language content sitting in wp_posts - a range that was, until
// now, invisible to every tool here (see parseShortcode.js's <!--:xx-->
// fix): 27 real issues, #219-257 (Sept 2014-June 2015), have genuine
// non-German translations (EN/TR confirmed for #221) that were never
// even compared against osmbc, let alone backported.
//
// Unlike the transitional era's positional matching (safe there because
// every language of the same osmbc issue was assembled by the same
// editorial team from the same link set), these old translations are
// real independent, often ABRIDGED editorial translations - real case
// WN221: German has 57 bullets across 15 categories, English has only 31
// bullets across 10 categories (5 categories - Konferenzen, Karten,
// Wochenaufgabe, Wochenvorschau, In eigener Sache - not translated at
// all that week). So this reuses the transitional era's link-based
// matching (matchByLinks.js) instead of position - matching by the set
// of external links a bullet/article contains, since that's independent
// of how much got translated or in what order.
//
// osmbc's own markdown<LANG> is rendered to HTML via a bare markdown-it
// instance (just for <a href> extraction - no need for the app's full
// emoji/user-linkify setup) so matchByLinks' HTML-based extractLinks
// works unchanged on both sides.
//
// Dry-run by default; --commit to actually write. --issue/--from/--to to
// scope a partial run.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/backfillLanguages.js --issue 221
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/backfillLanguages.js --from 219 --to 257 --commit

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";
import MarkdownIt from "markdown-it";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import messageCenter from "../../notification/messageCenter.js";
import { parseOldBlogSections } from "./parseOldBlogSections.js";
import { matchByLinks } from "../transitional-era/matchByLinks.js";
import { htmlToMarkdown } from "../backport/htmlToMarkdown.js";
import { htmlTableToMarkdown } from "../backport/htmlTableToMarkdown.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "backfillLanguages.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-oldimport" };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WP_POSTS_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts");
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output", "old-era-languages");
const MIN_REAL_BODY_LENGTH = 50; // shorter than this is a stub/placeholder translation, not real content (verified: WN221 es/ro/ja bodies are literally "</p>", 5 chars)

const md = new MarkdownIt();

program
  .option("--issue <n>", "single issue number, e.g. 221", (v) => parseInt(v, 10))
  .option("--from <n>", "start of issue number range", (v) => parseInt(v, 10), 219)
  .option("--to <n>", "end of issue number range", (v) => parseInt(v, 10), 267)
  .option("--commit", "actually write changes (default: dry-run)")
  .parse(process.argv);

const options = program.opts();

function convertWpHtml(html) {
  return /<tr[\s>]/i.test(html) ? htmlTableToMarkdown(html) : htmlToMarkdown(html);
}

function issueName(n) {
  return "WN" + String(n).padStart(3, "0");
}

function resolveIssueNumbers() {
  if (options.issue) return [options.issue];
  const numbers = [];
  for (let n = options.from; n <= options.to; n++) numbers.push(n);
  return numbers;
}

const pendingChanges = [];
const reviewRows = [["issue", "lang", "type", "articleId", "text"]];
let totalMatched = 0;

function processIssue(n, callback) {
  const file = path.join(WP_POSTS_DIR, n + ".json");
  if (!fs.existsSync(file)) return callback();
  const wp = JSON.parse(fs.readFileSync(file, "utf8"));
  const name = issueName(n);

  articleModule.find({ blog: name }, function (err, articles) {
    if (err) return callback(err);
    if (!articles || articles.length === 0) {
      console.info(`${name}: no osmbc articles found, skipping`);
      return callback();
    }

    const osmbcArticles = {};
    for (const a of articles) {
      if (!a.markdownDE || a.markdownDE.trim() === "" || a.markdownDE === "no translation") continue;
      osmbcArticles[a.id] = md.render(a.markdownDE);
    }

    for (const [lang, data] of Object.entries(wp.perLanguage)) {
      if (lang === "de") continue;
      const body = data.body || "";
      const stripped = body.replace(/<[^>]+>/g, "").trim();
      if (stripped.length < MIN_REAL_BODY_LENGTH) continue; // stub translation, nothing real to backport

      const { sections, warnings } = parseOldBlogSections(body);
      const bullets = sections.flatMap((s) => s.articlesHtml);
      if (bullets.length === 0) {
        console.info(`${name} [${lang}]: real body (${stripped.length} chars) but no bullets parsed - warnings: ${warnings.join("; ")}`);
        continue;
      }

      const { matches, unmatchedOsmbc, unmatchedWp, ambiguous } = matchByLinks(osmbcArticles, bullets);
      totalMatched += matches.length;
      console.info(`${name} [${lang}]: ${matches.length} matched, ${unmatchedWp.length} unmatched-wp, ${ambiguous.length} ambiguous (${bullets.length} real bullets, ${Object.keys(osmbcArticles).length} osmbc articles with DE content)`);

      for (const m of matches) {
        const langUpper = lang.toUpperCase();
        pendingChanges.push({ issue: name, articleId: m.articleId, lang: langUpper, markdown: convertWpHtml(m.wpHtml) });
      }
      for (const html of unmatchedWp) {
        reviewRows.push([name, lang.toUpperCase(), "unmatched-wp", "", md.render ? html.replace(/<[^>]+>/g, " ").trim() : html]);
      }
      for (const a of ambiguous) {
        reviewRows.push([name, lang.toUpperCase(), "ambiguous", a.articleId, a.html.replace(/<[^>]+>/g, " ").trim()]);
      }
    }
    callback();
  });
}

function applyChanges(callback) {
  const groups = new Map();
  for (const c of pendingChanges) {
    const key = `${c.issue}|${c.articleId}`;
    if (!groups.has(key)) groups.set(key, { issue: c.issue, articleId: c.articleId, fields: [] });
    groups.get(key).fields.push({ lang: c.lang, markdown: c.markdown });
  }

  async.eachSeries([...groups.values()], function ({ issue, articleId, fields }, cb) {
    articleModule.findById(parseInt(articleId, 10), function (err, article) {
      if (err) return cb(err);
      if (!article) return cb(new Error(`No article found for id ${articleId}`));
      const data = { version: article.version };
      for (const f of fields) data["markdown" + f.lang] = f.markdown;
      article.setAndSave(USER, data, function (err) {
        if (err) return cb(err);
        console.info(`${issue} article ${articleId}: ${fields.map((f) => f.lang).join(", ")} updated.`);
        cb();
      });
    });
  }, callback);
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  async.eachSeries(resolveIssueNumbers(), processIssue, function (err) {
    if (err) { console.error(err); process.exit(1); }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "pendingChanges.json"), JSON.stringify(pendingChanges, null, 2));
    fs.writeFileSync(
      path.join(OUT_DIR, "needs-review.csv"),
      "﻿" + reviewRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n")
    );

    console.info(`\n${totalMatched} field change(s) found across ${new Set(pendingChanges.map((c) => c.articleId)).size} article(s).`);
    console.info(`${reviewRows.length - 1} row(s) need manual review (needs-review.csv).`);

    if (!options.commit) {
      console.info("\nDRY RUN - pass --commit to actually write changes.");
      return process.exit(0);
    }

    applyChanges(function (err) {
      if (err) { console.error(err); process.exit(1); }
      console.info("\nDone.");
    });
  });
});
