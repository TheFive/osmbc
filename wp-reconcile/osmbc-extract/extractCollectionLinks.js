#!/usr/bin/env node
// Builds a global index of how many DISTINCT articles reference the same
// "collection" link, across the WHOLE osmbc database (not just one issue).
// Used by the transitional-era stub-matching (stubCollectionMatch.js):
// per the project owner's explicit rule, an osmbc article with no real
// written text in any language (rawMarkdown is empty or the literal "no
// translation"/"german only" marker - confirmed real cases: WN275 articles
// 10097/10120) can still be safely matched to real WordPress content via
// its collected-but-never-written-out source link, but ONLY when that link
// is globally unique (used by exactly one article) - a link reused across
// several articles is too ambiguous to auto-match and must go to manual
// review instead.
//
// SAFETY: only runs with NODE_ENV=wpreconcile (local restored DB copy).
// Read-only - never writes anything back to the database.

import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import configModule from "../../model/config.js";
import db from "../../model/db.js";
import { normalizeUrl } from "../transitional-era/matchByLinks.js";

assert.strictEqual(
  process.env.NODE_ENV,
  "wpreconcile",
  "extractCollectionLinks.js must run with NODE_ENV=wpreconcile."
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, "..", "..", "backport", "input", "osmbc", "collectionLinkCounts.json");

configModule.initialise(function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  db.query("select id, data->>'collection' as collection from article where data ? 'collection'", [], function (err, result) {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    const articleIdsByLink = new Map();
    for (const row of result.rows) {
      const m = row.collection && /https?:\/\/\S+/.exec(row.collection);
      if (!m) continue;
      const url = normalizeUrl(m[0]);
      if (!articleIdsByLink.has(url)) articleIdsByLink.set(url, new Set());
      articleIdsByLink.get(url).add(String(row.id));
    }

    const counts = {};
    for (const [url, ids] of articleIdsByLink) {
      counts[url] = [...ids];
    }

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(counts, null, 2));
    console.info(`${articleIdsByLink.size} distinct collection link(s) found across ${result.rows.length} article(s) with a collection field.`);
    console.info(`${[...articleIdsByLink.values()].filter((ids) => ids.size === 1).length} of them are globally unique (used by exactly one article).`);
    console.info(`Written to ${outFile}`);
    process.exit(0);
  });
});
