#!/usr/bin/env node
// Creates a new osmbc article from a real WordPress-only bullet that the
// project owner has confirmed genuinely never existed in osmbc (a "neu"
// finding - see needs-review.csv "unmatched-wp" entries) - the reusable
// counterpart to unpublishArticle.js for the opposite case.
//
// Finds the bullet by a search string (since needs-review.csv only records
// the flattened text, not which WP category/heading it came from, nor its
// real HTML with links) - reports the heading it was found under so the
// caller can confirm/pick the right osmbc categoryEN before --commit.
//
// Writes through article.setAndSave (audited, attributed to wp-backport).
// New articles don't need the blog reopen/reclose dance (their "blog"
// field is empty until the very call that sets it, so _blog never loads in
// time to block it - same as rebuildOldBlog.js/backportWochenvorschau.js).
//
// SAFETY: only runs with NODE_ENV=wpreconcile. Dry-run by default; --commit
// to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/createArticleFromWp.js \
//     --issue WN276 --lang DE --search "Boy2006" --category Community --commit

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import articleModule from "../../model/article.js";
import messageCenter from "../../notification/messageCenter.js";
import { parseOldBlogSections } from "../old-era/parseOldBlogSections.js";
import { htmlToMarkdown } from "../backport/htmlToMarkdown.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "createArticleFromWp.js must run with NODE_ENV=wpreconcile."
);

const WP_LANG = {
  DE: "de", EN: "en", ES: "es", PT: "pt", TR: "tr", RU: "ru",
  JP: "ja", FR: "fr", ID: "id", NL: "nl", IT: "it", KO: "ko", SW: "sw",
  BR: "br", ZH: "zh", PL: "pl", UK: "uk", CN: "cn"
};

const USER = { OSMUser: "wp-backport" };

program
  .requiredOption("--issue <name>", "issue name, e.g. WN276")
  .requiredOption("--lang <LANG>", "osmbc language code, e.g. DE")
  .requiredOption("--search <text>", "a substring uniquely identifying the WP bullet")
  .option("--category <categoryEN>", "categoryEN to use (required for --commit; shown as a suggestion otherwise from the WP heading)")
  .option("--commit", "actually write the change (default: dry-run)")
  .parse(process.argv);

const options = program.opts();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const n = options.issue.replace(/^WN/i, "");
const wpLang = WP_LANG[options.lang.toUpperCase()];
if (!wpLang) {
  console.error(`Unknown osmbc language code "${options.lang}".`);
  process.exit(1);
}

const file = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_posts", n + ".json");
if (!fs.existsSync(file)) {
  console.error(`No WP source file for ${options.issue}.`);
  process.exit(1);
}
const wp = JSON.parse(fs.readFileSync(file, "utf8"));
const body = wp.perLanguage[wpLang] && wp.perLanguage[wpLang].body;
if (!body) {
  console.error(`No WP body for ${options.issue} [${options.lang}].`);
  process.exit(1);
}

const { sections } = parseOldBlogSections(body);
const found = [];
for (const section of sections) {
  for (const html of section.articlesHtml) {
    if (html.includes(options.search)) found.push({ heading: section.headingText, html });
  }
}

if (found.length === 0) {
  console.error(`No bullet found containing "${options.search}" in ${options.issue} [${options.lang}].`);
  process.exit(1);
}
if (found.length > 1) {
  console.error(`${found.length} bullets found containing "${options.search}" - make the search string more specific:`);
  found.forEach((f) => console.error(`  [${f.heading}] ${f.html.slice(0, 100)}...`));
  process.exit(1);
}

const { heading, html } = found[0];
const markdown = htmlToMarkdown(html);
const field = "markdown" + options.lang.toUpperCase();

console.info(`Found under WP heading "${heading}":`);
console.info(markdown);
console.info();

if (!options.category) {
  console.info(`No --category given - pass --category <categoryEN> (WP heading was "${heading}") together with --commit to create the article.`);
  process.exit(0);
}

if (!options.commit) {
  console.info(`DRY RUN - would create a new article: blog=${options.issue}, categoryEN="${options.category}", ${field}=<above>. Pass --commit to actually write.`);
  process.exit(0);
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  articleModule.createNewArticle({}, function (err, article) {
    if (err) return handleError(err);
    article.setAndSave(
      USER,
      { blog: options.issue, categoryEN: options.category, [field]: markdown, version: article.version },
      function (err) {
        if (err) return handleError(err);
        console.info(`${options.issue}: created article ${article.id}.`);
      }
    );
  });
});

function handleError(err) {
  console.error(err);
  process.exit(1);
}
