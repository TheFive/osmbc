#!/usr/bin/env node
// Corrects an over-application bug from fixImageCaptionRefs.js: running it
// twice matched "<iframe>" again inside its own already-backtick-wrapped
// output ("`<iframe>`" still contains the substring "<iframe>"), stacking
// extra backtick pairs (article 34703, WN826, multiple language fields
// ended up with double or triple backticks instead of one). Normalizes
// any run of 2+ backticks immediately around "<iframe>" back to exactly one.
//
// Dry-run by default; --commit to actually write.

import { strict as assert } from "assert";
import { program } from "commander";
import async from "async";

import configModule from "../model/config.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import language from "../model/language.js";
import messageCenter from "../notification/messageCenter.js";

assert.strictEqual(process.env.NODE_ENV, "wpreconcile", "fixDoubleBacktick.js must run with NODE_ENV=wpreconcile.");

const USER = { OSMUser: "wp-oldimport" };
const ARTICLE_ID = 34703;
const BLOG = "WN826";
const RE = /`{2,}<iframe>`{2,}/g;

program.option("--commit", "actually write changes (default: dry-run)").parse(process.argv);
const options = program.opts();

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  const LANGS = language.getLid();

  articleModule.findById(ARTICLE_ID, function (err, article) {
    if (err) { console.error(err); process.exit(1); }
    if (!article) { console.error(`No article found for id ${ARTICLE_ID}`); process.exit(1); }

    const data = { version: article.version };
    const touched = [];
    for (const lang of LANGS) {
      const field = "markdown" + lang;
      const text = article[field];
      if (text && RE.test(text)) {
        data[field] = text.replace(RE, "`<iframe>`");
        touched.push(field);
      }
    }

    console.info(`Article ${ARTICLE_ID} [${BLOG}]: ${touched.length} field(s) to normalize: ${touched.join(", ")}`);
    if (!options.commit) {
      console.info("DRY RUN - pass --commit to actually write.");
      return process.exit(0);
    }
    if (touched.length === 0) return process.exit(0);

    blogModule.findOne({ name: BLOG }, function (err, blog) {
      if (err) { console.error(err); process.exit(1); }
      if (!blog) { console.error(`No blog found for ${BLOG}`); process.exit(1); }
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
        if (err) { console.error(err); process.exit(1); }
        article._blog = null;
        article.setAndSave(USER, data, function (articleErr) {
          blog.setAndSave(USER, original, function (restoreErr) {
            if (articleErr) { console.error(articleErr); process.exit(1); }
            if (restoreErr) { console.error(restoreErr); process.exit(1); }
            console.info("Done.");
          });
        });
      });
    });
  });
});
