# Architecture

How OSMBC is built and why. This page is the map: read it before you
change code you don't know yet. Details live in the linked documents and
in the code; this page tells you where to look and which rules hold
everywhere.

OSMBC is a single Node.js process (Express, server-side rendered Pug
views, a little jQuery in the browser) on top of one PostgreSQL database.
There is no build step, no front-end framework and no separate API
server: the HTML pages and the JSON API come from the same app.

## Directory map

| Directory | What is in it |
|---|---|
| `bin/www.js` | process start: Node version check, HTTP(S) server, module initialisation |
| `app.js` | Express app: security headers, static files, session, login, route mounting, error page |
| `config.js` | the **technical** configuration from `config.<NODE_ENV>.yaml` (see below) |
| `routes/` | one Express router per area (`article`, `blog`, `users`, `config`, `api`, `slack`, `wiki` …) |
| `model/` | the domain objects (`Article`, `Blog`, `User`, `Config`) and their persistence (`pgMap.js`, `db.js`) |
| `notification/` | everything that reacts to a change: change history, mail, Mattermost/Slack, export log |
| `render/` | turns a blog into HTML, Markdown or Hugo Markdown (export targets) |
| `util/` | shared helpers (markdown setup, link checks, SSRF-safe HTTP agents, config split …) |
| `wiki/` | the optional editorial wiki (git-backed Markdown pages) |
| `views/` | Pug templates; `layout.pug` is the frame every page extends |
| `public/` | static files; `public/javascripts/` holds the browser code (jQuery, no bundler) |
| `help/` | user help pages (Markdown), shown inside the app |
| `data/` | default contents for the editorial configs stored in the DB (see below) |
| `wp-reconcile/` | command-line tools to sync a blog between two OSMBC instances |
| `export/`, `import/`, `genstaticpage/` | small command-line and generation tools |
| `test/` | mocha tests, Selenium UI tests (`uc.*`) and their page objects |
| `tools/` | maintenance scripts for developers (test wrapper, coverage check, migrations) |

## Startup

`bin/www.js` is the entry point. It

1. refuses to run on a Node version that is too old,
2. imports `app.js`, which builds the Express app (importing `config.js`
   reads the YAML config right away and fails fast on missing keys),
3. initialises the modules in dependency order (`async.auto`): the DB
   configs (`model/config.js`), the message center with its receivers,
   mail and Mattermost receivers for all users, and — unless
   `Transition.enabled` is false — the scheduler for automatic blog
   transitions (`model/blogTransitionScheduler.js`),
4. only then starts listening.

Tests use the same initialisation through `util/initialise.js`.

## A request, end to end

```mermaid
flowchart LR
  B[Browser] --> M[app.js middleware<br/>helmet, rate limit, static,<br/>body parser]
  M --> API[/api, /slack<br/>own key or token check/]
  M --> S[session + passport]
  S --> E[ensureAuthenticated]
  E --> L[layout router<br/>fills res.rendervar.layout]
  L --> R[area router<br/>checkRole full / guest]
  R --> Mo[model<br/>find / setAndSave]
  Mo --> DB[(PostgreSQL)]
  Mo --> N[messageCenter<br/>history, mail, chat]
  R --> V[Pug view] --> B
```

* `/api` and `/slack` are mounted **before** the session: they are called
  by machines and check their own API key or token.
* Everything else needs a logged-in user. `routes/auth.js` handles login
  (OpenStreetMap OAuth 2, optionally htpasswd) and `ensureAuthenticated`
  redirects to `/login` otherwise.
* `routes/layout.js` does not render anything. It prepares the data the
  frame needs (`res.rendervar.layout`: user, current blogs, menus) so every
  view can extend `layout.pug`.
* Access rights are per route with `auth.checkRole("full")` or
  `checkRole(["full", "guest"], …)`. Users have `access` `full`, `guest`
  or `denied`. For guests the second argument of `checkRole` adds a
  check: in `routes/article.js` (`isFirstCollector`) a guest may only open
  articles they collected or are mentioned in.
* Routers load the object named in the URL with `router.param`
  (e.g. `getArticleFromID` for `:article_id`) and hand it to the handler
  in `req`.

## Data and persistence

* Every table (`article`, `blog`, `usert`, `config`, `changes`,
  `session`) is `id` + one `jsonb` column `data`. There are no typed
  columns. A field is queried as `data->>'field'`
  (e.g. `data->>'categoryEN'`).
