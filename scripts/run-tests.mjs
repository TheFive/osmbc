#!/usr/bin/env node
// Runs a test command with its own server port, database and temp directory,
// so several test runs (in different or the same worktree) don't collide.
//
// Usage: node scripts/run-tests.mjs [--keep] <command> [args...]
//
// - picks a free port, creates the database osmbc_test_<port> (CREATE DATABASE
//   is atomic, so it also acts as the lock between parallel runs)
// - passes OSMBC_TEST_PORT / OSMBC_TEST_DB / OSMBC_TEST_TMPDIR /
//   OSMBC_SYNC_STATE_FILE to the command (read by config.js and syncState.js)
// - drops the database and temp directory afterwards, also on Ctrl-C
//   (--keep leaves both for debugging)
// - prints a progress line about every 20 s, e.g.
//   "[ progress: 412/903 tests · 46 % of time · 2:10 of ~4:40 ]". It counts the
//   mocha spec reporter's result lines; the totals come from the last
//   successful run of the same command (.test-stats.json, gitignored)
//
// config.test.yaml stays untouched; its postgres section is only used for the
// admin connection that creates and drops the run's database.

import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { load as yamlLoad } from "js-yaml";
import pg from "pg";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const keep = args[0] === "--keep";
if (keep) args.shift();
if (args.length === 0) {
  console.error("Usage: node scripts/run-tests.mjs [--keep] <command> [args...]");
  process.exit(2);
}

function adminConfig() {
  const conf = yamlLoad(fs.readFileSync(path.join(rootDir, "config.test.yaml"), "utf8")).postgres;
  // same environment overrides as model/db.js
  return {
    user: process.env.POSTGRES_USER || conf.username,
    password: process.env.POSTGRES_PASSWORD || conf.password,
    host: process.env.POSTGRES_HOST || conf.server,
    port: process.env.POSTGRES_PORT || conf.port,
    database: conf.database
  };
}

async function adminQuery(sql) {
  const client = new pg.Client(adminConfig());
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function reserveRun() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const port = await freePort();
    const dbName = "osmbc_test_" + port;
    try {
      await adminQuery("CREATE DATABASE " + dbName);
      return { port, dbName };
    } catch (err) {
      if (err.code !== "42P04") throw err; // 42P04: duplicate_database, try another port
    }
  }
  throw new Error("Could not reserve a test database after 10 attempts");
}

const { port, dbName } = await reserveRun();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "osmbc-test-" + port + "-"));
console.log("Test run: port " + port + ", database " + dbName + ", tmp " + tmpDir);

let cleanedUp = false;
async function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (keep) {
    console.log("--keep: leaving database " + dbName + " and " + tmpDir);
    return;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  try {
    await adminQuery("DROP DATABASE IF EXISTS " + dbName + " WITH (FORCE)");
  } catch (err) {
    console.error("Could not drop test database " + dbName + ": " + err.message);
  }
}

const statsFile = path.join(rootDir, ".test-stats.json");
const statsKey = args.join(" ");
function readStats() {
  try {
    return JSON.parse(fs.readFileSync(statsFile, "utf8"));
  } catch (err) {
    return {};
  }
}
const lastRun = readStats()[statsKey];

function minutes(ms) {
  const s = Math.round(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

const startTime = Date.now();
let testsDone = 0;
let summaryReached = false; // after "N passing" the failures are listed again
function countLine(line) {
  // eslint-disable-next-line no-control-regex
  line = line.replace(/\x1b\[[0-9;]*m/g, "");
  if (summaryReached) return;
  if (/^\s+\d+ passing/.test(line)) summaryReached = true;
  else if (/^\s+(✔|✓|- |\d+\) )/.test(line)) testsDone++;
}
function progressLine() {
  const elapsed = Date.now() - startTime;
  let text = "[ progress: " + testsDone;
  if (lastRun) {
    text += "/" + lastRun.tests + " tests · " +
      Math.min(99, Math.round(100 * elapsed / lastRun.ms)) + " % of time · " +
      minutes(elapsed) + " of ~" + minutes(lastRun.ms);
  } else {
    text += " tests · " + minutes(elapsed) + " (no earlier run to compare)";
  }
  return text + " ]\n";
}

const child = spawn(args[0], args.slice(1), {
  stdio: ["inherit", "pipe", "inherit"],
  env: {
    ...process.env,
    // stdout is a pipe now: keep mocha's colours when the terminal has them
    ...(process.stdout.isTTY ? { MOCHA_COLORS: "1" } : {}),
    OSMBC_TEST_PORT: String(port),
    OSMBC_TEST_DB: dbName,
    OSMBC_TEST_TMPDIR: tmpDir,
    OSMBC_SYNC_STATE_FILE: path.join(tmpDir, ".sync-state.json")
  }
});

// pass the output through and insert the progress line between lines
let partial = "";
let progressDue = false;
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  const lines = (partial + chunk.toString()).split("\n");
  partial = lines.pop();
  lines.forEach(countLine);
  if (progressDue && partial === "" && !summaryReached) {
    progressDue = false;
    process.stdout.write(progressLine());
  }
});
const progressTimer = setInterval(() => {
  if (summaryReached) return;
  if (partial === "") process.stdout.write(progressLine());
  else progressDue = true;
}, 20000);

function saveStats(code) {
  if (code !== 0 || testsDone === 0) return;
  const stats = readStats();
  stats[statsKey] = { tests: testsDone, ms: Date.now() - startTime };
  try {
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2) + "\n");
  } catch (err) {
    console.error("Could not write " + statsFile + ": " + err.message);
  }
}

// Ctrl-C reaches the child via the process group, SIGTERM is forwarded;
// either way wait for the child to exit, then clean up
process.on("SIGINT", () => {});
process.on("SIGTERM", () => child.kill("SIGTERM"));

// "close" waits until all output is read, "exit" may come earlier
child.on("close", async (code, signal) => {
  clearInterval(progressTimer);
  saveStats(code);
  await cleanup();
  process.exit(code ?? (signal ? 1 : 0));
});
