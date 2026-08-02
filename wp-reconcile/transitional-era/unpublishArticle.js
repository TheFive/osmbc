#!/usr/bin/env node
// Marks a single article as unpublished (categoryEN: "--unpublished--"),
// the same built-in osmbc action a normal editor triggers via the article
// edit UI - used here for articles confirmed, via the transitional-era
// link-based reconciliation, to have genuinely never made it into the
// published WordPress post (real absence, not a matcher failure - see
// needs-review.csv "unmatched-osmbc" entries reviewed by the project owner).
//
// Writes through article.setAndSave, so it's fully audited in "changes"
// exactly like a manual edit would be, attributed to the synthetic user
// "wp-backport" (same user as the WN272+ backport corrections).
//
// SAFETY: only runs with NODE_ENV=wpreconcile (local restored DB copy).
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/unpublishArticle.js --id 10075 --reason "..." --commit

import { strict as assert } from "assert";
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
  "unpublishArticle.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-backport" };

program
  .requiredOption("--id <n>", "article id", (v) => parseInt(v, 10))
  .requiredOption("--reason <text>", "unpublish reason (shown in the audit log)")
  .option("--commit", "actually write the change (default: dry-run)")
  .parse(process.argv);

const options = program.opts();

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  articleModule.findById(options.id, function (err, article) {
    if (err) return handleError(err);
    if (!article) return handleError(new Error(`No article found for id ${options.id}`));

    console.info(`Article ${article.id} (blog ${article.blog}, category "${article.categoryEN}"): ${article.title || article.collection || "(no title)"}`);

    if (article.categoryEN === "--unpublished--") {
      console.info("Already unpublished - nothing to do.");
      return;
    }

    if (!options.commit) {
      console.info(`DRY RUN - would set categoryEN="--unpublished--", unpublishReason="${options.reason}". Pass --commit to actually write.`);
      return;
    }

    // Article.isChangeAllowed (model/article.js:100-134) blocks editing
    // categoryEN on an existing article whenever blog.status === "closed",
    // OR whenever any language's close<LANG>/exported<LANG> is true and
    // that language has a real translation - true for every closed issue.
    // Briefly reopen everything, do the edit, then restore the ORIGINAL
    // values (not just re-close) - in a finally-style step that always
    // runs, even if the article edit itself fails, so a failure never
    // leaves the blog stuck half-open (verified the hard way: an earlier
    // version of this script left status="edit" behind after the article
    // edit failed on close<LANG>).
    blogModule.findOne({ name: article.blog }, function (err, blog) {
      if (err) return handleError(err);
      if (!blog) return handleError(new Error(`No blog found for ${article.blog}`));

      const langlist = language.getLanguages();
      const original = { status: blog.status };
      const openData = { status: "edit" };
      for (const l in langlist) {
        original["close" + l] = blog["close" + l];
        original["exported" + l] = blog["exported" + l];
        openData["close" + l] = false;
        openData["exported" + l] = false;
      }

      function restoreAndFinish(articleErr) {
        blog.setAndSave(USER, original, function (restoreErr) {
          if (articleErr) return handleError(articleErr);
          if (restoreErr) return handleError(restoreErr);
          console.info(`Article ${article.id}: set to --unpublished--.`);
        });
      }

      blog.setAndSave(USER, openData, function (err) {
        if (err) return handleError(err);
        // articleModule.findById (used above) eagerly loads and caches
        // article._blog at fetch time - before the blog was reopened here.
        // isChangeAllowed reads that cached snapshot, not a fresh lookup, so
        // without this it still sees the original closed/closeDE=true state.
        // Clearing it forces setAndSave's own loadBlog step to re-fetch the
        // now-open blog fresh (setAndSave only reloads when self._blog is
        // falsy - model/article.js:208-209).
        article._blog = null;
        article.setAndSave(
          USER,
          { categoryEN: "--unpublished--", unpublishReason: options.reason, version: article.version },
          restoreAndFinish
        );
      });
    });
  });
});

function handleError(err) {
  console.error(err);
  process.exit(1);
}
