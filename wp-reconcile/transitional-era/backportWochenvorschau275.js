#!/usr/bin/env node
// One-off backport of the real WN275 "Wochenvorschau" calendar table into
// the existing osmbc article that was supposed to hold it (10072, currently
// "--unpublished--", title "Wochenvorschau - nicht publishen"): the
// calendar table WAS actually published in WordPress, but never made it
// back into osmbc - the manual WP-side calendar process from osmbc's very
// first few issues predates the mechanism that replaced it shortly after
// (confirmed: this exact "unpublished but real content" pattern occurs
// exactly once across all of WN272-304 - the project owner chose to handle
// this single case directly rather than build a general mechanism for it).
//
// Writes through article.setAndSave (audited, attributed to wp-backport),
// reopening the blog first exactly like unpublishArticle.js does, since
// categoryEN is blocked while the blog is closed.
//
// SAFETY: only runs with NODE_ENV=wpreconcile. Dry-run by default; --commit
// to actually write.

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
import { parseOldBlogSections } from "../old-era/parseOldBlogSections.js";
import { htmlTableToMarkdown } from "../backport/htmlTableToMarkdown.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "backportWochenvorschau275.js must run with NODE_ENV=wpreconcile."
);

const ARTICLE_ID = 10072;
const CATEGORY_EN = "Not Translated"; // blog WN275's own categories array: {DE: "Wochenvorschau", EN: "Not Translated"}
const USER = { OSMUser: "wp-backport" };

program.option("--commit", "actually write the change (default: dry-run)").parse(process.argv);
const options = program.opts();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wp = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts", "275.json"), "utf8"));
const { sections } = parseOldBlogSections(wp.perLanguage.de.body);
const section = sections.find((s) => s.headingText === "Wochenvorschau");
if (!section || section.articlesHtml.length !== 1) {
  console.error("Expected exactly one Wochenvorschau table in WN275 - source data may have changed, aborting.");
  process.exit(1);
}

const markdownDE = "Termine vom 29.10.2015 bis 07.11.2015\r\n\r\n" + htmlTableToMarkdown(section.articlesHtml[0]);

console.info("New markdownDE:\n" + markdownDE + "\n");

if (!options.commit) {
  console.info(`DRY RUN - would set article ${ARTICLE_ID}: categoryEN="${CATEGORY_EN}", markdownDE as above. Pass --commit to actually write.`);
  process.exit(0);
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  articleModule.findById(ARTICLE_ID, function (err, article) {
    if (err) return handleError(err);
    if (!article) return handleError(new Error(`No article found for id ${ARTICLE_ID}`));

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
          console.info(`Article ${article.id}: backported.`);
        });
      }

      blog.setAndSave(USER, openData, function (err) {
        if (err) return handleError(err);
        article._blog = null; // force a fresh reload reflecting openData - see unpublishArticle.js
        article.setAndSave(
          USER,
          { categoryEN: CATEGORY_EN, markdownDE, version: article.version },
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
