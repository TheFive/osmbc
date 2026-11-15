#!/usr/bin/env node
// Converts the git history of a DokuWiki "gitbacked" data repo into an
// OSMBC wiki repo (rules in wiki/dokuwikiMigration.js). Repeatable: run it
// again to get the same result, with --replace over a previous run.
//
//   node tools/dokuwiki-to-md.mjs <source git dir> <target dir>
//        [--authors <file.yaml>] [--restricted <page id>]... [--replace]
//
// --authors     YAML map "e-mail or name: OSM user" for authors whose name
//               in the history is not their OSM user name
// --restricted  page that gets "access: full" (only full users see it);
//               default osmbc/osm-user-name-mapping-list
// --replace     delete the target first, only if it is a previous
//               migration (git config osmbc.migration)
//
// Needs pandoc. The target is a new git repo, set wiki.directory to it.

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { load as yamlLoad } from "js-yaml";
import { migrate, pandocVersion, MIGRATION_MARKER } from "../wiki/dokuwikiMigration.js";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const positional = [];
const restricted = [];
let authorsFile = null;
let replace = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--authors") authorsFile = args[++i];
  else if (args[i] === "--restricted") restricted.push(args[++i]);
  else if (args[i] === "--replace") replace = true;
  else if (args[i].startsWith("--")) fail("Unknown option " + args[i]);
  else positional.push(args[i]);
}
const [source, target] = positional;
if (!source || !target) fail("Usage: node tools/dokuwiki-to-md.mjs <source git dir> <target dir> [--authors file.yaml] [--restricted id]... [--replace]");

function isPreviousMigration(dir) {
  try {
    return execFileSync("git", ["-C", dir, "config", "osmbc.migration"], { encoding: "utf8" }).trim() === MIGRATION_MARKER;
  } catch (err) {
    return false;
  }
}

if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
  if (!replace) fail("Target " + target + " is not empty (use --replace to overwrite a previous migration)");
  if (!isPreviousMigration(target)) fail("Target " + target + " is not a previous migration, not deleted");
  fs.rmSync(target, { recursive: true, force: true });
}

const authors = authorsFile ? yamlLoad(fs.readFileSync(authorsFile, "utf8")) || {} : {};

try {
  console.log("Using " + await pandocVersion());
} catch (err) {
  fail("pandoc not found, it is needed to convert DokuWiki pages");
}

const result = await migrate({
  source: path.resolve(source),
  target: path.resolve(target),
  authors,
  restricted: restricted.length ? restricted : ["osmbc/osm-user-name-mapping-list"],
  log: (m) => console.log(m)
});

console.log(result.commits + " commits written, " + result.skipped + " without page changes skipped");
console.log(result.pages + " pages, " + result.media + " media files");
for (const w of result.warnings) console.log("Warning: " + w);
if (result.missingLinks.size) {
  console.log("Links to pages that do not exist (page: linked from):");
  for (const [id, from] of Array.from(result.missingLinks).sort()) console.log("  " + id + ": " + from.join(", "));
}
