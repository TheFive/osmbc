#!/usr/bin/env node
// Recovers the real editorial team credit embedded directly in some old
// blog.openstreetmap.de post intros (before osmbc existed, so there is no
// change-log data to compute a team string from - see
// model/blog.js:createTeamString's manual teamString<LANG> override).
// Format seen in the real archive: "Das Autorenteam <names> wünscht viel
// Spaß beim Lesen." (most issues) or "Die Autoren <names> wünschen ... ein
// frohes Weihnachtsfest" (the one Christmas-week issue, #23) - both end in
// some form of "wünsch*", which both variants share.
//
// Dry-run by default; --commit to actually write, only ever against a
// local restored copy (NODE_ENV=wpreconcile), never production directly.

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import async from "async";

import configModule from "../../model/config.js";
import blogModule from "../../model/blog.js";
import messageCenter from "../../notification/messageCenter.js";

assert.strictEqual(process.env.NODE_ENV, "wpreconcile", "setLegacyTeamStrings.js must run with NODE_ENV=wpreconcile.");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WP1_DIR = path.join(__dirname, "..", "..", "backport", "input", "wp", "wp_1_posts");
const USER = { OSMUser: "wp-oldimport" };
// Captures the WHOLE credit sentence (not just the names) - createTeamString's
// manual-override branch (model/blog.js:343) returns teamString<LANG> verbatim,
// with no further template wrapping (unlike the computed/log-based branch,
// which wraps names in the "##Team##" editorstrings template) - storing only
// the bare names left the export ending in a naked, sentence-less name list
// (real case found: WN024, and confirmed the same for all 25 of these
// overrides). One sentence ends in "." (most issues) or "!" (the one
// Christmas-week issue, #23).
const CREDIT_SENTENCE_RE = /((?:Das Autorenteam|Die Autoren)\s+[^]+?wünsch\w*[^.!]*[.!])/i;

program.option("--commit", "actually write changes (default: dry-run)").parse(process.argv);
const options = program.opts();

function findTeamString(n) {
  const file = path.join(WP1_DIR, n + ".json");
  if (!fs.existsSync(file)) return null;
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  const body = source.perLanguage.de.body;
  const tagIndex = body.indexOf("<");
  const intro = (tagIndex === -1 ? body : body.slice(0, tagIndex)).replace(/\r?\n/g, " ");
  const m = CREDIT_SENTENCE_RE.exec(intro);
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

async.series([configModule.initialise, messageCenter.initialise], function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  if (!options.commit) console.info("DRY RUN - pass --commit to actually write changes\n");

  const found = [];
  for (let n = 1; n <= 271; n++) {
    const sentence = findTeamString(n);
    if (sentence) found.push({ n, sentence });
  }
  console.info(`Found team credits in ${found.length} issue(s).`);

  async.eachSeries(
    found,
    function (item, cb) {
      const name = "WN" + String(item.n).padStart(3, "0");
      console.info(`${name}: "${item.sentence}"`);
      if (!options.commit) return cb();
      blogModule.findOne({ name }, function (err, blog) {
        if (err) return cb(err);
        if (!blog) return cb(new Error(`No blog found for ${name}`));
        blog.setAndSave(USER, { teamStringDE: item.sentence }, cb);
      });
    },
    function (err) {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.info("\nDone.");
    }
  );
});
