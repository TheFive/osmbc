#!/usr/bin/env node
// Fixes a batch of concrete bugs reported by the Hugo importer's main
// admin while testing recent weeklies:
//
// a) Picture-article captions with a footnote link (e.g. "[[1](#wn796_ID)]")
//    pointing at the wrong article id - either a plain typo (real target
//    exists in the SAME issue under a different id: WN796, WN810, WN817,
//    WN824) or a reference to last week's issue instead of this week's
//    real matching story (WN807), or - WN818(ru) - a literal, never-filled
//    template placeholder "#wn<blog-number>_<article-id>" left in the
//    translation. Each replacement below was found by locating the real
//    matching article by topic within the same issue and confirming its
//    content actually matches the caption (not guessed).
// b) A stray backslash-escaped dot inside a URL (WN804 fr:
//    "https://ivides\.org", looks like a regex-style domain reference that
//    leaked into real link text).
// c) Raw "<language>"/"<iframe>" mentioned literally in prose without code
//    formatting (WN824 br, WN826 en+uk) - not actual HTML tags, just
//    technical notation that looks like one syntactically. The EN
//    original of the WN824 case already uses backticks correctly
//    ("`name:<language>-Latn`") - the br translation dropped them.
//
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/fixImageCaptionRefs.js --commit

import { strict as assert } from "assert";
import { program } from "commander";
import async from "async";

import configModule from "../model/config.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import language from "../model/language.js";
import messageCenter from "../notification/messageCenter.js";

assert.strictEqual(process.env.NODE_ENV, "wpreconcile", "fixImageCaptionRefs.js must run with NODE_ENV=wpreconcile.");

const USER = { OSMUser: "wp-oldimport" };

// Each entry: articleId, its blog (for the reopen dance), and one or more
// exact find->replace string pairs applied across every markdown<LANG>
// field that contains the find string.
const FIXES = [
  { id: 33557, blog: "WN796", find: "#wn796_33549", replace: "#wn796_33564" },
  { id: 33876, blog: "WN807", find: "#wn805_33849", replace: "#wn807_33891" },
  { id: 33972, blog: "WN810", find: "#wn810_33914", replace: "#wn810_33989" },
  { id: 34220, blog: "WN817", find: "#wn816_34193", replace: "#wn817_34240" },
  { id: 34543, blog: "WN824", find: "#wn823_34534", replace: "#wn824_34595" },
  { id: 34251, blog: "WN818", find: "#wn%3Cblog-number%3E_%3Carticle-id%3E", replace: "#wn818_34271" },
  { id: 33818, blog: "WN804", find: "https://ivides\\.org", replace: "https://ivides.org" },
  { id: 34544, blog: "WN824", find: "[name:<language>-Latn]", replace: "[`name:<language>-Latn`]" },
  { id: 34703, blog: "WN826", find: "<iframe>", replace: "`<iframe>`" }
];

program.option("--commit", "actually write changes (default: dry-run)").parse(process.argv);
const options = program.opts();

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

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  const LANGS = language.getLid();

  async.eachSeries(FIXES, function ({ id, blog: blogName, find, replace }, cb) {
    articleModule.findById(id, function (err, article) {
      if (err) return cb(err);
      if (!article) return cb(new Error(`No article found for id ${id}`));

      const data = { version: article.version };
      const touchedFields = [];
      for (const lang of LANGS) {
        const field = "markdown" + lang;
        const text = article[field];
        if (text && text.includes(find)) {
          data[field] = text.split(find).join(replace);
          touchedFields.push(field);
        }
      }

      if (touchedFields.length === 0) {
        console.info(`${blogName} article ${id}: no field contains "${find}" - skipping (already fixed?).`);
        return cb();
      }

      console.info(`${blogName} article ${id}: ${touchedFields.join(", ")} -> replace "${find}" with "${replace}"${options.commit ? "" : " (DRY RUN)"}`);
      if (!options.commit) return cb();

      withReopenedBlog(blogName, function (done) {
        article._blog = null;
        article.setAndSave(USER, data, done);
      }, cb);
    });
  }, function (err) {
    if (err) { console.error(err); process.exit(1); }
    console.info("\nDone.");
  });
});
