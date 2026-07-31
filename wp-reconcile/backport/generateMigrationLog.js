#!/usr/bin/env node
// Generates a short, bilingual (EN + DE) migration log summarizing what a
// wp-reconcile backport run did, from documentation.csv (produced by
// generateBackport.js). Meant to be regenerated each time the backport is
// (re)run, so there is a dated record of each migration pass.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "output");
const CSV_PATH = path.join(OUT_DIR, "documentation.csv");

function parseCsv(text) {
  // Full character-scan parser (not a per-line split): newValue/oldValue can
  // contain real embedded newlines (e.g. markdown lists from htmlToMarkdown),
  // so a logical row can span multiple physical lines inside quoted fields.
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') { inQuotes = false; } else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur); cur = "";
    } else if (ch === "\n") {
      row.push(cur); cur = "";
      rows.push(row); row = [];
    } else if (ch === "\r") {
      // skip
    } else {
      cur += ch;
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur); rows.push(row); }

  return rows.slice(1).map((fields) => ({
    issue: fields[0], articleId: fields[1], category: fields[2], lang: fields[3]
  }));
}

if (!fs.existsSync(CSV_PATH)) {
  console.error(`Not found: ${CSV_PATH} - run generateBackport.js first.`);
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
const issues = new Set(rows.map((r) => r.issue));
const articles = new Set(rows.map((r) => r.articleId));
const byLang = {};
for (const r of rows) byLang[r.lang] = (byLang[r.lang] || 0) + 1;

const issueNumbers = [...issues].map((i) => parseInt(i.replace(/^WN/i, ""), 10)).filter((n) => !isNaN(n));
const minIssue = Math.min(...issueNumbers);
const maxIssue = Math.max(...issueNumbers);
const now = new Date().toISOString();

const langLines = Object.entries(byLang)
  .sort((a, b) => b[1] - a[1])
  .map(([lang, count]) => `- ${lang}: ${count}`)
  .join("\n");

const en = `# wp-reconcile migration log

Generated: ${now}

## What this run did

1. Copied the content tables (\`blog\`, \`article\`, \`changes\`) from \`osmbc\` to \`osmbcbeta\` on the production server, replacing osmbcbeta's previous content entirely.
2. Applied ${rows.length} content correction(s) to \`osmbcbeta\`, backporting WordPress-only edits found for issues WN${minIssue}-WN${maxIssue} that were never captured in osmbc.
3. Every correction was logged to the \`changes\` audit table under the synthetic user \`wp-backport\`, in the same format osmbc's own edit history uses (queryable later via \`select * from changes where data->>'user'='wp-backport'\`).

## Scope

- ${issues.size} issue(s), ${articles.size} article(s) affected.
- Language CZ excluded throughout (translated entirely outside osmbc, confirmed out of scope).
- Full per-change detail: see \`documentation.csv\` (issue, article id, category, language, old value, new value).

## Changes per language

${langLines}

## Review

This was applied to \`osmbcbeta\`, not to the live \`osmbc\` production database. Please review the results in osmbcbeta (e.g. via the app pointed at that database) before any of this is promoted further. If corrections are needed, report them back so the backport generation itself can be adjusted and this whole migration re-run from a clean slate - do not hand-edit osmbcbeta directly, since the next run will overwrite it completely.
`;

const de = `# wp-reconcile Migrationsprotokoll

Erstellt: ${now}

## Was in diesem Lauf gemacht wurde

1. Die Inhaltstabellen (\`blog\`, \`article\`, \`changes\`) wurden von \`osmbc\` nach \`osmbcbeta\` auf dem Produktionsserver kopiert und haben den bisherigen Inhalt von osmbcbeta vollständig ersetzt.
2. ${rows.length} inhaltliche Korrektur(en) wurden auf \`osmbcbeta\` angewendet - das sind WordPress-only-Änderungen für die Ausgaben WN${minIssue}-WN${maxIssue}, die nie in osmbc erfasst wurden.
3. Jede Korrektur wurde in der \`changes\`-Protokolltabelle unter dem synthetischen Nutzer \`wp-backport\` dokumentiert, im selben Format wie osmbcs eigene Änderungshistorie (später abfragbar über \`select * from changes where data->>'user'='wp-backport'\`).

## Umfang

- ${issues.size} Ausgabe(n), ${articles.size} Artikel betroffen.
- Sprache CZ durchgehend ausgeschlossen (wird komplett außerhalb von osmbc übersetzt, wie besprochen).
- Vollständige Details pro Änderung: siehe \`documentation.csv\` (Ausgabe, Artikel-ID, Kategorie, Sprache, alter Wert, neuer Wert).

## Änderungen pro Sprache

${langLines}

## Review

Das wurde auf \`osmbcbeta\` angewendet, nicht auf die echte \`osmbc\`-Produktionsdatenbank. Bitte die Ergebnisse in osmbcbeta prüfen (z. B. über die App, die gegen diese Datenbank läuft), bevor irgendetwas davon weiter übernommen wird. Falls Korrekturen nötig sind, bitte zurückmelden, damit die Backport-Erzeugung selbst angepasst und die gesamte Migration danach neu (von einem sauberen Stand aus) durchlaufen werden kann - osmbcbeta bitte nicht von Hand bearbeiten, da der nächste Lauf sie komplett überschreibt.
`;

fs.writeFileSync(path.join(OUT_DIR, "migration-log-en.md"), en);
fs.writeFileSync(path.join(OUT_DIR, "migration-log-de.md"), de);
console.info(`Written: ${path.join(OUT_DIR, "migration-log-en.md")}`);
console.info(`Written: ${path.join(OUT_DIR, "migration-log-de.md")}`);
