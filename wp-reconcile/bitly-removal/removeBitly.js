#!/usr/bin/env node
// Removes the dependency on bit.ly short links across all published
// articles, per the project owner's explicit decision: bit.ly was a
// "Modeerscheinung" (fad) used only for a while, an unnecessary external
// dependency, and carries a real risk that someone else (bit.ly, or
// whoever controls a given short code) changes where it points - already
// confirmed for real: `bit.ly/OSMUS` had been silently repointed to a
// generic fashion retailer, unrelated to its original OSM-US context.
//
// Every distinct bit.ly code actually used (51, scoped to non-Trash
// articles) was resolved by hand first (see resolved-mapping.txt) via a
// plain HTTP HEAD request following the 301 - not auto-applied without
// review, since resolution can fail (18 of 51 are already dead, 404) or
// need URL-encoding (2 resolved destinations contain a literal space,
// which would break markdown link syntax if left unescaped).
//
// This script only ever replaces a bit.ly URL with its ALREADY-RESOLVED
// real destination (from resolved-mapping.txt) - it does not do any HTTP
// itself, so it's safe to dry-run/re-run without hitting bit.ly again.
// Codes with no resolved destination (dead links) are left untouched and
// reported separately - replacing bit.ly wouldn't have saved those
// anyway, since the real destination is already gone too.
//
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/bitly-removal/removeBitly.js --commit

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

assert.strictEqual(process.env.NODE_ENV, "wpreconcile", "removeBitly.js must run with NODE_ENV=wpreconcile.");

const USER = { OSMUser: "wp-oldimport" };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPPING_FILE = path.join(__dirname, "resolved-mapping.txt");

program.option("--commit", "actually write changes (default: dry-run)").parse(process.argv);
const options = program.opts();

const mapping = new Map(); // code -> resolved url (or null if dead/unresolved)
for (const line of fs.readFileSync(MAPPING_FILE, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const idx = line.indexOf("|");
  const code = line.slice(0, idx);
  const dest = line.slice(idx + 1).trim();
  mapping.set(code, dest || null);
}

function encodeDest(url) {
  // the resolved destination is already a real URL (query strings etc.
  // already percent-encoded by whoever generated them) - only the space
  // characters found in two of them need escaping, not a full re-encode
  // (which would double-encode the rest).
  return url.replace(/ /g, "%20");
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  const LANGS = language.getLid();

  articleModule.find({}, function (err, articles) {
    if (err) { console.error(err); process.exit(1); }

    const toFix = []; // {id, blog, field, before, after}
    const deadCodesSeen = new Set();

    for (const a of articles) {
      if (a.blog === "Trash") continue;
      for (const lang of LANGS) {
        const field = "markdown" + lang;
        const text = a[field];
        if (!text || !text.includes("bit.ly/")) continue;

        let after = text;
        let changed = false;
        for (const [code, dest] of mapping.entries()) {
          // strip any preceding http(s):// too, not just "bit.ly/CODE" -
          // otherwise the original protocol prefix is left dangling in
          // front of the (already-absolute) resolved destination, e.g.
          // "http://bit.ly/x" -> "http://https://real-destination".
          const re = new RegExp("(?:https?:\\/\\/)?bit\\.ly\\/" + code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9_-])", "g");
          if (!re.test(after)) continue;
          if (dest === null) { deadCodesSeen.add(code); continue; }
          after = after.replace(re, encodeDest(dest));
          changed = true;
        }
        if (changed) toFix.push({ id: a.id, blog: a.blog, field, after });
      }
    }

    console.info(`${toFix.length} field(s) to update:`);
    for (const f of toFix) console.info(`  ${f.blog} article ${f.id} [${f.field}]`);

    console.info(`\n${deadCodesSeen.size} dead bit.ly code(s) left untouched (404, nothing to replace with): ${[...deadCodesSeen].join(", ")}`);

    if (!options.commit) {
      console.info("\nDRY RUN - pass --commit to actually write.");
      return process.exit(0);
    }

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
