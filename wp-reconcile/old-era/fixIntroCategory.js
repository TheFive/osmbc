#!/usr/bin/env node
// Recovers real intro-style content that got stuck at the
// "-- no category yet --" placeholder during the earlier old-era import,
// for the specific sub-case where the content genuinely sits BEFORE the
// very first <h2> heading in the real source (an intro/meta announcement,
// e.g. Christmas greetings, a call for a new team member) - not a case of
// a heading format the parser failed to recognize (those need real parser
// work, not a category relabel).
//
// Real cases found: WN230 (articles 44802, 44803), WN005 (article 35350).
// Adds an "In eigener Sache" category (matching the transitional era's own
// "About us" convention) to the blog's own category list if not already
// present, and re-labels the given articles' category/categoryEN.
//
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/fixIntroCategory.js --issue WN230 --ids 44802,44803 --commit

import { strict as assert } from "assert";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import blogModule from "../../model/blog.js";
import messageCenter from "../../notification/messageCenter.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "fixIntroCategory.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-oldimport" };
const CATEGORY = "In eigener Sache";

program
  .requiredOption("--issue <name>", "issue name, e.g. WN230")
  .requiredOption("--ids <ids>", "comma-separated article ids, e.g. 44802,44803")
  .option("--commit", "actually write the change (default: dry-run)")
  .parse(process.argv);

const options = program.opts();
const ids = options.ids.split(",").map((s) => parseInt(s.trim(), 10));

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  blogModule.findOne({ name: options.issue }, function (err, blog) {
    if (err) { console.error(err); process.exit(1); }
    if (!blog) { console.error(`No blog found for ${options.issue}`); process.exit(1); }

    const categories = blog.categories.map((c) => ({ ...c }));
    const already = categories.some((c) => c.EN === CATEGORY || c.DE === CATEGORY);
    if (!already) {
      const idx = categories.findIndex((c) => c.EN === "-- no category yet --");
      const entry = { DE: CATEGORY, EN: CATEGORY };
      if (idx >= 0) categories.splice(idx + 1, 0, entry);
      else categories.unshift(entry);
    }

    console.info(`${options.issue}: category "${CATEGORY}" ${already ? "already present" : "would be added"}.`);
    for (const id of ids) console.info(`  article ${id}: category/categoryEN -> "${CATEGORY}"`);

    if (!options.commit) {
      console.info("DRY RUN - pass --commit to actually write.");
      return process.exit(0);
    }

    async.series([
      function updateBlog(cb) {
        if (already) return cb();
        blog.setAndSave(USER, { categories }, cb);
      },
      function updateArticles(cb) {
        // categoryEN edits are blocked whenever blog.status === "closed"
        // (model/article.js:121, checked regardless of close<LANG>/
        // exported<LANG>), which every old-era blog is - reopen/reclose
        // around the edit, same pattern as applyBackport.js.
        const original = { status: blog.status };
        blog.setAndSave(USER, { status: "edit" }, function (err) {
          if (err) return cb(err);
          async.eachSeries(ids, function (id, cb2) {
            articleModule.findById(id, function (err, article) {
              if (err) return cb2(err);
              if (!article) return cb2(new Error(`No article found for id ${id}`));
              article._blog = null;
              article.setAndSave(USER, { category: CATEGORY, categoryEN: CATEGORY, version: article.version }, cb2);
            });
          }, function (err) {
            blog.setAndSave(USER, original, function (restoreErr) {
              if (err) return cb(err);
              if (restoreErr) return cb(restoreErr);
              cb();
            });
          });
        });
      }
    ], function (err) {
      if (err) { console.error(err); process.exit(1); }
      console.info("Done.");
    });
  });
});
