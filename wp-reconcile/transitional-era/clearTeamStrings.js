#!/usr/bin/env node
// Suppresses the buggy automated team-credit fallback (model/blog.js:
// createTeamString) for the transitional era (WN272-304).
//
// Root cause: countLogsForBlog's SQL filters on data->>'blog', but every
// changes row from 2015 (43036 rows DB-wide) has an empty blog property -
// that field simply wasn't logged yet. So the fallback has ALWAYS silently
// found zero real editors for these issues; it was never visible because
// nobody had looked at an exported preview until now. Once applyBackport.js
// writes real (correctly blog-tagged) entries for the synthetic
// "wp-backport" user, that user becomes the ONLY thing the tally finds,
// surfacing as "erstellt von wp-backport" in the export.
//
// Verified against the real WordPress source (backport/input/wp/wp_posts):
// the "##Team##" credit sentence template (the umap.openstreetmap.fr link)
// does not appear in ANY issue's original body before #321 - so for the
// entire WN272-304 range there is nothing to recover; the original simply
// never published a credit line. Per the project owner: if the original had
// no team string, none may appear now either.
//
// Fix: set teamString<LANG> = "" (explicit, not absent) for every language
// on every WN272-304 blog. This relies on createTeamString's override check
// now distinguishing "not set" from "explicitly set to empty" (model/blog.js
// createTeamString - fixed alongside this script) so an empty override is
// honored as "show nothing" instead of falling through to the log
// computation.
//
// Blog.setAndSave has its own no-op guard (model/blog.js:116:
// `if (value === "" && typeof (self[key]) === "undefined") continue;`) that
// silently drops exactly this "undefined -> ''" transition, so a single
// setAndSave call would never actually persist the override. Writing a
// non-empty placeholder first, then "" right after, sidesteps that guard
// without touching it (it's shared, live code well beyond this script's
// scope) - two audited writes per language instead of one, but no change to
// existing behavior elsewhere.
//
// Dry-run by default; --commit to actually write. --issue/--from/--to
// restrict which issues to touch, for piloting a sample first.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/clearTeamStrings.js --issue WN275
//   NODE_ENV=wpreconcile node wp-reconcile/transitional-era/clearTeamStrings.js --from 272 --to 304 --commit

import { strict as assert } from "assert";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import blogModule from "../../model/blog.js";
import language from "../../model/language.js";
import messageCenter from "../../notification/messageCenter.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "clearTeamStrings.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-backport" };

program
  .option("--issue <name>", "single issue name, e.g. WN275")
  .option("--from <n>", "start of issue number range", (v) => parseInt(v, 10), 272)
  .option("--to <n>", "end of issue number range", (v) => parseInt(v, 10), 304)
  .option("--commit", "actually write changes (default: dry-run)")
  .parse(process.argv);

const options = program.opts();

function issueNames() {
  if (options.issue) return [options.issue.toUpperCase()];
  const names = [];
  for (let n = options.from; n <= options.to; n++) names.push("WN" + String(n).padStart(3, "0"));
  return names;
}

function clearOne(name, callback) {
  blogModule.findOne({ name }, function (err, blog) {
    if (err) return callback(err);
    if (!blog) {
      console.info(`${name}: no blog found, skipping.`);
      return callback();
    }

    const langlist = language.getLanguages();
    const placeholderData = {};
    const emptyData = {};
    let anyNonEmpty = false;
    for (const l in langlist) {
      const current = blog["teamString" + l];
      if (current) anyNonEmpty = true;
      placeholderData["teamString" + l] = " ";
      emptyData["teamString" + l] = "";
    }

    if (anyNonEmpty) {
      console.info(`${name}: has an existing non-empty manual teamString - leaving untouched (would not overwrite real data).`);
      return callback();
    }

    console.info(`${name}: clearing teamString<LANG> for all languages${options.commit ? "" : " (DRY RUN)"}.`);
    if (!options.commit) return callback();
    blog.setAndSave(USER, placeholderData, function (err) {
      if (err) return callback(err);
      blog.setAndSave(USER, emptyData, callback);
    });
  });
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  async.eachSeries(issueNames(), clearOne, function (err) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.info("\nDone.");
  });
});
