#!/usr/bin/env node
// CLI: reconstructs "what osmbc would have exported to WordPress" for one or
// more issues, by reusing osmbc's own render pipeline (blog.buildPreviewExport)
// and audit log (article.calculateDerivedFromChanges) - never re-implementing
// rendering, never touching WordPress data.
//
// SAFETY: only ever runs against config.wpreconcile.yaml (NODE_ENV=wpreconcile),
// which points at a locally-restored copy of the production DB, never at the
// live production connection. Run with:
//   NODE_ENV=wpreconcile node wp-reconcile/osmbc-extract/extractOsmbcIssue.js --issue WN825

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import blogModule from "../../model/blog.js";
import articleModule from "../../model/article.js";
import language from "../../model/language.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "extractOsmbcIssue.js must run with NODE_ENV=wpreconcile, so it only ever reads config.wpreconcile.yaml (a local restored DB copy) and can never accidentally point at production."
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "osmbc");

program
  .option("--issue <name>", "single issue name to extract, e.g. WN825")
  .option("--from <n>", "only issues numbered >= this", (v) => parseInt(v, 10))
  .option("--to <n>", "only issues numbered <= this", (v) => parseInt(v, 10))
  .parse(process.argv);

const options = program.opts();

function extractOneIssue(blog, callback) {
  const issueName = blog.name;

  articleModule.find({ blog: blog }, function (err, articles) {
    if (err) return callback(err);

    async.eachSeries(
      articles,
      function (article, cb) {
        article.calculateDerivedFromChanges(cb);
      },
      function (err) {
        if (err) return callback(err);

        const perLanguage = {};
        async.eachSeries(
          language.getLid(),
          function (lang, cb) {
            blog.buildPreviewExport({ renderer: "HTML", lang }, function (err, result) {
              if (err) return cb(err);
              perLanguage[lang] = {
                body: result.preview || result.body,
                containsEmptyArticlesWarning: result.containsEmptyArticlesWarning
              };
              cb();
            });
          },
          function (err) {
            if (err) return callback(err);

            const articleSummaries = articles.map(function (article) {
              const lastChangedByField = {};
              for (const lang of language.getLid()) {
                const field = "markdown" + lang;
                if (article._lastChange && article._lastChange[field]) {
                  lastChangedByField[field] = article._lastChange[field];
                }
              }
              return { id: article.id, categoryEN: article.categoryEN, lastChangedByField };
            });

            const output = {
              issue: issueName,
              categories: blog.getCategories(),
              perLanguage,
              articles: articleSummaries
            };

            fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(path.join(dataDir, issueName + ".json"), JSON.stringify(output, null, 2));
            console.info(`${issueName}: extracted ${articles.length} articles, ${language.getLid().length} languages`);
            callback();
          }
        );
      }
    );
  });
}

function resolveBlogs(callback) {
  if (options.issue) {
    return blogModule.findOne({ name: options.issue }, function (err, blog) {
      if (err) return callback(err);
      if (!blog) return callback(new Error("No blog found for " + options.issue));
      callback(null, [blog]);
    });
  }

  blogModule.find({}, function (err, blogs) {
    if (err) return callback(err);
    const filtered = blogs.filter(function (b) {
      const m = /^WN(\d+)$/i.exec(b.name);
      if (!m) return false;
      const n = parseInt(m[1], 10);
      if (options.from && n < options.from) return false;
      if (options.to && n > options.to) return false;
      return true;
    });
    callback(null, filtered);
  });
}

async.series([configModule.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  resolveBlogs(function (err, blogs) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    async.eachSeries(blogs, extractOneIssue, function (err) {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.info(`Done. ${blogs.length} issue(s) extracted.`);
    });
  });
});
