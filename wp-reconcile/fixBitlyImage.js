#!/usr/bin/env node
// One-off: WN441's Picture article (19088) uses a bit.ly short link as the
// actual lead-image src (![Logo](https://bit.ly/2FbFAjP)) across all 7
// language fields. Hugo's resources.GetRemote fails to fetch it at build
// time (403 Forbidden) - confirmed the short link itself still resolves
// (301 -> a GitHub "camo" proxy URL), but that proxy URL is ALSO 403 for
// automated fetches; the real underlying image, resolved from the camo
// URL's own encoded target, is reachable directly and returns a real
// image/jpeg (200, verified via curl):
//   https://raw.githubusercontent.com/gravitystorm/openstreetmap-promotional-leaflets/master/leaflets2.jpg
// Using a URL shortener as an image src is fragile in general (rate
// limits/bot-blocking on services never meant to serve as a CDN) -
// replacing it with the real, stable, direct source URL.
//
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/fixBitlyImage.js --commit

import { strict as assert } from "assert";
import { program } from "commander";
import async from "async";

import configModule from "../model/config.js";
import articleModule from "../model/article.js";
import blogModule from "../model/blog.js";
import language from "../model/language.js";
import messageCenter from "../notification/messageCenter.js";

assert.strictEqual(process.env.NODE_ENV, "wpreconcile", "fixBitlyImage.js must run with NODE_ENV=wpreconcile.");

const USER = { OSMUser: "wp-oldimport" };
const ARTICLE_ID = 19088;
const OLD_URL = "https://bit.ly/2FbFAjP";
const NEW_URL = "https://raw.githubusercontent.com/gravitystorm/openstreetmap-promotional-leaflets/master/leaflets2.jpg";

program.option("--commit", "actually write changes (default: dry-run)").parse(process.argv);
const options = program.opts();

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  const LANGS = language.getLid();

  articleModule.findById(ARTICLE_ID, function (err, article) {
    if (err) { console.error(err); process.exit(1); }
    if (!article) { console.error(`No article found for id ${ARTICLE_ID}`); process.exit(1); }

    const data = { version: article.version };
    let count = 0;
    for (const lang of LANGS) {
      const field = "markdown" + lang;
      const text = article[field];
      if (text && text.includes(OLD_URL)) {
        data[field] = text.split(OLD_URL).join(NEW_URL);
        count++;
        console.info(`  ${field}: would replace bit.ly link`);
      }
    }

    console.info(`\nArticle ${ARTICLE_ID} [${article.blog}]: ${count} field(s) to update.`);
    if (!options.commit) {
      console.info("DRY RUN - pass --commit to actually write.");
      return process.exit(0);
    }

    blogModule.findOne({ name: article.blog }, function (err, blog) {
      if (err) { console.error(err); process.exit(1); }
      if (!blog) { console.error(`No blog found for ${article.blog}`); process.exit(1); }

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
