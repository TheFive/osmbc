#!/usr/bin/env node
// Lists candidates for dead code: functions that no test executed AND
// whose name appears nowhere else in the code.
//
// Usage: npm run test:coverage && npm run coverage:dead
//
// - reads coverage/lcov.info (written by `npm run test:coverage`)
// - takes every function with 0 calls in the tests (FNDA:0)
// - searches its name as a whole word in the code (application, views,
//   client scripts, tools), outside strings and // comments; the line
//   that defines it and plain export lines (`name: name,`,
//   `export { name }`, `x.name = name;`) don't count
//
// This is NOT the call tree of production: a function called through a
// computed name (`receiver[method](...)`, an action table, a library
// callback) is listed although it is used, and a dead function with a
// common name (`count`) is missed. Check every hit before deleting it.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lcovFile = path.join(rootDir, "coverage", "lcov.info");
const searchDirs = ["model", "routes", "notification", "render", "util", "wiki", "views", "public/javascripts",
  "genstaticpage", "bin", "import", "export", "tools", "wp-reconcile"];
const searchFiles = ["app.js", "config.js"];
const extensions = [".js", ".mjs", ".pug"];

if (!fs.existsSync(lcovFile)) {
  console.error("Missing coverage/lcov.info, run `npm run test:coverage` first.");
  process.exit(2);
}

function uncoveredFunctions() {
  const result = [];
  let file = null;
  let lines = {};
  for (const line of fs.readFileSync(lcovFile, "utf8").split("\n")) {
    if (line.startsWith("SF:")) {
      file = path.relative(rootDir, line.slice(3));
      lines = {};
    } else if (line.startsWith("FN:")) {
      const [lineNo, name] = line.slice(3).split(/,(.*)/s);
      lines[name] = Number(lineNo);
    } else if (line.startsWith("FNDA:0,")) {
      const name = line.slice(7);
      if (/^[A-Za-z_$][\w$]*$/.test(name)) result.push({ file, name, line: lines[name] });
    }
  }
  return result;
}

function codeFiles() {
  const files = searchFiles.filter((f) => fs.existsSync(path.join(rootDir, f)));
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(rootDir, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(relative);
      else if (extensions.includes(path.extname(entry.name)) && !entry.name.includes(".min.")) files.push(relative);
    }
  };
  for (const dir of searchDirs) if (fs.existsSync(path.join(rootDir, dir))) walk(dir);
  return files.map((f) => ({ file: f, lines: fs.readFileSync(path.join(rootDir, f), "utf8").split("\n") }));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isExportLine(text, name) {
  const t = text.trim();
  const n = escapeRegExp(name);
  return t === `${name}: ${name},` || t === `${name}: ${name}` ||
    new RegExp(`^export\\s*\\{[^}]*\\b${n}\\b`).test(t) ||
    new RegExp(`^\\w+\\.${n}\\s*=\\s*${n};?$`).test(t);
}

// A name inside a string or comment is no call (debug("getCategory")).
function withoutStringsAndComments(text) {
  return text.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "\"\"").replace(/\/\/.*$/, "");
}

function usedElsewhere(fn, code) {
  const word = new RegExp(`\\b${escapeRegExp(fn.name)}\\b`);
  for (const { file, lines } of code) {
    for (let i = 0; i < lines.length; i++) {
      if (!word.test(withoutStringsAndComments(lines[i]))) continue;
      if (file === fn.file && i + 1 === fn.line) continue;
      if (file === fn.file && isExportLine(lines[i], fn.name)) continue;
      return true;
    }
  }
  return false;
}

const code = codeFiles();
const candidates = uncoveredFunctions().filter((fn) => !usedElsewhere(fn, code));
if (candidates.length === 0) {
  console.log("No candidates: every function that no test runs is named somewhere else in the code.");
} else {
  console.log("Not run by any test and not named anywhere else in the code -");
  console.log("candidates for dead code, check each before deleting:\n");
  for (const fn of candidates) console.log(`  ${fn.file}:${fn.line ?? "?"}  ${fn.name}`);
}
