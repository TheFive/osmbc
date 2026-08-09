#!/usr/bin/env node
// Sets close<LANG> = true for old-era blogs (WN001-271), which
// rebuildOldBlog.js/backfillLanguages.js never did - only the overall
// blog.status was ever set to "closed", not the per-language flags. The
// GUI's export/preview functions (and some article.isChangeAllowed
// checks) rely on close<LANG> specifically, not just blog.status, so
// leaving it unset is impractical even though nothing is technically
// broken by it.
//
// Only closes what was actually published, per the project owner
// ("natürlich nur schliessen, was auch veröffentlicht wurde"):
//   - DE for every real old-era blog (rebuildOldBlog.js gives 100% DE
//     coverage - every article it creates has real markdownDE).
//   - For issues #219-257 (recovered via backfillLanguages.js after the
//     <!--:xx--> shortcode fix), only the specific languages that
//     actually got a real matched bullet for that specific issue -
//     read directly from backfillLanguages.js's own pendingChanges.json
//     output, not just "had a non-stub WP body" (a few issues had a
//     real body that still failed to parse into any bullets at all,
//     e.g. WN242's tr and all of WN247 - those must NOT be closed,
//     since nothing was actually verified/backported for them).
//
// Dry-run by default; --commit to actually write.
//
// Usage:
//   NODE_ENV=wpreconcile node wp-reconcile/old-era/closeLanguages.js --commit

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import blogModule from "../../model/blog.js";
import messageCenter from "../../notification/messageCenter.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "closeLanguages.js must run with NODE_ENV=wpreconcile."
);

const USER = { OSMUser: "wp-oldimport" };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PENDING_CHANGES_FILE = path.join(__dirname, "..", "..", "backport", "output", "old-era-languages", "pendingChanges.json");

program.option("--commit", "actually write changes (default: dry-run)").parse(process.argv);
const options = program.opts();

function issueName(n) {
  return "WN" + String(n).padStart(3, "0");
}

// issue -> Set(lang) for the backfilled multi-language issues
const backfilledLangs = new Map();
if (fs.existsSync(PENDING_CHANGES_FILE)) {
  const changes = JSON.parse(fs.readFileSync(PENDING_CHANGES_FILE, "utf8"));
  for (const c of changes) {
    if (!backfilledLangs.has(c.issue)) backfilledLangs.set(c.issue, new Set());
    backfilledLangs.get(c.issue).add(c.lang);
  }
}

function closeOne(name, langs, callback) {
  blogModule.findOne({ name }, function (err, blog) {
    if (err) return callback(err);
    if (!blog) return callback();

    const toClose = [...langs].filter((lang) => blog["close" + lang] !== true);
    if (toClose.length === 0) return callback();

    console.info(`${name}: close ${toClose.join(", ")}${options.commit ? "" : " (DRY RUN)"}`);
    if (!options.commit) return callback();

    // Use the same closeBlog() method the real GUI action calls (not a raw
    // setAndSave) - it writes its own audit entry via sendCloseStatus and
    // handles the review-field bookkeeping the app itself relies on.
    async.eachSeries(toClose, function (lang, cb) {
      blog.closeBlog({ user: USER, lang, status: true }, cb);
    }, callback);
  });
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) { console.error(err); process.exit(1); }

  const issues = [];
  for (let n = 1; n <= 271; n++) {
    if (n === 0) continue;
    const langs = new Set(["DE"]);
    const extra = backfilledLangs.get(issueName(n));
    if (extra) for (const l of extra) langs.add(l);
    issues.push({ name: issueName(n), langs });
  }

  async.eachSeries(issues, function (issue, cb) {
    closeOne(issue.name, issue.langs, cb);
  }, function (err) {
    if (err) { console.error(err); process.exit(1); }
    console.info("\nDone.");
  });
});