* The user table is called `usert`, not `users`.
* There are no foreign keys between the tables, so a table can be
  truncated or reloaded on its own without ordering constraints.
* `blog.categories` is an ordered array. Its order decides the order of
  the headings in the rendered blog **and** the position of the
  lead-picture caption. When you reorder, do it relative to an existing
  category, never by absolute index 0.
* `model/pgMap.js` is the only place that talks SQL for these objects.
  The model classes borrow its functions (`Article.prototype.save =
  pgMap.save`, `find`, `findById`, `findOne`, `fullTextSearch`), and
  `find` takes a small query object (`{ status: "open" }`,
  `{ access: "IN(full,guest)" }`, `"!="`, `">="` …) that `generateQuery`
  turns into SQL with parameters.
* Every object has a `version`. `save` increases it and refuses to
  overwrite a newer version in the DB ("Version Number Differs"). This is
  how two editors working on the same article don't silently overwrite
  each other.

Why jsonb: it let the data model grow field by field without migrations
(per-language fields like `markdownDE`, `markdownEN` …). The price is no
type checks and no referential integrity in the DB; the model code is
responsible for both.

## Changing an object: `setAndSave`

Editorial changes never call `save()` directly. They go through
`setAndSave(user, data, callback)` on `Article` or `Blog`:

```mermaid
sequenceDiagram
  participant R as route
  participant A as Article / Blog
  participant MC as messageCenter.global
  participant DB as pgMap.save
  R->>A: setAndSave(user, data)
  A->>A: conflict check (version or data.old)
  A->>A: drop unchanged fields, check rules<br/>(e.g. no edits after export)
  A->>MC: updateArticle(user, oldObject, change)
  MC-->>MC: every receiver decides itself:<br/>history row, mail, chat
  A->>A: apply change
  A->>DB: save (version + 1)
```

* **Conflict check.** The form sends either the `version` it was loaded
  with, or for single fields the old value (`data.old`). If the DB holds a
  different value, the change is refused with HTTP 409 and the editor
  sees both values.
* **Broadcast before save.** The message center gets the old object and
  the change. It forwards it to *every* registered receiver; it filters
  nothing itself.

### Receivers

`notification/messageCenter.js` has one global instance,
`messageCenter.global`. `setAndSave`, `closeBlog` and the other mutating
functions call one of its seven methods: `sendInfo`, `updateArticle`,
`updateBlog`, `sendReviewStatus`, `sendCloseStatus`, `addComment`,
`editComment`. Registered today:

* `LogModuleReceiver` — writes the `changes` table behind the "History"
  tabs, wrapped in a `FilterReceiver` (see below),
* `ExportReceiver` — text log for operational markers such as exports,
* via `IteratorReceiver`, one `MailReceiver` per user and one
  `SlackReceiver` per Mattermost/Slack channel, each wrapped in filters
  for the user's or channel's notification settings.

Rules:

* **Every receiver implements all seven methods.** The message center
  calls them without checking whether they exist; a missing one throws as
  soon as that event happens. Use no-op stubs for events a receiver
  doesn't care about (see `notification/exportReceiver.js`).
* **Each receiver decides itself whether a change is relevant.** This is
  not uniform: `UserConfigFilter` (mail per user) looks at
  `change.status`, `LogModuleReceiver` on its own logs every field it
  gets. So an unfiltered receiver turns *every* field change into a
  history row that editors see.
* `notification/FilterReceiver.js` is the reusable wrapper that puts a
  relevance check in front of a receiver. `messageCenter.js` uses it to
  keep purely operational blog fields (`exportedBy`, `autoTranslated`)
  out of the history.
* **A field that should stay invisible to editors still goes through
  `setAndSave`.** Never reach for a bare `save()` to avoid the broadcast;
  add a filter instead. Otherwise the version check, the change rules and
  every other receiver are bypassed too.

## Two kinds of configuration

| | Technical config | Editorial config |
|---|---|---|
| Where | `config.<NODE_ENV>.yaml` (optionally split, see `editorial_config`) | table `config`, edited in the app under Admin |
| Read by | `config.js`, `config.getValue(key, { mustExist })` | `model/config.js`, `configModule.getConfig(name)` |
| Examples | DB connection, URL, login, export profiles, languages, API keys | votes, category translations, calendar texts, help menu, First Draft prompt |
| Changes | restart needed | live |

