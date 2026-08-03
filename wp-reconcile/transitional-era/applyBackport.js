#!/usr/bin/env node
// Writes scanTransitionalEra.js's pendingChanges.json into osmbc - the
// transitional-era (WN272-304) counterpart to generateBackport.js's
// backport.sql for the reliable WN305+ era. Every entry there already
// passed through the full matching pipeline (direct link match, positional
// match, or collection-link stub match) and is reflected in
// aenderungen.csv for human review - this script is the write step once
// that review is done, not a replacement for it.
//
// Groups changes by (issue, articleId): multiple language fields on the
// same article are combined into ONE setAndSave call with one version
// bump, exactly like generateBackport.js's backport.sql does - applying
// them as separate calls each independently bumping version was verified
// (during that tool's own development) to silently no-op every change
// after the first for a given article, since a stale version would no
// longer match after the first write.
//
// Writes through article.setAndSave (audited, attributed to wp-backport),
// reopening the blog first since close<LANG> blocks markdown<LANG> edits
// while true (unlike categoryEN, status alone doesn't block it, but
// close<LANG> does - model/article.js:100-134).
//
// SAFETY: only runs with NODE_ENV=wpreconcile. Dry-run by default; --commit
// to actually write. --issue/--from/--to restrict which issues to apply,
// for reviewing a sample before a full run.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/applyBackport.js --issue WN275
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/applyBackport.js --from 272 --to 304 --commit

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

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "applyBackport.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-backport" };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output", "transitional-era");

program
  .option("--issue <name>", "single issue name, e.g. WN275")
  .option("--from <n>", "start of issue number range", (v) => parseInt(v, 10))
  .option("--to <n>", "end of issue number range", (v) => parseInt(v, 10))
  .option("--commit", "actually write changes (default: dry-run)")
  .parse(process.argv);

const options = program.opts();

const allChanges = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "pendingChanges.json"), "utf8"));

function issueNumber(issue) {
  return parseInt(issue.replace(/^WN/i, ""), 10);
}

const changes = allChanges.filter((c) => {
  if (options.issue) return c.issue.toUpperCase() === options.issue.toUpperCase();
  const n = issueNumber(c.issue);
  if (options.from && n < options.from) return false;
  if (options.to && n > options.to) return false;
  return true;
});

if (changes.length === 0) {
  console.info("No pending changes match the given filter.");
  process.exit(0);
}

// Group by (issue, articleId) so all language fields for the same article
// go into one setAndSave call.
const groups = new Map(); // "issue|articleId" -> [{lang, markdown}]
for (const c of changes) {
  const key = `${c.issue}|${c.articleId}`;
  if (!groups.has(key)) groups.set(key, { issue: c.issue, articleId: c.articleId, fields: [] });
  groups.get(key).fields.push({ lang: c.lang, markdown: c.markdown });
}

console.info(`${changes.length} field change(s) across ${groups.size} article(s)${options.commit ? "" : " (DRY RUN - pass --commit to actually write)"}.`);

if (!options.commit) {
  for (const { issue, articleId, fields } of groups.values()) {
    console.info(`${issue} article ${articleId}: ${fields.map((f) => f.lang).join(", ")}`);
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

function applyOne({ issue, articleId, fields }, callback) {
  articleModule.findById(parseInt(articleId, 10), function (err, article) {
    if (err) return callback(err);
    if (!article) return callback(new Error(`No article found for id ${articleId}`));

    withReopenedBlog(issue, function (done) {
      article._blog = null; // force a fresh reload reflecting the reopened blog state
      const data = { version: article.version };
      for (const f of fields) data["markdown" + f.lang] = f.markdown;
      article.setAndSave(USER, data, done);
    }, function (err) {
      if (err) return callback(err);
      console.info(`${issue} article ${articleId}: ${fields.map((f) => f.lang).join(", ")} updated.`);
      callback();
    });
  });
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  async.eachSeries([...groups.values()], applyOne, function (err) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.info("\nDone.");
  });
});
