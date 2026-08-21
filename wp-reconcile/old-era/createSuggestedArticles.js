#!/usr/bin/env node
// Writes the candidates from suggestNewArticles.js's suggestedNewArticles.json
// as real osmbc articles - markdownDE always "no translation" (these are,
// by construction, bullets confirmed absent from the German source),
// every other language field set from the suggestion.
//
// This is a review-then-write step, not a blind bulk-apply: run
// suggestNewArticles.js first, read the suggestions (or the console
// summary), drop anything that doesn't look right from the JSON file
// before running this with --commit.
//
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/createSuggestedArticles.js
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/createSuggestedArticles.js --commit

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import messageCenter from "../../notification/messageCenter.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "createSuggestedArticles.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-oldimport" };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUGGESTIONS_FILE = path.join(__dirname, "..", "..", "backport", "output", "old-era-languages", "suggestedNewArticles.json");

program.option("--commit", "actually write changes (default: dry-run)").parse(process.argv);
const options = program.opts();

const suggestions = JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, "utf8"));
console.info(`${suggestions.length} suggestion(s) loaded from ${SUGGESTIONS_FILE}.`);

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  async.eachSeries(suggestions, function (s, cb) {
    const data = { blog: s.issue, category: s.category, categoryEN: s.category, collection: s.collection, markdownDE: "no translation" };
    for (const l of s.languages) data["markdown" + l.lang] = l.markdown;

    console.info(`${s.issue} [${s.category}] (${s.languages.map((l) => l.lang).join(", ")})`);
    if (!options.commit) return cb();

    articleModule.createNewArticle({}, function (err, article) {
      if (err) return cb(err);
      article.setAndSave(USER, { ...data, version: article.version }, function (err) {
        if (err) return cb(err);
        console.info(`  -> created article ${article.id}`);
        cb();
      });
    });
  }, function (err) {
    if (err) { console.error(err); process.exit(1); }
    if (!options.commit) console.info("\nDRY RUN - pass --commit to actually write changes.");
    else console.info("\nDone.");
  });
});
