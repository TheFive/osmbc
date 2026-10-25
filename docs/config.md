# Configuration (`config.<env>.yaml`)

OSMBC's whole runtime configuration is loaded by [config.js](../config.js)
from a single per-environment file at the repo root, plus (development
only) an optional per-branch overlay. This document covers the loading
mechanism and the shape of that file; for the two config sections with
their own detailed reference, see [docs/API.md](API.md) (`apiKeys`) and
[docs/export-profiles.md](export-profiles.md) (`ExportProfiles`).

## Which file gets loaded

`config.js` picks the base name from `NODE_ENV` (`development` if unset):

```
config.<NODE_ENV>.yaml   (checked first)
config.<NODE_ENV>.yml
config.<NODE_ENV>.json
```

resolved relative to the repo root (`config.js`'s own directory), and reads
the first one that exists. Known environments in this codebase:

| `NODE_ENV` | File | Tracked in git? |
|---|---|---|
| `development` | `config.development.yaml` | **No** — gitignored, per-machine/per-worktree (local DB credentials, ports, OAuth secrets) |
| `test` | `config.test.yaml` | **Yes** — the only config file committed to the repo; `npm test` and CI always use this one |
| `production` | `config.production.yaml` | **No** — lives only on the real server |
| any other custom name, e.g. `prodcopie` | `config.<name>.yaml` | **No** — see below |

Missing file for the resolved `NODE_ENV` is fatal: `config.js` logs an
error and calls `process.exit(1)` (see `initialise()`).

### `NODE_ENV=test` has no branch overlay, and always points at the same DB

`config.test.yaml` names fixed database/table names, and the test
bootstrap (`test/testutil.js` `clearDB`) drops/recreates those tables on
(almost) every test file. Running the test suite from two worktrees against
the same local Postgres server **at the same time is not safe** — they'd
race on the same tables.

### Custom `NODE_ENV` values for a second local "side"

Nothing in `config.js` restricts `NODE_ENV` to `development`/`test`/
`production` — any value works as long as a matching `config.<value>.yaml`
exists. This is how a worktree gets a second, independent local database
pointer without a second checkout: e.g. `config.prodcopie.yaml`
(`NODE_ENV=prodcopie`) is a full copy of `config.development.yaml` with
only `postgres.database` (and usually `serverport`/`url`) changed, used to
give a CLI tool a "local" side reading from a different local database than
whatever dev server happens to be running on port 3000 (see
`wp-reconcile/blog-sync-merger/syncBlog.js` usage in `CLAUDE.local.md`).
Such a file never runs its own dev server unless you explicitly start one
with that `NODE_ENV`.

## The branch overlay (`NODE_ENV=development` only)

After loading the base `config.development.yaml`, `config.js` additionally:

1. Runs `git rev-parse --abbrev-ref HEAD` to get the current branch name.
2. Replaces the **first** `/` in that name with `_` (`String.replace` with
   a plain string pattern only ever replaces the first match — a branch
   name with more than one `/`, e.g. `feature/foo/bar`, becomes
   `feature_foo/bar`, not `feature_foo_bar`).
3. Looks for `config.<branch-with-underscore>.{yaml,yml,json}` — resolved
   relative to **`process.cwd()`** (the directory the process was started
   from), *not* `__dirname` like the base file. In practice these are
   usually the same (the repo root), but a process started from elsewhere
   would look for the branch file there instead.
4. If found, merges it into the base config with a **shallow, top-level
   key replace** — `configuration[k] = configBranch[k]` for every key `k`
   in the branch file. Supplying `postgres` in the branch file replaces the
   *entire* `postgres` object, not just one sub-key inside it.
5. If not found, logs "No additional file config.\<branch>.{yaml,yml,json}"
   and continues with just the base config — not an error.

This is how parallel worktrees on different branches can each point at
their own local database/port from a shared base config, without touching
it or each other. See `reference_local_dev_databases` /
`project_second_worktree_hugo_export` in the project's cross-session memory
for concrete examples of this pattern in use.

## Reading a value: `config.getValue(key, [subkey], [options])`

```js
import config from "../config.js";
const apiKeys = config.getValue("apiKeys", { mustExist: true });
const ceiling = config.getValue("blogSyncReplaceMaxBlogNumber", { default: 271 });
const port = config.getValue("postgres", "port");   // subkey form
```

`options`:

| Option | Effect |
|---|---|
| `default` | Value returned when the key is absent from the config file. |
| `mustExist` | Logs an error and `process.exit(1)` if the resolved value is still `undefined` after `default`. |
| `checkFunction` | A predicate run against the resolved value; returning `false` is fatal (same exit behavior). |
| `type` | Asserts `typeof result === type`; mismatch is fatal. |
| `deprecated` | Logs an error (and, oddly, also exits — see `config.js`) if the key is present at all; use to flag a key that should no longer be set. |

A handful of values also have a small dedicated accessor instead of a raw
`getValue` call: `config.getServerPort()`, `config.getServerKey()`,
`config.getServerCert()`, `config.htmlRoot()`, `config.url()`,
`config.getPGString()` (built from `postgres.*`, see below).

## Config sections (as seen in `config.development.yaml`/`config.test.yaml`)

Both files carry inline comments for most of this already — this table is
a map of *where to look*, not a restatement of every field.

| Key | Purpose |
|---|---|
| `serverport`, `serverkey`, `servercert` | HTTP(S) server port + TLS cert/key paths. |
| `postgres` | `{database, username, password, server, port, connectstr?, postgresLogStatements?}` — `connectstr`, if set, overrides the assembled connection string entirely. `test` env also sets `postgres.initialise: true` (creates the DB/tables before running). |
| `url`, `htmlroot` | Public base URL and the path prefix every route/asset is mounted under (often empty in `test`). |
| `slacktool`, `slack` | Outbound Mattermost/Slack webhook endpoints for blog/article notifications. |
| `SMTP`, `EmailSender`, `AllowedMailAddresses` | Outbound mail transport and sender/recipient allowlist. |
| `maillog_*` | Where `MailReceiver` logs what it *would* send, independent of SMTP. |
| `apiKeys` | Shared API-key → label map, checked by `checkApiKey` (`routes/api.js`). Usually just a free-text description — **except** the Blog-Sync-Merger write endpoint (`POST /api/blogSync/:apiKey/:blog_id/apply`) attributes its writes using this same value as the OSMUser (`getBlogSyncUser`), and `notification/migrationFilter.js` suppresses mail/Slack for every value in this map. A key meant for that endpoint should get a name-shaped value (e.g. `dataAdmin-Alice`) instead of a description. See [docs/API.md](API.md#authentication) and [docs/API.md](API.md#post-apiblogsyncapikeyblog_idapply). |
| `blogSyncReplaceMaxBlogNumber` | Optional (default `271`) — the WN-number ceiling above which the Blog-Sync-Merger's `mode: "replace"` is refused server-side, regardless of what the client asks for. See `wp-reconcile/blog-sync-merger/blogSyncMerger.js` `planReplace`. |
| `languages` | The list of active UI/translation languages (`lid`, plus optional `momentLocale`/`deeplPro*`/`displayLong`/`displayShort` per entry) — drives every `markdown<LANG>`/`close<LANG>`/`exported<LANG>` field name in the data model. |
| `auth` | `htaccess` (basic-auth escape hatch) and `openstreetmap_oauth20` (the real login: `authorizationURL`, `tokenURL`, `clientID`, `clientSecret`, `callbackURL`, `scope`). **When `serverport`/`url` change, `auth.openstreetmap_oauth20.callbackURL` must be updated to match too** — OSM's own OAuth app registration has to agree with it, easy to miss (see `CLAUDE.local.md`, "Whenever the port changes, three places need to match"). |
| `allowGuest`, `createGuestUsersAutomatic`, `DefineRole` | Login/role behavior for users without (or before) an OSM-verified account. |
| `WelcomeInterval`, `userIsOldInDays`, `WelcomeRefreshInSeconds` | Home-screen "recently active"/"welcome" display tuning, not data-affecting. |
| `Transition` | The automatic workflow scheduler (`AutoEditMode`, `AutoTranslate`, `AutoLanguageClose`), see [Automatic transitions](#automatic-transitions-transition) below. `enabled: false` in `config.test.yaml` so tests don't race a live cron. |
| `limitValues` | Express-`helmet` rate limiting (`limitWindowsMs`, `limitMaxCount`, `trustProxy`) — found to matter for a real bulk-write batch: a fast unpaced client can trip this within seconds (see `CLAUDE.local.md`, 2026-09-04 full-range Blog-Sync-Merger run). |
| `DeeplProConfig` | DeepL API auth/endpoints for machine translation. |
| `copyLanguageFromAnother` | Per-language "translate from this other language instead" fallback map. |
| `blogTranslationVisibleFor` | Restricts the blog-translation feature to specific OSM usernames. |
| `manyTranslationEnabled` | `false` switches off the "translate into many languages" menu in the article editor (and the matching profile setting). Missing or `true` = available for every user, who still has to enable it via their own `translationServicesMany` setting ("Translation Services Used (One to Many)"). |
| `FirstDraftConfig` | "First Draft" menu in the article view: Claude summarises a collected link into an empty language markdown. `apiKey` (else `ANTHROPIC_API_KEY`), `model` (default `claude-opus-5-5`), `effort` (default `medium`), `visibleFor` (list of OSM usernames, or `full`). Only these users see the menu and the admin config text `firstdraftprompt` (the system prompt). |
| `ReviewInWP`, `urlWoErrorWhileEdit` | Misc per-language/per-URL editorial-workflow exceptions. |
| `"media folder"` | Local-vs-published media path mapping used by markdown/export sanitizing (note the key needs quoting — it contains a space). |
| `"Feature Image Base URL"` | **Required** (OSMBC refuses to start without it), e.g. `https://weeklyosm.eu`. When an editor saves a `Picture` article, its feature image must be a relative path (`/wp-content/...`) and must exist under this base url, otherwise the save is rejected. This keeps a broken `featureImage` out of the Hugo export. Migration/sync writes (API, `wp-reconcile`) are not checked. |
| `"Blog Title For Export"`, `Hugo.DateAdjust` | Export-time title/date-offset knobs. |
| `"link-attributes"` | Per-render-target (`editor`/`production`) HTML attributes markdown-it adds to links. |
| `ExportProfiles` | Full renderer/bundling/GUI-menu definition per export profile — see [docs/export-profiles.md](export-profiles.md), the dedicated reference for this one. |

## Automatic transitions (`Transition`)

`model/blogTransitionScheduler.js` runs a sweep on the `scheduleCron`
schedule. Each sweep runs three rules in this order: Auto Edit, Auto
Translate, Auto Language Close. Translate runs before close because a closed
language can't be edited any more.

```yaml
Transition:
  enabled: true              # false = no scheduler at all (tests, a second instance on the same DB)
  scheduleCron: "*/1 * * * *"
  runOnStart: true           # run one sweep right after start
  AutoEditMode:
    enabled: true
  AutoTranslate:
    enabled: true
    sourceLanguage: EN
    previousBlogs: 2
    translateAt: { weekday: SUN, hour: 20, minute: 0 }
  AutoLanguageClose:
    enabled: true
    minReviews: 2
    closeAt: { weekday: MON, hour: 12, minute: 0 }
```

**When a rule is due.** Auto Translate and Auto Language Close are due
per blog. A rule is due `delayDays` after the blog's `endDate`. If
`translateAt` or `closeAt` is set, it is due instead at the first time
with that weekday and hour after `endDate`. `weekday` is `SUN`…`SAT` or
0–6, and `hour`/`minute` default to 12:00. The time is calculated in the
timezone of the server process. An invalid value makes the rule fall back
to `delayDays`. A rule acts only within one hour after its due time, so a
blog whose window was missed (e.g. server down) is not processed later.

| `AutoEditMode` | Default | |
|---|---|---|
| `enabled` | `true` | An `open` blog switches to `edit` once its `endDate` has passed. If no open blog is left, a new one is created. |

| `AutoTranslate` | Default | |
|---|---|---|
| `enabled` | `false` | |
| `sourceLanguage` | — | **Required**, one of `languages`. Without it the rule does not run (one warning in the log). |
| `service` | `deeplPro` | Translator from `model/translator.js`. It must be active, e.g. `DeeplProConfig.authKey` set. |
| `languages` | `ALL` | Target languages, `sourceLanguage` is always left out. |
| `previousBlogs` | `2` | A language is translated only if it was closed (`close<LANG>`) in one of this many blogs before (`WN<n-1>` … `WN<n-previousBlogs>`), i.e. it has an active team. |
| `blogStatusFilter` | `[edit]` | Blog status the rule looks at. |
| `delayDays`, `translateAt` | `3`, — | Due time, see above. |
| `actorUser` | `autotranslate` | Name in the blog log entry "translation with &lt;service&gt;". The article history shows the translator user (e.g. `deeplPro API Call`). |

Only empty articles are translated. Articles in the source language with
`no translation`, `Upcoming Events` and `--unpublished--` are skipped, and
languages that are closed or exported in the blog are left out. After a
language is translated, the blog gets the marker `autoTranslated.<LANG>`
(timestamp). The rule runs only once per blog and language, also when a
translation is emptied or the language is reopened later. Like `exportedBy`,
the marker is an operational field and is not written to the change history.

| `AutoLanguageClose` | Default | |
|---|---|---|
| `enabled` | `false` | |
| `minReviews` | `2` | Number of different reviewers a language needs, the same for all languages. |
| `onlyIfNotExported` | `true` | Leave languages that are already exported alone. |
| `languages` | `ALL` | |
| `blogStatusFilter` | `[edit]` | |
| `delayDays`, `closeAt` | `3`, — | Due time, see above. |
| `actorUser` | `autoclose-review` | Name in the close log entry. |

**Preview.** The admin page (`/osmbc/admin`) shows read-only what the next
runs will do: per blog the due time (server timezone, plus the browser's
local time if it differs), the languages that will be translated, those
skipped because they were not closed in the previous blogs, those already
translated/closed, and per close candidate the languages grouped by their
review count.

A few keys are flagged `POTENTIALLY_UNUSED` directly in the yaml files'
own comments (not found in any static `getValue(...)` call at last check) -
verify before relying on or removing one.

## `config.production.yaml` isn't in this repo/worktree

It only exists on the real server. When something here needs verifying
against production's actual values, that's a question for whoever has
server access (see `reference_server_db_access` in the project's
cross-session memory) - never assume this worktree's `config.development.yaml`
mirrors it beyond the shape.