The defaults for the editorial configs are in `data/` and are copied into
the DB the first time a config is missing. After that the DB is the
truth. Field reference: [config.md](config.md).

## Blog lifecycle and languages

A blog (one issue) has a `status` of `open` (collecting), `edit`
(editing), `closed` (published) or `trash`. On top of that each language
has its own review, export and close state (`reviewCommentXX`,
`exportedXX`, `closeXX`). Several transitions can run automatically by
time (`Transition` in the config, see [config.md](config.md)
"Automatic transitions").

Languages are configured in `languages`. Every per-language text is a
field with the language code as suffix (`markdownDE` on the article,
`exportedEN`, `closeEN` on the blog …), so a
language id must never be renamed once it holds data.

## Output: rendering and export

`render/BlogRenderer.js` `createRenderer(type, blog)` returns the
renderer for an export profile: `HtmlRenderer` (preview and WordPress),
`MarkdownRenderer`, `HugoMarkdownRenderer`. They share the base class
`render/Renderer.js`; `HtmlRenderer` has an editor and a production
target (`rendererOptions`). Which profile uses which renderer, and what the
fields mean: [export-profiles.md](export-profiles.md),
[hugo-export.md](hugo-export.md). External callers get the result through
the API: [API.md](API.md).

Markdown inside articles is rendered on the server with markdown-it plus
a few plugins (`util/md_util.js`, own copies in `util/markdown-it-*.js`).
The live preview in the browser uses markdown-it and the npm versions of
the same plugins (copied by `postinstall.js`), so both outputs can differ
in details.

## Browser code

The views are rendered on the server. `public/javascripts/` adds
behaviour with jQuery and Bootstrap 5: live preview, link checks,
voting, saving single fields. There is no bundler; the files are served
as they are. Libraries from npm are copied into `public/` by
`postinstall.js`.

Rules for every UI change (mobile mode, tap targets, no inline event
handlers …): [ui-guidelines.md](ui-guidelines.md).

## Code conventions you will meet

* **Callbacks and promises.** Most model functions are written with
  Node callbacks (`function (err, result)`) and the `async` library. Many
  of them also return a promise when called without a callback. New code
  may use `async`/`await`; keep the callback signature where existing
  callers need it.
* **`debug` instead of `console.log`.** Every module has
  `const debug = _debug("OSMBC:<area>:<module>")`. Start with
  `DEBUG=OSMBC:* npm start` (or a narrower pattern) to see it.
  Operational messages go to `config.logger` (winston).
* **ES modules** (`"type": "module"`), relative imports with `.js`
  extension.
* **Readability limits** checked by ESLint (function size, complexity,
  JSDoc on exports): [development.md](development.md) "Lint rules for
  readability".
* **Commit messages** in Conventional Commits format:
  [CONTRIBUTING.md](../CONTRIBUTING.md).

## Where to start for a change

| You want to … | Start in |
|---|---|
| add a field to articles | `model/article.js` (rules in `setAndSave`, `isChangeAllowed`), the view in `views/article/`, `public/javascripts/article_view.js` |
| change what a page shows | the route in `routes/<area>.js` (which data it passes), then the Pug view |
| change who may do something | the `checkRole` on the route in `routes/<area>.js` |
| react to a change (new notification) | a new receiver in `notification/`, registered in `messageCenter.js` or `mailReceiver.js` / `slackReceiver.js` |
| change the exported blog | `render/` and the export profile in the config |
| add an editorial setting | a default in `data/`, an entry in `checkAndRepair` in `model/config.js` |
| add a technical setting | `config.js` (`getValue`), document it in [config.md](config.md) |
| add an API endpoint | `routes/api.js`, document it in [API.md](API.md) |
| test it | [development.md](development.md) "Tests"; UI tests only through `test/PageObjectModel/` |

## Further reading

* [development.md](development.md) — local setup, tests, coverage, releases
* [install.md](install.md) — running OSMBC on a server
* [config.md](config.md) — every configuration key
* [ui-guidelines.md](ui-guidelines.md) — rules for views and browser code
* [wiki.md](wiki.md) — the editorial wiki
* [API.md](API.md), [export-profiles.md](export-profiles.md), [hugo-export.md](hugo-export.md)
