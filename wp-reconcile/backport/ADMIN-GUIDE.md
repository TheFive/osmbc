# wp-reconcile backport - admin guide

Audience: admins running the backport. For the editor-facing result summary, see `output/migration-log-en.md` / `output/migration-log-de.md` (regenerated each run).

## What this does

Finds content that was edited or added directly in WordPress after export and was never captured back into osmbc, and backports it into osmbc's `article` table - so osmbc becomes the reliable source of truth again ahead of the WordPress-to-Hugo cutover.

Scope:
- Issues WN272 onward (osmbc's own start date) through whatever the WordPress dump covers.
- CZ is excluded (translated entirely outside osmbc - confirmed out of scope by the project owner).
- Only `close<LANG> === true` languages are considered per issue. A language left unfinished ("hanging", never closed) for a given issue is never compared or backported, even if it happens to differ from WordPress - it was never approved for release by the editorial team.
- Cosmetic WordPress-only formatting (self-closing tags, HTML entity re-encoding, wpautop paragraph handling) is normalized out and never treated as a difference.

## One-time setup

1. Local MariaDB with the WordPress dump imported (`WP Data/weeklyDump/*.gz`) - see repo root README/history for the import commands.
2. A recent `pg_dump` of the production `osmbc` database, restored locally (e.g. into `osmbc_prod_copie`).
3. `config.wpreconcile.yaml` (gitignored, like `config.development.yaml`/`config.production.yaml`) pointing `postgres.database` at that local restored copy. `maillog_directory` must point at a directory that exists locally (e.g. `.`).

## Regenerating the backport (whenever the WordPress dump or the production DB copy changes)

```bash
NODE_ENV=wpreconcile node wp-reconcile/wp-extract/extractWpPosts.js
NODE_ENV=wpreconcile node wp-reconcile/osmbc-extract/extractOsmbcIssue.js --from 272 --to <latest issue number>
node wp-reconcile/report/scanAndReport.js
NODE_ENV=wpreconcile node wp-reconcile/backport/generateBackport.js
node wp-reconcile/backport/generateMigrationLog.js
```

Outputs land in `wp-reconcile/data/reports/` (per-issue diff detail, `index.csv`, `summary.json`) and `wp-reconcile/backport/output/` (`backport.sql`, `documentation.csv`, `migration-log-en.md`, `migration-log-de.md`). All gitignored - review locally, do not commit.

## Applying to a database

**Always validate before a real run.** Wrap `backport.sql` in a transaction and swap the trailing `COMMIT;` for `ROLLBACK;`, run it, check for `ERROR` lines and confirm every `UPDATE` affected exactly 1 row (0 rows means the version guard rejected it - see below).

**Local review pass** (recommended before touching the production server at all):
```bash
createdb osmbcbeta_local          # or reuse/refresh an existing one
pg_dump -d osmbc_prod_copie | psql -d osmbcbeta_local
psql -d osmbcbeta_local -f wp-reconcile/backport/output/backport.sql
```

**Production run** (refreshes `osmbcbeta` from `osmbc`, then applies the backport - see the script header for env vars, defaults assume host `localhost`, user `pm2`, matching the production role that owns these tables and does **not** have CREATEDB/superuser):
```bash
wp-reconcile/backport/migrate-to-beta.sh
```
This only ever targets `osmbcbeta`, never `osmbc` directly, and asks for confirmation before wiping `osmbcbeta`'s `blog`/`article`/`changes` tables. Promoting anything from `osmbcbeta` to the live `osmbc` is a separate, manual, deliberate step - out of scope for this tooling.

## Repeated runs / review cycle

Every run of `migrate-to-beta.sh` fully wipes and reloads `osmbcbeta`'s content tables from `osmbc`, then re-applies the current `backport.sql`. **Never hand-edit `osmbcbeta` directly** - the next run overwrites it completely. If the editorial team's review of `osmbcbeta` turns up problems (wrong corrections, missing cases, false positives), report them back so the backport *generation logic* gets adjusted, then re-run the whole pipeline from a clean slate.

## Safety properties

- Every applied change is logged to the `changes` audit table under the synthetic user `wp-backport`, in the exact shape `article.setAndSave()` itself produces - fully attributable and queryable later (`select * from changes where data->>'user'='wp-backport'`).
- Each article's changed fields are combined into a single `UPDATE ... WHERE id = ... AND version = <snapshot>`, so a version conflict (the article was edited again since the backport was generated) fails that one `UPDATE` closed rather than silently overwriting newer work.
- The real WordPress HTML is converted to markdown via osmbc's own `util/md_util.js:turndownService()` (the same pipeline used elsewhere in the app), so the result matches what an editor would have typed, not a generic HTML-to-text dump.
- Nothing in this tool is wired into `app.js`/`routes/*` - it can never run as part of the live server.

## Known scope limitations

- Issues before ~WN283-305 can't be reliably compared: osmbc's `<li id="wn<issue>_<id>">` per-article anchor didn't exist yet in the real published WordPress HTML for that era, so there's no structural way to match articles 1:1. These show up as `not-comparable` in `index.csv`, not `equal`.
- "Articles only in osmbc" / "only in WordPress" counts (see `summary.json`, `documentation.csv`) are informational only - the backport script never creates or deletes articles, it only overwrites `markdown<LANG>` on articles that exist and match on both sides.
- `wp_postmeta` (e.g. featured images) was not part of the WordPress dump - irrelevant to text/markdown backport, but a gap if image metadata is ever needed.
