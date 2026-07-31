#!/usr/bin/env node
// Rebuilds the pre-osmbc era (WN001-WN271, from the old German-only
// blog.openstreetmap.de / wp_1_posts) so every real historical issue is a
// genuinely well-formed osmbc blog + article set - not just Hugo-exportable,
// but usable/editable inside osmbc itself.
//
// Per the project owner's explicit decision, this REPLACES whatever
// articles already exist for these blogs (moved to blog "Trash", not
// deleted - see retireExistingArticles) rather than diffing against them:
// there is no per-article id in the old HTML to match on at all, and the
// category taxonomy from 2010-2015 doesn't match today's, so categories are
// regenerated fresh, per blog, from that issue's own real heading text.
//
// WN000 is not a real issue (no wp_1_posts entry, empty categories) and is
// always excluded.
//
// SAFETY: only runs with NODE_ENV=wpreconcile (local restored DB copy).
// Dry-run by default; --commit to actually write, only ever against a local
// copy - never production directly.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/rebuildOldBlog.js --from 1 --to 271
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/rebuildOldBlog.js --issue 100 --commit

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import blogModule from "../../model/blog.js";
import articleModule from "../../model/article.js";
import messageCenter from "../../notification/messageCenter.js";
import { parseOldBlogSections } from "./parseOldBlogSections.js";
import { parseWeekRange } from "./parseWeekRange.js";
import { htmlToMarkdown } from "../backport/htmlToMarkdown.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "rebuildOldBlog.js must run with NODE_ENV=wpreconcile."
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WP1_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_1_posts");
const USER = { OSMUser: "wp-oldimport" };
const NO_CATEGORY = "-- no category yet --";

program
  .option("--issue <n>", "single issue number, e.g. 100", (v) => parseInt(v, 10))
  .option("--from <n>", "start of issue number range", (v) => parseInt(v, 10))
  .option("--to <n>", "end of issue number range", (v) => parseInt(v, 10))
  .option("--commit", "actually write changes (default: dry-run)")
  .parse(process.argv);

const options = program.opts();

function issueName(n) {
  return "WN" + String(n).padStart(3, "0");
}

function leadingText(body) {
  const tagIndex = body.indexOf("<");
  return tagIndex === -1 ? body : body.slice(0, tagIndex);
}

function retireExistingArticles(articles, callback) {
  async.eachSeries(
    articles,
    function (article, cb) {
      if (!options.commit) return cb();
      async.series(
        [
          function unpublish(done) {
            article.setAndSave(
              USER,
              { categoryEN: "--unpublished--", unpublishReason: "Superseded by wp-oldimport full rebuild", version: article.version },
              done
            );
          },
          function trash(done) {
            article.setAndSave(USER, { blog: "Trash", version: article.version }, done);
          }
        ],
        cb
      );
    },
    callback
  );
}

function createArticles(blogName, sections, callback) {
  let created = 0;
  async.eachSeries(
    sections,
    function (section, sectionDone) {
      const categoryEN = section.headingText || NO_CATEGORY;
      let previousArticleId = null;

      async.eachSeries(
        section.articlesHtml,
        function (bulletHtml, itemDone) {
          const markdownDE = htmlToMarkdown(bulletHtml);
          if (!options.commit) {
            created++;
            return itemDone();
          }

          articleModule.createNewArticle({}, function (err, article) {
            if (err) return itemDone(err);
            const data = { blog: blogName, categoryEN, markdownDE, version: article.version };
            if (previousArticleId) data.predecessorId = previousArticleId;
            article.setAndSave(USER, data, function (err) {
              if (err) return itemDone(err);
              previousArticleId = article.id;
              created++;
              itemDone();
            });
          });
        },
        sectionDone
      );
    },
    function (err) {
      callback(err, created);
    }
  );
}

function processIssue(n, callback) {
  const file = path.join(WP1_DIR, n + ".json");
  if (!fs.existsSync(file)) {
    console.info(`${issueName(n)}: no wp_1_posts source found, skipping`);
    return callback();
  }

  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  const body = source.perLanguage.de.body;
  const { sections, warnings } = parseOldBlogSections(body);
  const dates = parseWeekRange(leadingText(body), source.postDate);
  const name = issueName(n);
  const totalArticles = sections.reduce((sum, s) => sum + s.articlesHtml.length, 0);

  console.info(
    `${name}: ${sections.length} category(ies), ${totalArticles} article(s), ` +
    `dates ${dates.startDate.slice(0, 10)}..${dates.endDate.slice(0, 10)} (${dates.method})` +
    (warnings.length ? `, warnings: ${warnings.join("; ")}` : "")
  );

  blogModule.findOne({ name }, function (err, blog) {
    if (err) return callback(err);
    if (!blog) return callback(new Error(`No skeleton blog found for ${name}`));

    const categories = sections.map((s) => {
      const text = s.headingText || NO_CATEGORY;
      return { DE: text, EN: text };
    });

    articleModule.find({ blog: name }, function (err, existingArticles) {
      if (err) return callback(err);
      existingArticles = existingArticles || [];
      if (existingArticles.length > 0) {
        console.info(`${name}: retiring ${existingArticles.length} existing article(s) to Trash`);
      }

      if (!options.commit) {
        console.info(`${name}: dry-run, no changes written`);
        return callback();
      }

      // Article.isChangeAllowed (model/article.js:100-134) blocks editing
      // categoryEN/blog on an EXISTING article (one whose _blog gets loaded,
      // since its "blog" field is already set) whenever blog.status ===
      // "closed" - true for every one of these old blogs. Newly created
      // articles are unaffected (their "blog" field is empty until the very
      // setAndSave call that sets it, so _blog never loads in time to block
      // that same call - verified against WN001), but retiring existing
      // articles needs the blog briefly reopened, exactly like the
      // reopen/reclose dance the WN272+ backport tool needs for close<LANG>.
      async.series(
        [
          (cb) => blog.setAndSave(USER, { startDate: dates.startDate, endDate: dates.endDate, categories }, cb),
          (cb) => existingArticles.length === 0 ? cb() : blog.setAndSave(USER, { status: "edit" }, cb),
          (cb) => retireExistingArticles(existingArticles, cb),
          (cb) => existingArticles.length === 0 ? cb() : blog.setAndSave(USER, { status: "closed" }, cb),
          (cb) => createArticles(name, sections, function (err, created) {
            if (err) return cb(err);
            console.info(`${name}: created ${created} article(s)`);
            cb();
          })
        ],
        callback
      );
    });
  });
}

function resolveIssueNumbers() {
  if (options.issue) return [options.issue];
  const from = options.from || 1;
  const to = options.to || 271;
  const numbers = [];
  for (let n = from; n <= to; n++) {
    if (n === 0) continue; // WN000 is not a real issue
    numbers.push(n);
  }
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
