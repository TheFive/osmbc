#!/usr/bin/env node
// CLI: reads published posts from a local MariaDB import of the WordPress
// dump (WP Data/weeklyDump/*.gz, imported via mysql/mariadb CLI - see
// wp-reconcile/README.md) and writes one normalized JSON file per issue
// under wp-reconcile/data/wp/<table>/<issue>.json.
//
// This never touches osmbc's own data or config - it only ever reads from
// the local wpblog MariaDB database.

import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { program } from "commander";
import mysql from "mysql2/promise";

import { parseShortcode } from "./parseShortcode.js";
import { issueNumberFromOldTitle, issueNumberFromNewTitle } from "./issueNumber.js";
import { splitByAnchor } from "./splitByAnchor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "backport", "input", "wp");

program
  .option("--socket <path>", "MariaDB unix socket path", process.env.WPRECONCILE_DB_SOCKET || "/tmp/mysql.sock")
  .option("--user <user>", "MariaDB user", process.env.WPRECONCILE_DB_USER || os.userInfo().username)
  .option("--password <password>", "MariaDB password", process.env.WPRECONCILE_DB_PASSWORD || "")
  .option("--database <database>", "MariaDB database", process.env.WPRECONCILE_DB_NAME || "wpblog")
  .option("--limit <n>", "only process the first N rows per table (for spot-checks)", (v) => parseInt(v, 10))
  .parse(process.argv);

const options = program.opts();

const TABLES = [
  {
    name: "wp_posts",
    // current weeklyosm.eu blog: multi-language [:xx]...[:] bracket titles/bodies
    multiLanguage: true
  },
  {
    name: "wp_1_posts",
    // old blog.openstreetmap.de blog: plain German-only titles/bodies
    multiLanguage: false
  }
];

function extractIssue(row, multiLanguage) {
  const warnings = [];
  const issue = multiLanguage
    ? issueNumberFromNewTitle(row.post_title)
    : issueNumberFromOldTitle(row.post_title);

  if (issue === null) warnings.push("could not extract issue number from title");

  let perLanguage;
  if (multiLanguage) {
    const titleParsed = parseShortcode(row.post_title);
    const bodyParsed = parseShortcode(row.post_content);
    warnings.push(...titleParsed.warnings.map((w) => `title: ${w}`));
    warnings.push(...bodyParsed.warnings.map((w) => `body: ${w}`));

    perLanguage = {};
    const langs = new Set([...Object.keys(titleParsed.languages), ...Object.keys(bodyParsed.languages)]);
    for (const lang of langs) {
      const body = bodyParsed.languages[lang] || "";
      const { articles, warnings: anchorWarnings } = splitByAnchor(body);
      perLanguage[lang] = {
        title: titleParsed.languages[lang] || "",
        body,
        articles
      };
      warnings.push(...anchorWarnings.map((w) => `body[${lang}]: ${w}`));
    }
  } else {
    const { articles, warnings: anchorWarnings } = splitByAnchor(row.post_content || "");
    warnings.push(...anchorWarnings.map((w) => `body: ${w}`));
    perLanguage = {
      de: {
        title: row.post_title,
        body: row.post_content,
        articles
      }
    };
  }

  return {
    issue,
    postId: row.ID,
    postDate: row.post_date,
    postModified: row.post_modified,
    perLanguage,
    warnings
  };
}

async function run() {
  const connection = await mysql.createConnection({
    socketPath: options.socket,
    user: options.user,
    password: options.password,
    database: options.database
  });

  const summary = { generatedAt: new Date().toISOString(), tables: {} };

  for (const table of TABLES) {
    const limitClause = options.limit ? `LIMIT ${options.limit}` : "";
    const [rows] = await connection.execute(
      `SELECT ID, post_title, post_content, post_date, post_modified
       FROM \`${table.name}\`
       WHERE post_type = 'post' AND post_status = 'publish'
       ORDER BY post_date ASC
       ${limitClause}`
    );

    const outDir = path.join(dataDir, table.name);
    fs.mkdirSync(outDir, { recursive: true });

    let withIssue = 0;
    let withoutIssue = 0;
    let withWarnings = 0;

    for (const row of rows) {
      const result = extractIssue(row, table.multiLanguage);
      if (result.issue !== null) withIssue++; else withoutIssue++;
      if (result.warnings.length > 0) withWarnings++;

      const fileName = result.issue !== null ? `${result.issue}.json` : `unmatched-${result.postId}.json`;
      fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(result, null, 2));
    }

    summary.tables[table.name] = { totalRows: rows.length, withIssue, withoutIssue, withWarnings };
    console.info(`${table.name}: ${rows.length} rows, ${withIssue} matched an issue, ${withoutIssue} unmatched, ${withWarnings} produced warnings`);
  }

  fs.writeFileSync(path.join(dataDir, "_summary.json"), JSON.stringify(summary, null, 2));
  await connection.end();

  mergeGermanFromOldBlog(summary);
  fs.writeFileSync(path.join(dataDir, "_summary.json"), JSON.stringify(summary, null, 2));
}

// During the overlap era (roughly WN219-523), weeklyosm.eu (wp_posts) and the
// old German-only blog.openstreetmap.de (wp_1_posts) were published in
// parallel for the same issue number. wp_posts' own "de" entry is frequently
// just a short stub/redirect pointing readers to the old blog (verified:
// 84 of 236 issues in that range have a wp_posts "de" body under 1000
// characters, all 84 with a substantially larger wp_1_posts counterpart
// available) - comparing osmbc's German content against that stub instead
// of the real published German post produced large false "only in osmbc"
// findings. Whenever wp_1_posts has richer content for the same issue
// number, its "de" entry replaces wp_posts' own, tagged with `source` for
// traceability.
function mergeGermanFromOldBlog(summary) {
  const wpPostsDir = path.join(dataDir, "wp_posts");
  const wp1PostsDir = path.join(dataDir, "wp_1_posts");
  if (!fs.existsSync(wp1PostsDir)) return;

  let merged = 0;
  for (const file of fs.readdirSync(wpPostsDir)) {
    if (!file.endsWith(".json") || file === "_summary.json" || file.startsWith("unmatched-")) continue;
    const wp1File = path.join(wp1PostsDir, file);
    if (!fs.existsSync(wp1File)) continue;

    const wpData = JSON.parse(fs.readFileSync(path.join(wpPostsDir, file), "utf8"));
    const wp1Data = JSON.parse(fs.readFileSync(wp1File, "utf8"));
    const oldDe = wp1Data.perLanguage && wp1Data.perLanguage.de;
    if (!oldDe) continue;

    const currentDe = wpData.perLanguage.de;
    const currentLen = currentDe ? currentDe.body.length : 0;
    if (oldDe.body.length > currentLen) {
      wpData.perLanguage.de = { ...oldDe, source: "wp_1_posts" };
      fs.writeFileSync(path.join(wpPostsDir, file), JSON.stringify(wpData, null, 2));
      merged++;
    }
  }
  summary.germanMergedFromOldBlog = merged;
  console.info(`German content substituted from wp_1_posts (old blog) for ${merged} issue(s) where it was richer than wp_posts' own.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
