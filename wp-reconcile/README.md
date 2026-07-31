# wp-reconcile

A standalone toolset that finds content edited or added directly in WordPress (weeklyosm.eu) after export, that was never captured back into osmbc, and backports it into osmbc's own `article` table. Built so osmbc becomes a reliable source of truth again ahead of replacing WordPress with a Hugo static site.

Nothing here is imported by `app.js`/`routes/*` - it can never run as part of the live server. It only ever reads osmbc's model layer (`model/blog.js`, `model/article.js`, `model/logModule.js`) the same way `export/export.js` and `import/createdb.js` already do, and only ever writes through a generated, human-reviewed SQL script - never directly.

## Why this exists

Editors have sometimes made last-minute fixes directly in WordPress after exporting from osmbc, so osmbc's stored data has drifted from what's actually published for a number of past issues (roughly WN272, when osmbc went live in Sept. 2015, onward). This tool:

1. Extracts the real, published WordPress content from a `mysqldump` of the WordPress database.
2. Extracts osmbc's own content for the same issues, reusing osmbc's actual render pipeline (`blog.buildPreviewExport`) rather than reimplementing it.
3. Diffs the two, ignoring WordPress's own cosmetic formatting quirks (self-closing tags, HTML entity re-encoding, `wpautop` paragraph handling), and ignoring anything not actually approved for release (see "closed languages" below).
4. Generates a reviewable SQL script + human-readable documentation that backports genuine WordPress-only edits into osmbc.

## Directory layout

Everything under this directory (`wp-reconcile/`) is source code and can be committed. All generated/extracted data lives outside it, at the repo root in `backport/` (gitignored - see `.gitignore`), split into:

- `backport/input/` - extracted data pulled from the WordPress dump (`wp/wp_posts/`, `wp/wp_1_posts/`) and from osmbc (`osmbc/`), one JSON file per issue.
- `backport/output/` - everything generated from that input: `reports/` (per-issue diff detail, `index.csv`, `summary.json`), plus `backport.sql`, `documentation.csv`, `aenderungen.csv` (a LibreOffice-ready spreadsheet), and the bilingual `migration-log-en.md`/`migration-log-de.md`.

Source layout:

```
wp-reconcile/
  README.md            - this file
  wp-extract/          - parses the WordPress dump into backport/input/wp/
    parseShortcode.js    reverse-parses the "[:xx]content[:yy]content[:]" bracket
                          convention osmbc itself produces for WP titles/bodies
    issueNumber.js        extracts the issue number from a WP post_title
    splitByAnchor.js      splits a rendered issue body into per-article
                          fragments via osmbc's own <li id="wn<issue>_<id>">
                          anchor convention (cheerio-based, handles nested lists)
    extractWpPosts.js     CLI: reads a local MariaDB import of the WP dump,
                          writes backport/input/wp/{wp_posts,wp_1_posts}/<issue>.json
  osmbc-extract/
    extractOsmbcIssue.js  CLI: reconstructs "what osmbc would have exported"
                          per issue via blog.buildPreviewExport, plus raw
                          markdown<LANG> values, change-log timestamps, and
                          close<LANG> status; writes backport/input/osmbc/<issue>.json
  diff-engine/
    normalizeHtml.js      canonicalizes HTML (html-to-text based) so cosmetic
                          WordPress formatting differences aren't false positives
  report/
    scanAndReport.js      compares every issue, writes backport/output/reports/
                          (index.csv, summary.json, per-issue diff detail .md)
  backport/
    htmlToMarkdown.js     converts real WordPress HTML to osmbc-style markdown,
                          reusing osmbc's own util/md_util.js:turndownService()
    generateBackport.js   generates backport.sql + documentation.csv +
                          aenderungen.csv from the report data
    generateMigrationLog.js
                          generates the bilingual editor-facing result summary
    migrate-to-beta.sh    refreshes osmbcbeta from osmbc, then applies backport.sql
    ADMIN-GUIDE.md        the technical runbook (setup, regeneration, validation,
                          applying to a database, repeated-run model)
  test/
    *.test.js, fixtures/  unit tests for the parsing/splitting modules, run with
                          `npx mocha --recursive wp-reconcile/test`
```

## Key facts baked into the design

- **Issue identity**: an osmbc "blog" is identified by `name`, format `WN<number>` (e.g. `WN825`); WordPress posts are matched to the same number via `issueNumber.js`.
- **Per-article matching**: osmbc's HTML export emits `<li id="wn<issue>_<articleId>">` per article, and this exact anchor survives in the real WordPress-published HTML - this is what makes per-article (not just per-issue) diffing possible. It did not exist yet in the earliest issues (roughly before WN283-305), so those show up as `not-comparable`, not `equal`.
- **`close<LANG>` matters**: a blog can have some languages closed (reviewed/released) while others are left unfinished for the same issue. Only closed languages are ever compared or backported - unreleased content must never be treated as a finding or published, regardless of what it looks like.
- **CZ is out of scope**: Czech is translated entirely outside osmbc (confirmed by the project owner), so it's excluded from every comparison and count.
- **"Only in osmbc" / "only in WordPress" counts are informational only**: the backport script never creates or deletes articles, it only overwrites `markdown<LANG>` on articles that exist and match by anchor id on both sides.
- **Safety**: every backported change is logged to osmbc's own `changes` audit table under the synthetic user `wp-backport`, in the exact shape `article.setAndSave()` produces. Writes are guarded by an optimistic-concurrency version check per article. The generated SQL is meant for human review and manual execution (see `backport/ADMIN-GUIDE.md`) - this tool never runs it itself, and never targets the live `osmbc` database directly (only a restored local copy or the `osmbcbeta` review database).

## Quick start

See `backport/ADMIN-GUIDE.md` for the full runbook (one-time setup, regenerating the backport, validating it, applying it). In short:

```bash
NODE_ENV=wpreconcile node wp-reconcile/wp-extract/extractWpPosts.js
NODE_ENV=wpreconcile node wp-reconcile/osmbc-extract/extractOsmbcIssue.js --from 272 --to <latest issue number>
node wp-reconcile/report/scanAndReport.js
NODE_ENV=wpreconcile node wp-reconcile/backport/generateBackport.js
node wp-reconcile/backport/generateMigrationLog.js
```
