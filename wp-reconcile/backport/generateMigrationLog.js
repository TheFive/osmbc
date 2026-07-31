#!/usr/bin/env node
// Generates the editor-facing, bilingual (EN + DE) result summary for a
// wp-reconcile run: how many articles changed/were only in osmbc/were only
// in WordPress, per language, plus a pointer to the detailed per-issue
// reports for anyone who wants to see the actual content differences.
// Reads wp-reconcile/data/reports/summary.json (from scanAndReport.js).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "..", "backport", "output");
const SUMMARY_PATH = path.join(OUT_DIR, "reports", "summary.json");

if (!fs.existsSync(SUMMARY_PATH)) {
  console.error(`Not found: ${SUMMARY_PATH} - run scanAndReport.js first.`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf8"));
const now = new Date().toISOString();
const range = summary.comparableIssueRange;

const langRows = Object.entries(summary.perLanguage)
  .filter(([, s]) => s.changed + s.onlyOsmbc + s.onlyWp > 0)
  .sort((a, b) => (b[1].changed + b[1].onlyOsmbc + b[1].onlyWp) - (a[1].changed + a[1].onlyOsmbc + a[1].onlyWp));

const totalChanged = langRows.reduce((sum, [, s]) => sum + s.changed, 0);

function table(headers) {
  let md = `| ${headers.join(" | ")} |\n|${headers.map(() => "---").join("|")}|\n`;
  for (const [lang, s] of langRows) {
    md += `| ${lang} | ${s.changed} | ${s.onlyOsmbc} | ${s.onlyWp} |\n`;
  }
  return md;
}

const en = `# wp-reconcile result summary (for editors)

Generated: ${now}

This summarizes a comparison between osmbc's own content and the real, published WordPress posts, for issues WN${range.min}-WN${range.max}. Only languages that were actually **closed** (reviewed/released) for a given issue were compared - unfinished/unreleased languages are never included, so nothing unapproved is ever reported here or backported.

CZ is excluded throughout (translated entirely outside osmbc).

## Summary

- ${summary.issuesComparable} issue(s) could be reliably compared (issues before ~WN283-305 can't be, see "Scope limits" below).
- ${summary.issuesEqual} issue(s) matched exactly, ${summary.issuesWithFindings} issue(s) had at least one finding.
- **${totalChanged} article/language combination(s) changed**: content that differs between osmbc and the real WordPress post (WordPress is treated as the correct, published version and gets backported into osmbc).
- **${summary.totals.onlyOsmbc} article/language combination(s) only in osmbc**: content osmbc has but that never made it into the published WordPress post. This is informational only - the backport does not delete or touch these, it only overwrites articles that exist and match on both sides.
- **${summary.totals.onlyWp} article/language combination(s) only in WordPress**: content published on WordPress with no matching article in osmbc at all. Also informational only, not created by the backport.

## Per-language breakdown

${table(["Language", "Changed", "Only in osmbc", "Only in WordPress"])}

## Individual content changes

Every changed article, side by side (osmbc vs. WordPress), is in \`wp-reconcile/data/reports/<issue>.md\` (one file per affected issue) and \`wp-reconcile/data/reports/index.csv\` (one row per issue, all issues). The exact old/new value that was backported for each article is in \`documentation.csv\`.

## Scope limits

- Issues before roughly WN283-305 can't be reliably compared at all: osmbc's per-article HTML anchor didn't exist yet in the real published WordPress posts from that era, so there is no structural way to match individual articles. These are excluded from every count above, not counted as "equal".
- "Only in osmbc" / "only in WordPress" reflect what could be matched by article id; they are not a definitive audit of every possible edit, just what this comparison method can detect.
`;

const de = `# wp-reconcile Ergebniszusammenfassung (für Editoren)

Erstellt: ${now}

Diese Zusammenfassung vergleicht osmbcs eigene Inhalte mit den echten, veröffentlichten WordPress-Beiträgen, für die Ausgaben WN${range.min}-WN${range.max}. Verglichen wurden nur Sprachen, die für die jeweilige Ausgabe tatsächlich **abgeschlossen** (redaktionell freigegeben) waren - unfertige/nicht freigegebene Sprachen sind nie enthalten, es wird also nichts nicht Genehmigtes gemeldet oder übernommen.

CZ ist durchgehend ausgeschlossen (wird komplett außerhalb von osmbc übersetzt).

## Zusammenfassung

- ${summary.issuesComparable} Ausgabe(n) konnten zuverlässig verglichen werden (Ausgaben vor ca. WN283-305 nicht, siehe "Grenzen" unten).
- ${summary.issuesEqual} Ausgabe(n) stimmten exakt überein, ${summary.issuesWithFindings} Ausgabe(n) hatten mindestens einen Fund.
- **${totalChanged} Artikel/Sprach-Kombination(en) geändert**: Inhalt, der zwischen osmbc und dem echten WordPress-Post abweicht (WordPress gilt als die korrekte, veröffentlichte Version und wird nach osmbc zurückübernommen).
- **${summary.totals.onlyOsmbc} Artikel/Sprach-Kombination(en) nur in osmbc**: Inhalt, den osmbc hat, der aber nie im veröffentlichten WordPress-Post gelandet ist. Rein informativ - der Backport löscht oder verändert das nicht, er überschreibt nur Artikel, die auf beiden Seiten existieren und übereinstimmen.
- **${summary.totals.onlyWp} Artikel/Sprach-Kombination(en) nur in WordPress**: Auf WordPress veröffentlichter Inhalt ohne passenden Artikel in osmbc. Ebenfalls rein informativ, wird vom Backport nicht angelegt.

## Aufschlüsselung pro Sprache

${table(["Sprache", "Geändert", "Nur in osmbc", "Nur in WordPress"])}

## Einzelne inhaltliche Änderungen

Jeder geänderte Artikel im direkten Vergleich (osmbc vs. WordPress) steht in \`wp-reconcile/data/reports/<issue>.md\` (eine Datei pro betroffener Ausgabe) und \`wp-reconcile/data/reports/index.csv\` (eine Zeile pro Ausgabe, alle Ausgaben). Der genaue alte/neue Wert pro übernommener Änderung steht in \`documentation.csv\`.

## Grenzen

- Ausgaben vor etwa WN283-305 lassen sich gar nicht zuverlässig vergleichen: osmbcs Artikel-Anker im HTML gab es in den echten veröffentlichten WordPress-Posts aus dieser Zeit noch nicht, es gibt also keine strukturelle Möglichkeit, einzelne Artikel zuzuordnen. Diese sind aus allen obigen Zahlen ausgeschlossen, nicht als "gleich" gezählt.
- "Nur in osmbc" / "nur in WordPress" spiegelt wider, was sich über die Artikel-ID zuordnen ließ; das ist keine abschließende Prüfung jeder denkbaren Änderung, sondern nur das, was diese Vergleichsmethode erkennen kann.
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "migration-log-en.md"), en);
fs.writeFileSync(path.join(OUT_DIR, "migration-log-de.md"), de);
console.info(`Written: ${path.join(OUT_DIR, "migration-log-en.md")}`);
console.info(`Written: ${path.join(OUT_DIR, "migration-log-de.md")}`);
