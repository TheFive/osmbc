#!/usr/bin/env node
// Checks the c8 coverage per top-level directory against coverage-thresholds.json.
//
// Usage: node tools/coverage-check.mjs [--write]
//
// - reads coverage/coverage-summary.json (c8 reporter "json-summary",
//   written by `npm run test:coverage`)
// - sums lines/branches/functions per top-level directory (files in the
//   repo root count as "(root)")
// - prints a table and, in GitHub Actions, adds it to the job summary
// - exits 1 if a directory falls below its threshold
// - --write stores the current values as new thresholds, rounded down and
//   minus one point of headroom (the UI tests don't hit exactly the same
//   code in every run); use it after tests were added, so the level can't
//   silently drop again
//
// The thresholds are a floor ("don't get worse"), not a target.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const summaryFile = path.join(rootDir, "coverage", "coverage-summary.json");
const thresholdFile = path.join(rootDir, "coverage-thresholds.json");
const metrics = ["lines", "branches", "functions"];
const write = process.argv.includes("--write");

if (!fs.existsSync(summaryFile)) {
  console.error("Missing " + path.relative(rootDir, summaryFile) + ", run `npm run test:coverage` first.");
  process.exit(2);
}
const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));

const groups = {};
for (const [file, data] of Object.entries(summary)) {
  if (file === "total") continue;
  const parts = path.relative(rootDir, file).split(path.sep);
  const group = parts.length > 1 ? parts[0] : "(root)";
  groups[group] ??= Object.fromEntries(metrics.map((m) => [m, { covered: 0, total: 0 }]));
  for (const m of metrics) {
    groups[group][m].covered += data[m].covered;
    groups[group][m].total += data[m].total;
  }
}

const HEADROOM = 1;

function pct(c) {
  return c.total === 0 ? 100 : (100 * c.covered) / c.total;
}

function floorWithHeadroom(value) {
  return Math.max(0, Math.floor(value) - HEADROOM);
}

const names = Object.keys(groups).sort();

if (write) {
  const out = {};
  for (const g of names) {
    out[g] = Object.fromEntries(metrics.map((m) => [m, floorWithHeadroom(pct(groups[g][m]))]));
  }
  fs.writeFileSync(thresholdFile, JSON.stringify(out, null, 2) + "\n");
  console.log("Wrote " + path.relative(rootDir, thresholdFile));
  process.exit(0);
}

const thresholds = fs.existsSync(thresholdFile) ? JSON.parse(fs.readFileSync(thresholdFile, "utf8")) : {};
const failures = [];
const canRaise = [];
const rows = [];

for (const g of names) {
  const cells = metrics.map((m) => {
    const value = pct(groups[g][m]);
    const min = thresholds[g]?.[m];
    let mark = "";
    if (min !== undefined && value < min) {
      failures.push(g + " " + m + " " + value.toFixed(1) + " % < " + min + " %");
      mark = " ❌";
    } else if (min !== undefined && floorWithHeadroom(value) > min) {
      canRaise.push(g + " " + m);
    }
    return value.toFixed(1) + (min !== undefined ? " / " + min : "") + mark;
  });
  rows.push([g, ...cells]);
}
const total = summary.total;
rows.push(["**total**", ...metrics.map((m) => total[m].pct.toFixed(1))]);

const header = ["directory", ...metrics.map((m) => m + " % / min")];
const table = [
  "| " + header.join(" | ") + " |",
  "|" + header.map((h, i) => (i === 0 ? "---" : "---:")).join("|") + "|",
  ...rows.map((r) => "| " + r.join(" | ") + " |")
].join("\n");

console.log("\nCoverage per directory (c8)\n\n" + table + "\n");
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "## Coverage per directory\n\n" + table + "\n\n");
}

const missing = names.filter((g) => !thresholds[g]);
if (missing.length > 0) {
  console.log("No threshold for: " + missing.join(", ") + " (run with --write to add them)");
}
if (canRaise.length > 0) {
  console.log("Above threshold, could be raised with --write: " + canRaise.join(", "));
}
if (failures.length > 0) {
  console.error("\nCoverage below threshold:\n  " + failures.join("\n  "));
  process.exit(1);
}
