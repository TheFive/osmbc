# Configuration (`config.<env>.yaml`)

OSMBC's whole runtime configuration is loaded by [config.js](../config.js)
from a single per-environment file. This document covers the loading
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

resolved relative to the repo root (`config.js`'s own directory), or to
the directory in the environment variable `OSMBC_CONFIG_DIR` if it is set
(e.g. `/etc/osmbc`, see [install.md](install.md#keeping-the-app-directory-read-only-optional)),
and reads the first one that exists. Known environments in this codebase:

| `NODE_ENV` | File | Tracked in git? |
|---|---|---|
| `development` | `config.development.yaml` | **No** — gitignored, per-machine/per-worktree (local DB credentials, ports, OAuth secrets) |
| `test` | `config.test.yaml` | **Yes** — the only config file committed to the repo; `npm test` and CI always use this one |
| `production` | `config.production.yaml` | **No** — lives only on the real server |
| any other custom name, e.g. `prodcopie` | `config.<name>.yaml` | **No** — see below |

Missing file for the resolved `NODE_ENV` is fatal: `config.js` logs an
error and calls `process.exit(1)` (see `initialise()`).

### Optional second file for the editorial settings

If the file sets `editorial_config` (a path, relative to the file's own
directory), `config.js` reads that file too and merges it in with
`mergeConfigs` from [util/configSplit.js](../util/configSplit.js): objects
key by key, and a value present in both files is fatal (the error names
it). `util/configSplit.js` also defines which keys are editorial;
`tools/split-config.mjs` splits a single file by these rules. See
[install.md](install.md#technical-and-editorial-settings-in-two-files-optional).
The test config stays one file.

### `NODE_ENV=test`: fixed values, overridden per test run

`config.test.yaml` names a fixed port and database, and the test
bootstrap (`test/testutil.js` `clearDB`) drops/recreates the tables on
(almost) every test file. The `npm test*` scripts run through
`tools/run-tests.mjs`, which gives each run its own port, database and
temp directory via `OSMBC_TEST_*` variables, so parallel runs don't
collide. Calling `mocha` directly uses the fixed values and is not safe
to run in parallel (see [development.md](development.md#parallel-test-runs)).

### Custom `NODE_ENV` values for a second local "side"

Nothing in `config.js` restricts `NODE_ENV` to `development`/`test`/
`production` — any value works as long as a matching `config.<value>.yaml`
exists. This is how a worktree gets a second, independent local database
pointer without a second checkout: e.g. `config.prodcopie.yaml`
(`NODE_ENV=prodcopie`) is a full copy of `config.development.yaml` with
only `postgres.database` (and usually `serverport`/`url`) changed, used to
give a CLI tool a "local" side reading from a different local database than
whatever dev server happens to be running on port 3000 (e.g. for
`wp-reconcile/blog-sync-merger/syncBlog.js`).
Such a file never runs its own dev server unless you explicitly start one
with that `NODE_ENV`.

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
| `MattermostUserNotification` | Optional. `team: <key of slacktool>`: users may get their notifications as Mattermost direct message, see [Notifications](#notifications). Missing = mail only. |
| `SMTP`, `EmailSender`, `AllowedMailAddresses` | Outbound mail transport and sender/recipient allowlist. |
| `maillog_*` | Where `MailReceiver` logs what it *would* send, independent of SMTP. |
| `editorial_config` | Optional. Path of the second file with the editorial settings, see [above](#optional-second-file-for-the-editorial-settings). |
| `cache_directory`, `profile_directory` | Optional. Where OSMBC writes its caches (default `cache`) and the public user profiles (default `public/profile`, served under `<htmlroot>/profile/`). Relative paths are resolved against the app directory. |
| `apiKeys` | Shared API-key → label map, checked by `checkApiKey` (`routes/api.js`). Usually just a free-text description — **except** for bulk corrections ([docs/API.md](API.md#bulk-corrections-through-the-api-data-admin)): the blogSync write endpoint (`POST /api/blogSync/:apiKey/:blog_id/apply`) attributes its writes using this same value as the OSMUser (`getBlogSyncUser`), and `notification/migrationFilter.js` suppresses mail/Slack for every value in this map. A key meant for that endpoint should get a name-shaped value (e.g. `dataAdmin-Alice`) instead of a description. See [docs/API.md](API.md#authentication) and [docs/API.md](API.md#post-apiblogsyncapikeyblog_idapply). |
| `blogSyncReplaceMaxBlogNumber` | Optional (default `271`) — the WN-number ceiling above which the Blog-Sync-Merger's `mode: "replace"` is refused server-side, regardless of what the client asks for. See `model/blogSync/blogSyncMerger.js` `planReplace`. Migration only, to be removed after the final WordPress reconciliation. |
| `languages` | The list of active UI/translation languages (`lid`, plus optional `momentLocale`/`deeplPro*`/`displayLong`/`displayShort` per entry) — drives every `markdown<LANG>`/`close<LANG>`/`exported<LANG>` field name in the data model. |
| `auth` | `htaccess` (basic-auth escape hatch) and `openstreetmap_oauth20` (the real login: `authorizationURL`, `tokenURL`, `clientID`, `clientSecret`, `callbackURL`, `scope`). **When `serverport`/`url` change, `auth.openstreetmap_oauth20.callbackURL` must be updated to match too** — and so must the redirect URL registered with the OAuth application in OSM. Easy to miss when moving to another port or host. |
| `allowGuest`, `createGuestUsersAutomatic`, `DefineRole` | Login/role behavior for users without (or before) an OSM-verified account. |
| `WelcomeInterval`, `userIsOldInDays`, `WelcomeRefreshInSeconds` | Home-screen "recently active"/"welcome" display tuning, not data-affecting. |
| `Transition` | The automatic workflow scheduler (`AutoEditMode`, `AutoTranslate`, `AutoReviewStart`, `AutoLanguageClose`), see [Automatic transitions](#automatic-transitions-transition) below. `enabled: false` in `config.test.yaml` so tests don't race a live cron. |
| `limitValues` | Rate limiting with `express-rate-limit` (`limitWindowsMs`, `limitMaxCount`) and the number of trusted proxies (`trustProxy`, see [install.md](install.md#6-reverse-proxy)). A fast, unpaced API client (e.g. a Blog-Sync-Merger run over many blogs) can hit the limit within seconds. |
| `DeeplProConfig` | DeepL API auth/endpoints for machine translation. |
| `copyLanguageFromAnother` | Per-language "translate from this other language instead" fallback map. |
| `blogTranslationVisibleFor` | Restricts the blog-translation feature to specific OSM usernames. |
| `manyTranslationEnabled` | `false` switches off the "translate into many languages" menu in the article editor (and the matching profile setting). Missing or `true` = available for every user, who still has to enable it via their own `translationServicesMany` setting ("Translation Services Used (One to Many)"). |
| `FirstDraftConfig` | "First Draft" menu in the article view: Claude summarises a collected link into an empty language markdown. `apiKey` (else `ANTHROPIC_API_KEY`), `model` (default `claude-opus-5-5`), `effort` (default `medium`), `visibleFor` (list of OSM usernames, or `full`). Only these users see the menu and the admin config text `firstdraftprompt` (the system prompt). |
| `wiki` | Optional. The built-in wiki: `directory` (absolute path outside the app directory; missing = wiki off), `readAccess`/`writeAccess` (`full`, `guest` and OSM user names), `autoPush`, `maxUploadBytes`, `mattermost`. See [docs/wiki.md](wiki.md). |
| `ReviewInWP`, `urlWoErrorWhileEdit` | Misc per-language/per-URL editorial-workflow exceptions. |
| `"media folder"` | Local-vs-published media path mapping used by markdown/export sanitizing (note the key needs quoting — it contains a space). |
| `"Feature Image Base URL"` | **Required** (OSMBC refuses to start without it), e.g. `https://weeklyosm.eu`. When an editor saves a `Picture` article, its feature image must be a relative path (`/wp-content/...`) and must exist under this base url, otherwise the save is rejected. This keeps a broken `featureImage` out of the Hugo export. Migration/sync writes (API, `wp-reconcile`) are not checked. |
| `"Blog Title For Export"`, `Hugo.DateAdjust` | Export-time title/date-offset knobs. |
| `"link-attributes"` | Per-render-target (`editor`/`production`) HTML attributes markdown-it adds to links. |
| `ExportProfiles` | Full renderer/bundling/GUI-menu definition per export profile — see [docs/export-profiles.md](export-profiles.md), the dedicated reference for this one. |

## Notifications

Every user chooses on their user page what they want to hear about; the
same choices apply to mail and to a Mattermost direct message.

| User setting | Values | Meaning |
|---|---|---|
| Notify via (`notifyVia`) | `mail` (default), `mattermost`, `both` | Shown only with `MattermostUserNotification` in the config. Mattermost needs the user's name in "Mattermost User" (`SlackUser`, the same field as for collecting from Mattermost). |
| New Submissions (`notifyNewCollection`) | `all`, `editor`, `guest`, `off` | An article gets its first collection (Collect). `guest`: only submissions of guest users, `editor`: only those of the other users. |
| Changed Collections (`notifyCollectionChange`) | `all`, `editor`, `guest`, `off` | An existing collection is changed. |
| Text Changes by Guests (`notifyGuestTextChange`) | `true`, `false` | A guest wrote or changed a text in any language. |

Article notifications go to full users only; guests get mails about
comments that mention them. Users saved before these settings existed
only have `mailNewCollection`: `"true"` counts as `all` for both new
submissions and changed collections, so nothing changes for them until
they save their page.

A direct message goes through the incoming webhook of the team named in

```yaml
MattermostUserNotification:
  team: theweeklyosm   # a key of slacktool
```

to the channel `@<Mattermost User>`. The webhook must not be locked to
one channel, else Mattermost refuses the `@user` target.

Mattermost channels are configured in the admin config
`slacknotification` (a list, one entry per channel). The article keys:

| Key | Values | Meaning |
|---|---|---|
| `notifyNewCollection` | `true`, `"editor"`, `"guest"`, `false` | New submissions (all / by editors only / by guests only). |
| `notifyCollectionChange` | `true`, `"editor"`, `"guest"`, `false` | Changed collections. Missing = same as `notifyNewCollection`, which covered both before (issue #1170). |
| `notifyGuestTextChange` | `true`, `false` | Text changes made by guests. |

Example: one channel to look after the guests, one for the editors.

```yaml
- slack: theweeklyosm
  channel: "#osmbc-guests"
  notifyNewCollection: guest
  notifyCollectionChange: guest
  notifyGuestTextChange: true
- slack: theweeklyosm
  channel: "#osmbc-editors"
  notifyNewCollection: editor
  notifyCollectionChange: editor
```

## Automatic transitions (`Transition`)

`model/blogTransitionScheduler.js` runs a sweep on the `scheduleCron`
schedule. Each sweep runs five rules in this order: Auto Edit, Auto
Translate, Auto Review Start, Auto Language Close, Auto Blog Close.
Translate runs before review start, so machine translated texts already
count as written, and both run before close, because a closed language
can't be edited any more. Auto Blog Close runs last, so the language
closes of the same sweep count.
What the rules do for the editors is described in
[automatic-transitions.md](automatic-transitions.md).

```yaml
Transition:
  enabled: true              # false = no scheduler at all (tests, a second instance on the same DB)
  scheduleCron: "*/1 * * * *"
  runOnStart: true           # run one sweep right after start
  AutoEditMode:              # on unless enabled: false
    editAt: { weekday: THU, hour: 0, minute: 0 }
  AutoTranslate:
    enabled: true
    sourceLanguage: EN
    previousBlogs: 2
    translateAt: { weekday: THU, hour: 20, minute: 0 }
  AutoReviewStart:
    enabled: true
    reviewStartAt: { weekday: SAT, hour: 12, minute: 0 }
    recheck: { everyMinutes: 60, until: AutoLanguageClose }
  AutoLanguageClose:
    enabled: true
    minReviews: 2
    closeAt: { weekday: SUN, hour: 18, minute: 0 }
    recheck: { everyMinutes: 60, until: { weekday: SUN, hour: 24 } }
  AutoBlogClose:
    enabled: true            # keepOpenBlogs 2, idleDays 14, previousBlogs 2 by default
```

**On and off.** Auto Edit is **on** unless `AutoEditMode.enabled: false`
is set: without it no new blog is created, so every instance needs it.
The other four rules are **off** unless `enabled: true` is set, because
they change content or act for the language teams (and Auto Translate
costs translation credits). `Transition.enabled: false` switches off all
five.

**When a rule is due.** Auto Translate, Auto Review Start and Auto
Language Close are due per blog. A rule is due `delayDays` after the
blog's `endDate`. If `translateAt`, `reviewStartAt` or `closeAt` is set,
it is due instead at the first time with that weekday and hour after
`endDate`. `weekday` is `SUN`…`SAT` or 0–6, and `hour`/`minute` default
to 12:00. The time is calculated in the timezone of the server process.
An invalid value makes the rule fall back to `delayDays`. Without a
`recheck` a rule acts only within one hour after its due time, so a blog
whose window was missed (e.g. server down) is not processed later.

**Recheck** (Auto Review Start and Auto Language Close). With
`recheck: { everyMinutes, until }` the rule checks the blog again from
its due time on, once every `everyMinutes`, until `until`. The time
from the due time on is cut into slots of `everyMinutes`; each slot runs
once, with the first sweep inside it.
`until` is

- a weekday and time (`{ weekday, hour, minute }`): the first such time
  at or after the due time. `hour: 24` (with `minute: 0`) means the end
  of that day, e.g. `{ weekday: MON, hour: 24 }` = Monday 24:00.
- `AutoLanguageClose` (only for Auto Review Start): the due time of Auto
  Language Close for the same blog. Auto Language Close must be enabled,
  else the recheck is ignored.

A recheck with `everyMinutes` below 1, without `until`, or with an
`until` at or before the due time is ignored (warning in the log), and
the rule runs only once as described above. The checks can not be more
frequent than `scheduleCron`. Which slot already ran is kept in memory;
after a restart the current slot runs once more, which changes nothing
because a started review / closed language is left alone.

Example: `closeAt: { weekday: SUN, hour: 18 }` with
`recheck: { everyMinutes: 60, until: { weekday: SUN, hour: 24 } }`
checks every hour on Sunday from 18:00 to 23:00 and closes every
language that has reached `minReviews` by then.

| `AutoEditMode` | Default | |
|---|---|---|
| `enabled` | `true` | An `open` blog switches to `edit` once its `endDate` has passed. If no open blog is left, a new one is created. |
| `editAt` | — | Weekday and time of the weekly switch (`{ weekday, hour, minute }` as above). A new blog starts one minute after the end of the previous one and ends one minute before the first `editAt` at least one day after its start: with `THU 0:00` it collects Thursday 00:00 to Wednesday 23:59. A previous blog whose end was moved by hand is caught up with a shorter or longer blog. Without `editAt` (or with an invalid one, warning in the log) the new blog starts one day after the previous end and ends `BlogDurationDays` (default 7) days after it. |

The blog with the highest `WN` number is the previous blog. Manually
created blogs get their dates the same way.

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

| `AutoReviewStart` | Default | |
|---|---|---|
| `enabled` | `false` | |
| `languages` | `ALL` | |
| `blogStatusFilter` | `[edit]` | |
| `delayDays`, `reviewStartAt` | `3`, — | Due time, see above. |
| `recheck` | — | Check again until a later time, see above. `until: AutoLanguageClose` ends at the close time. |
| `acceptAutoTranslated` | `true` | A machine translation nobody has edited since (last author a translator user, e.g. `deeplPro API Call`) counts as written. `false`: such an article blocks the review start. |
| `actorUser` | `autoreview-start` | Name in the review list of the blog and in the review log entry. |

The review of a language starts (the same as the "Start Review" button,
including the Upcoming Events text from OSMCAL) when every article of the
blog is written in that language: it has a text or `no translation`.
`--unpublished--` articles don't count, an article in
`-- no category yet --` counts as not written. A language whose articles
are all `no translation` is left alone (no team at work). Languages that
are closed, exported or whose review has already started are left alone,
so the rule acts at most once per blog and language.

| `AutoLanguageClose` | Default | |
|---|---|---|
| `enabled` | `false` | |
| `minReviews` | `2` | Number of different reviewers a language needs, the same for all languages. |
| `onlyIfNotExported` | `true` | Leave languages that are already exported alone. |
| `languages` | `ALL` | |
| `blogStatusFilter` | `[edit]` | |
| `delayDays`, `closeAt` | `3`, — | Due time, see above. |
| `recheck` | — | Check again until a later time, see above. |
| `actorUser` | `autoclose-review` | Name in the close log entry. |

A language is never closed, neither by this rule nor by hand, while

- an article is not written yet (no text and not `no translation`, or in
  `-- no category yet --`; `--unpublished--` doesn't count, issue #1137),
- or a footnote anchor in its texts (`[[1](#wn<issue>_<article id>)]`,
  e.g. in the lead picture caption) points to another issue, a missing
  article or an unpublished one. Such an anchor breaks the Hugo export
  (issue #1130).

The other way round: an article that arrives in a blog (created, moved or
copied there) gets `no translation` in every language that is already
closed or exported there and would stay empty — nobody can write those
languages any more (issue #1133).

The close is refused (HTTP 409 with a message for the editor); the
Close button is greyed out and lists the problems. Reopening is always
possible. The preview lists such languages as "blocked" with the
problems. When the rule is due and a language with at least `minReviews`
reviews is blocked, the blog page shows a banner "Auto Close could not
close …" above that language, and the rule posts the problems once per
blog and language to the Mattermost/Slack channels that get the close
status of that language (`sendCloseBlocked`; marker
`closeBlockedNotified.<LANG>`, an operational field like
`autoTranslated`, not in the change history).

| `AutoBlogClose` | Default | |
|---|---|---|
| `enabled` | `false` | |
| `keepOpenBlogs` | `2` | The newest blogs in `edit` that always stay open for late teams. A blog is a candidate only when at least this many newer blogs are past collecting (`edit` or `closed`). |
| `previousBlogs` | `2` | A language is **active** in a blog if it has text there (not only `no translation`) or was closed in one of this many blogs before. |
| `idleDays` | `14` | An active language that is not closed counts as **abandoned** when nobody changed its article texts, review comments or close state for this many days (counted from the blog's `endDate` at the earliest). Changes by translation services (e.g. `deeplPro API Call`), copy users, OSMCAL, migration users and the automatic rules don't count. |
| `everyMinutes` | `60` | The rule checks at most this often (it looks at the change history). |
| `languages` | `ALL` | |
| `actorUser` | `autoclose-blog` | Name in the blog's status change. |

A candidate blog is set to `closed` when every active language is
closed or abandoned. Closing the blog makes every language read-only,
also the abandoned ones. Defaults from the change history of
WN776–WN837: blogs were closed by hand when the second newer blog had
gone to edit (42 of 44). A replay of the rule over these 62 blogs closed
them 2.5 days earlier than by hand (median). With `idleDays: 7` six
blogs would have locked out late teams that came back after more than a
week of silence (e.g. a Russian team working 18–21 days after the blog
end); with 14 three, and `keepOpenBlogs: 3` closed later than by hand.

**Preview.** The admin page (`/osmbc/admin`) shows read-only what the next
runs will do: per blog the due time (server timezone, plus the browser's
local time if it differs), the languages that will be translated, those
skipped because they were not closed in the previous blogs, those already
translated/closed, the languages whose review will start and why the
others wait (articles not written, machine translated), per close
candidate the languages grouped by their review count, and with a
recheck its end and the next check, and per blog close candidate the
languages still awaited with their last change and the time from which
they count as abandoned. Check it there after changing the
configuration.

### Example week

A blog lives about ten days: one week of collecting, then a few days of
editing until it is closed. So two blogs are always active, one
collecting (`open`) and one being edited (`edit`). With the YAML example
above (`editAt` Thursday 00:00), for a blog whose collecting ends
Wednesday 23:59:

| When | Rule | What happens |
|---|---|---|
| Wednesday 23:59 (week 0) | Auto Edit | The previous blog goes to `edit`, this blog is created; collecting starts Thursday 00:00. |
| Wednesday 23:59 (week 1) | Auto Edit | `endDate`: collecting ends, this blog goes to `edit`, the next blog is created. |
| Thursday 20:00 | Auto Translate | Empty articles of active languages are filled from EN. |
| Saturday 12:00, then hourly | Auto Review Start | Every language whose articles are all written gets "review started". Checked every hour until Sunday 18:00. |
| Sunday 18:00, then hourly until 24:00 | Auto Language Close | Every language with 2 reviews is closed. |
| about two weeks later, hourly | Auto Blog Close | Once two newer blogs are in edit, the blog is closed as soon as every active language is closed or had no change for 14 days. |

The weekday/hour values are only an example. The switch to `edit`
happens at `endDate`, one minute before `editAt`. Each other `…At` is
the first such time after the blog's `endDate`, so all of them have to
lie within the 7 days after it, in the order of the rules.

A few keys are flagged `POTENTIALLY_UNUSED` directly in the yaml files'
own comments (not found in any static `getValue(...)` call at last check) -
verify before relying on or removing one.

## `config.production.yaml` isn't in the repository

It only exists on the server, because it holds the secrets. Start a new
one from `config.test.yaml`; [install.md](install.md#4-configuration)
lists the keys to check on a server. A local `config.development.yaml`
has the same shape, but its values (database, port, URLs, enabled
features) tell nothing about those of a production server.
