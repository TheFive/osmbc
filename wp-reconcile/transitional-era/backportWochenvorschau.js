#!/usr/bin/env node
// Backports the real "Wochenvorschau" calendar table into osmbc for every
// issue that has one, over a range (default WN272-281 - the only issues
// where blog.categories even contains a "Wochenvorschau"/"Not Translated"
// entry; the mechanism was replaced by something else from WN282 onward).
//
// Generalizes the one-off backportWochenvorschau275.js: WN275 was handled
// directly first since it looked like a single case, but checking the
// whole range turned up 9 affected issues, not 1 - most either have no
// article at all for this category, or an empty/placeholder one.
//
// Per issue:
//   - No "Wochenvorschau" heading in the real WP post at all -> nothing was
//     published this week, skip (confirmed real case: WN280 - its existing
//     "Not Translated"-category article is an unrelated real story, not a
//     leftover calendar stub, and must not be touched).
//   - No osmbc article exists for this category -> create one.
//   - An osmbc article exists but is empty/placeholder ("no translation" or
//     very short) -> fill it in.
//   - An osmbc article exists with substantial content -> do NOT overwrite;
//     flag for manual review (it might be real, unrelated content that
//     happens to share this category, as WN280 turned out to be).
//
// Writes through article.setAndSave (audited, attributed to wp-backport),
// reopening the blog first exactly like unpublishArticle.js/
// backportWochenvorschau275.js do, since close<LANG> blocks markdownDE
// edits while true.
//
// SAFETY: only runs with NODE_ENV=wpreconcile. Dry-run by default; --commit
// to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/backportWochenvorschau.js --from 272 --to 281 --commit

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
import { load } from "cheerio";
import { parseOldBlogSections } from "../old-era/parseOldBlogSections.js";
import { htmlTableToMarkdown } from "../backport/htmlTableToMarkdown.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "backportWochenvorschau.js must run with NODE_ENV=wpreconcile."
);

const CATEGORY_EN = "Not Translated"; // blog.categories entry: {DE: "Wochenvorschau", EN: "Not Translated"} - confirmed on WN272-281
const EMPTY_THRESHOLD = 50; // existing markdownDE shorter than this (or "no translation") is treated as a placeholder, safe to overwrite
const USER = { OSMUser: "wp-backport" };

program
  .option("--issue <n>", "single issue number", (v) => parseInt(v, 10))
  .option("--from <n>", "start of issue range", (v) => parseInt(v, 10), 272)
  .option("--to <n>", "end of issue range", (v) => parseInt(v, 10), 281)
  .option("--commit", "actually write changes (default: dry-run)")
  .parse(process.argv);

const options = program.opts();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The bare intro sentence ("Termine vom X bis Y") between the heading and
// the <table> is a plain text node, not part of any element
// parseOldBlogSections captures - and a regex on the raw heading tag is too
// fragile across this era's several real <h2> markup variants (plain
// <h2>Wochenvorschau</h2>, <h2 id="wochenvorschau">...</h2>, and <h2><a
// id="..."></a>Wochenvorschau</h2> - confirmed real cases WN273/274/279).
// Cheerio's own DOM walk (same approach as parseOldBlogSections.js) sidesteps
// all of that: find the heading by its actual text content, then collect
// sibling text nodes up to the <table>.
function extractIntro(body) {
  const $ = load(body, null, false);
  let intro = "";
  let found = false;
  $.root().contents().each((_, node) => {
    if (found === "done") return;
    if (node.type === "tag" && (node.tagName || node.name) === "h2" && $(node).text().trim().toLowerCase() === "wochenvorschau") {
      found = true;
      return;
    }
    if (!found) return;
    if (node.type === "tag" && (node.tagName || node.name) === "table") {
      found = "done";
      return;
    }
    if (node.type === "text") intro += node.data;
  });
  const text = intro.trim();
  return text ? text + "\r\n\r\n" : "";
}

function buildMarkdown(n) {
  const file = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts", n + ".json");
  if (!fs.existsSync(file)) return { skip: `no WP source file for WN${n}` };
  const wp = JSON.parse(fs.readFileSync(file, "utf8"));
  const body = wp.perLanguage.de && wp.perLanguage.de.body;
  if (!body) return { skip: "no German WP body" };

  const { sections } = parseOldBlogSections(body);
  const section = sections.find((s) => s.headingText.toLowerCase() === "wochenvorschau");
  if (!section) return { skip: "no Wochenvorschau heading in the real WP post - nothing published this week" };
  if (section.articlesHtml.length !== 1) return { skip: `expected exactly one table, found ${section.articlesHtml.length} - needs manual review` };

  return { markdownDE: extractIntro(body) + htmlTableToMarkdown(section.articlesHtml[0]) };
}

function processIssue(n, callback) {
  const name = "WN" + n;
  const built = buildMarkdown(n);
  if (built.skip) {
    console.info(`${name}: skipped - ${built.skip}`);
    return callback();
  }

  articleModule.find({ blog: name, categoryEN: CATEGORY_EN }, function (err, existing) {
    if (err) return callback(err);
    existing = existing || [];

    if (existing.length > 1) {
      console.info(`${name}: ${existing.length} articles already in this category - ambiguous, needs manual review, skipping`);
      return callback();
    }

    const article = existing[0];
    if (article) {
      const current = article.markdownDE || "";
      if (current.trim() !== "" && current.trim() !== "no translation" && current.length >= EMPTY_THRESHOLD) {
        console.info(`${name}: article ${article.id} already has substantial content (${current.length} chars) that doesn't look like a leftover calendar stub - NOT touching, needs manual review`);
        return callback();
      }
    }

    console.info(`${name}: ${article ? `will fill existing article ${article.id}` : "will create a new article"}`);
    console.info(built.markdownDE.slice(0, 120) + (built.markdownDE.length > 120 ? "..." : ""));

    if (!options.commit) return callback();

    if (article) {
      fillExisting(name, article, built.markdownDE, callback);
    } else {
      createNew(name, built.markdownDE, callback);
    }
  });
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

function fillExisting(blogName, article, markdownDE, callback) {
  withReopenedBlog(blogName, function (done) {
    article._blog = null; // force a fresh reload reflecting the reopened blog state
    article.setAndSave(USER, { categoryEN: CATEGORY_EN, markdownDE, version: article.version }, done);
  }, function (err) {
    if (err) return callback(err);
    console.info(`${blogName}: article ${article.id} filled in.`);
    callback();
  });
}

function createNew(blogName, markdownDE, callback) {
  articleModule.createNewArticle({}, function (err, article) {
    if (err) return callback(err);
    article.setAndSave(USER, { blog: blogName, categoryEN: CATEGORY_EN, markdownDE, version: article.version }, function (err) {
      if (err) return callback(err);
      console.info(`${blogName}: created article ${article.id}.`);
      callback();
    });
  });
}

function resolveIssueNumbers() {
  if (options.issue) return [options.issue];
  const numbers = [];
  for (let n = options.from; n <= options.to; n++) numbers.push(n);
  return numbers;
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  if (!options.commit) console.info("DRY RUN - pass --commit to actually write changes\n");

  async.eachSeries(resolveIssueNumbers(), processIssue, function (err) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.info("\nDone.");
  });
});
