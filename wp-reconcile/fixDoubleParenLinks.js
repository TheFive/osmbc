#!/usr/bin/env node
// Fixes the "double-wrapped paren" markdown link bug reported by the Hugo
// importer: [text]((https://...)) instead of [text](https://...) - happens
// when an editor pastes a URL that already had parens around it. osmbc's
// own markdown-it tolerates/swallows this; Hugo's Go urls.Parse rejects it
// outright ("first path segment in URL cannot contain colon").
//
// Found 32 real occurrences spanning WN272-819 (a long-standing authoring
// habit, not something introduced by this session's tooling). Investigated
// each one's exact surrounding text before writing this: most are a clean,
// unambiguous double-wrap (]((url)) with the url itself containing no
// parens) and are auto-fixed here. A handful are genuinely unbalanced (a
// missing second close, e.g. WN272 article 9622: "]((url)? Die..." with no
// second ")" anywhere) or have other markdown fragments mixed into the URL
// text (e.g. WN453 article 19740: "]((...)]) ") - those are NOT guessed at,
// just listed for manual review, since the right correction depends on
// what the editor actually meant.
//
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/fixDoubleParenLinks.js --commit

import { strict as assert } from "assert";
import { program } from "commander";
import async from "async";

import configModule from "../model/config.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import language from "../model/language.js";
import messageCenter from "../notification/messageCenter.js";

assert.strictEqual(process.env.NODE_ENV, "wpreconcile", "fixDoubleParenLinks.js must run with NODE_ENV=wpreconcile.");

const USER = { OSMUser: "wp-oldimport" };

// Safe, unambiguous shape only: ]((url)) where url itself has no parens at
// all and the second close immediately follows the first - anything else
// (unbalanced, or other markdown mixed into the url) is left for a human.
const SAFE_RE = /\]\(\((https?:\/\/[^()\s]+)\)\)/g;
const ANY_RE = /\]\(\(https?:\/\/[^)]*\)/g;

program.option("--commit", "actually write changes (default: dry-run)").parse(process.argv);
const options = program.opts();

function fixField(text) {
  if (!text) return { fixed: text, changed: false };
  const fixed = text.replace(SAFE_RE, "]($1)");
  return { fixed, changed: fixed !== text };
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  const LANGS = language.getLid();

  articleModule.find({}, function (err, articles) {
    if (err) { console.error(err); process.exit(1); }

    const toFix = [];
    const needsReview = [];

    for (const a of articles) {
      for (const lang of LANGS) {
        const field = "markdown" + lang;
        const text = a[field];
        if (!text || !text.includes("]((")) continue;

        const { fixed, changed } = fixField(text);
        if (changed) toFix.push({ id: a.id, blog: a.blog, field, before: text, after: fixed });

        // anything still matching the loose "]((http...)" shape after the
        // safe fix wasn't handled - flag for manual review
        const leftover = [...fixed.matchAll(ANY_RE)];
        if (leftover.length > 0) {
          needsReview.push({ id: a.id, blog: a.blog, field, snippet: leftover.map((m) => m[0]).join(" | ") });
        }
      }
    }

    console.info(`${toFix.length} field(s) to auto-fix (safe, unambiguous double-wrap):`);
    for (const f of toFix) console.info(`  ${f.blog} article ${f.id} [${f.field}]`);

    console.info(`\n${needsReview.length} field(s) need manual review (not auto-fixed):`);
    for (const r of needsReview) console.info(`  ${r.blog} article ${r.id} [${r.field}]: ${r.snippet}`);

    if (!options.commit) {
      console.info("\nDRY RUN - pass --commit to actually write the safe fixes.");
      return process.exit(0);
    }

    // Later (transitional/reliable-era) blogs genuinely have close<LANG>/
    // exported<LANG> set for real - unlike the old-era ones, editing
    // markdown<LANG> there needs the same reopen/reclose dance
    // applyBackport.js uses. Group fixes by blog so each is reopened once.
    const byBlog = new Map();
    for (const f of toFix) {
      if (!byBlog.has(f.blog)) byBlog.set(f.blog, []);
      byBlog.get(f.blog).push(f);
    }

    function withReopenedBlog(blogName, action, cb) {
      blogModule.findOne({ name: blogName }, function (err, blog) {
        if (err) return cb(err);
        if (!blog) return cb(new Error(`No blog found for ${blogName}`));

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
          if (err) return cb(err);
          action(function (actionErr) {
            blog.setAndSave(USER, original, function (restoreErr) {
              if (actionErr) return cb(actionErr);
              if (restoreErr) return cb(restoreErr);
              cb();
            });
          });
        });
      });
    }

    async.eachSeries([...byBlog.entries()], function ([blogName, fixes], cb) {
      withReopenedBlog(blogName, function (done) {
        async.eachSeries(fixes, function (f, cb2) {
          articleModule.findById(f.id, function (err, article) {
            if (err) return cb2(err);
            if (!article) return cb2(new Error(`No article found for id ${f.id}`));
            article._blog = null;
            article.setAndSave(USER, { [f.field]: f.after, version: article.version }, cb2);
          });
        }, done);
      }, cb);
    }, function (err) {
      if (err) { console.error(err); process.exit(1); }
      console.info("\nDone.");
    });
  });
});
