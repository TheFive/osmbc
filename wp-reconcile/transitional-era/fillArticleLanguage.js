#!/usr/bin/env node
// Fills in one language field of an EXISTING osmbc article from a real
// WordPress-only bullet the project owner has confirmed belongs to it -
// the "same article, different language" counterpart to
// createArticleFromWp.js (which creates a brand-new article).
//
// Real case this was built for: WN276 article 10147 ("Josm 8964
// released") - its DE text has the changelog link inline and matched WP
// fine (a genuine "8964"->"8969" version-number correction), but its EN
// text has NO link at all, so EN never matched even though the same real
// story was published in English too (with the link).
//
// Finds the bullet by a search string (same approach as
// createArticleFromWp.js, for the same reason: needs-review.csv only has
// flattened text, and the real HTML with links has to come from the source).
//
// Writes through article.setAndSave (audited, attributed to wp-backport),
// reopening the blog first since close<LANG> blocks markdown<LANG> edits
// while true (unlike categoryEN, status alone doesn't block it, but
// close<LANG> does - model/article.js:100-134).
//
// SAFETY: only runs with NODE_ENV=wpreconcile. Dry-run by default; --commit
// to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/fillArticleLanguage.js \
//     --id 10147 --issue WN276 --lang EN --search "Revision" --commit

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
import { htmlToMarkdown } from "../backport/htmlToMarkdown.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "fillArticleLanguage.js must run with NODE_ENV=wpreconcile."
);

const WP_LANG = {
  DE: "de", EN: "en", ES: "es", PT: "pt", TR: "tr", RU: "ru",
  JP: "ja", FR: "fr", ID: "id", NL: "nl", IT: "it", KO: "ko", SW: "sw",
  BR: "br", ZH: "zh", PL: "pl", UK: "uk", CN: "cn"
};

const USER = { OSMUser: "wp-backport" };

program
  .requiredOption("--id <n>", "article id", (v) => parseInt(v, 10))
  .requiredOption("--issue <name>", "issue name, e.g. WN276")
  .requiredOption("--lang <LANG>", "osmbc language code, e.g. EN")
  .requiredOption("--search <text>", "a substring uniquely identifying the WP bullet")
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

const markdown = htmlToMarkdown(found[0].html);
const field = "markdown" + options.lang.toUpperCase();

console.info(`Found under WP heading "${found[0].heading}":`);
console.info(markdown);
console.info();

if (!options.commit) {
  console.info(`DRY RUN - would set article ${options.id}: ${field}=<above>. Pass --commit to actually write.`);
  process.exit(0);
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  articleModule.findById(options.id, function (err, article) {
    if (err) return handleError(err);
    if (!article) return handleError(new Error(`No article found for id ${options.id}`));

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

      blog.setAndSave(USER, openData, function (err) {
        if (err) return handleError(err);
        article._blog = null; // force a fresh reload reflecting the reopened blog state
        article.setAndSave(USER, { [field]: markdown, version: article.version }, function (articleErr) {
          blog.setAndSave(USER, original, function (restoreErr) {
            if (articleErr) return handleError(articleErr);
            if (restoreErr) return handleError(restoreErr);
            console.info(`Article ${options.id}: ${field} updated.`);
          });
        });
      });
    });
  });
});

function handleError(err) {
  console.error(err);
  process.exit(1);
}
