# OSMBC Public API

This document describes the public, API-key-secured HTTP API exposed by
[routes/api.js](routes/api.js). It is separate from the session/cookie-based
web UI. All endpoints below are mounted under:

```
<htmlroot>/api
```

`<htmlroot>` is the `htmlroot` value from `config.<env>.yaml` (often empty).
Examples in this document use `/api/...` directly.

## Authentication

Every endpoint takes an `:apiKey` path segment. It is checked in one of two
ways (see `checkApiKey` in `routes/api.js`):

1. **Shared/label key** — configured under `apiKeys` in `config.<env>.yaml`:
   ```yaml
   apiKeys:
     testapikey: monitor
     testapikey.TBC: TBC Collections
   ```
   The value (`monitor`, `TBC Collections`, ...) is a human-readable label,
   not a secret — it identifies *what the key is for*, not *who* is calling.
   Requests authenticated this way do not carry a real OSM user identity.

2. **Personal key** — a key stored on a `usert` record (`data->>'apiKey'`,
   manageable per-user in the web UI). Requests authenticated this way carry
   the calling user's identity (`OSMUser`).

An unknown key returns:

```
HTTP 401
Not Authorised
```

### Error response format

Handlers that set `err.type = "API"` (all endpoints below) get their error
returned as **plain text**, with the given HTTP status:

```
HTTP <status>
<err.message>
```

There is no JSON error envelope. Successful responses vary by endpoint (see
below) — most are plain text or a binary/file download; the `outstanding`
endpoint's dry-run mode is the one JSON response in this API.

---

## `GET /api/monitor/:apiKey`

Liveness check. Always responds `200 OK` with body `OK` if the process is up
and the API key is valid (any configured key works, shared or personal).

Used by uptime/monitoring tooling.

---

## `GET /api/monitorPostgres/:apiKey`

Liveness check including a Postgres round-trip (`SELECT` on the `usert`
table).

**Note:** this endpoint always answers with `HTTP 200`, even when Postgres is
unreachable — the *body* differentiates:

```
OK               → Postgres reachable
Postgres Error   → Postgres query failed
```

Monitoring integrations must check the response **body**, not just the HTTP
status.

---

## `POST /api/collectArticle/:apiKey`

Collects a new article into the `TBC` ("to be categorized") blog. Intended
for programmatic/bot submission (e.g. browser extensions, scripts) — compare
with `GET /api/collect/:apiKey` below, which is the lightweight GET variant
for bookmarklets.

### Body (`application/x-www-form-urlencoded` or JSON)

| Field | Required | Description |
|---|---|---|
| `collection` | yes | Free text / URL(s) to collect. If `title` is omitted, the first URL found inside `collection` is fetched to auto-derive a title. |
| `OSMUser` | one of `OSMUser`/`email` | Existing OSMBC user name to attribute the collection to. |
| `email` | one of `OSMUser`/`email` | Alternative to `OSMUser`; resolved to a user via `email`. |
| `title` | no | Article title. Auto-fetched from the first URL in `collection` if omitted (falls back to `"NOT GIVEN"` if no URL is found). |
| `categoryEN` | no | Defaults to `"-- no category yet --"`. |
| `markdown{LANG}` | no | Per-language markdown body, e.g. `markdownDE`, `markdownEN` (one field per configured language). |
| `markdown` | no | Un-suffixed markdown; assigned to the resolved user's own language. |

### Responses

- `200` — plain text: `Article Collected in TBC.`
- `422` — missing `collection`, or neither `OSMUser` nor `email` resolves to
  an existing user (`Missing Collection`, `No OSMUser && EMail given`, `No
  OSMUser given, could not resolve email address`).

---

## `GET /api/collect/:apiKey`

Lightweight GET variant of article collection, meant for simple integrations
(bookmarklets, `<a href>` links) where a form POST isn't practical.

**Requires a personal API key** (must resolve to `req.user`). A shared/label
key passes `checkApiKey` (which doesn't distinguish per-route), but this
handler then rejects it — since there is no `OSMUser` to attribute the
collection to — with a generic **HTML** error page and `HTTP 500` (this
error isn't marked `type: "API"`, so it doesn't get the plain-text format
described above). Use a personal key here, not a shared one.

### Query parameters

| Param | Required | Description |
|---|---|---|
| `collection` | yes | Same semantics as in `collectArticle`. |
| `title` | no | Same as `collectArticle`. |

### Responses

- `200` — plain text: the full URL of the newly created article
  (`<config.url><htmlroot>/article/<id>`). Also sets
  `Access-Control-Allow-Origin: *` (safe to call cross-origin from a
  bookmarklet).
- `422` — `Missing Collection` if `collection` is absent.

---

## `GET /api/blogPreviewDownload/:apiKey/:blog_id`

Renders and downloads a **single** blog using a configured export profile.
This is the same rendering path the web UI's "Export" menu uses.

### Route parameter

`:blog_id` accepts (resolved by `findBlogByRouteId`, see `model/blog.js`):

| Value | Resolves to |
|---|---|
| a DB id (number) | that blog |
| a blog name, e.g. `WN1234` | that blog |
| `current` | the currently open (`status: edit`) WeeklyNote blog with the latest `startDate`. **Not** the same as the `outstanding` endpoint below — see note there. |
| `TBC` | the virtual "to be categorized" collection blog |

Unknown/unresolvable `blog_id` → `404 Blog not found`.

### Query parameters

| Param | Required | Description |
|---|---|---|
| `exportProfile` | yes | Name of an entry under `ExportProfiles` in `config.<env>.yaml` (e.g. `OsmbcDownload`, `HugoDownload`, `MarkdownDownload` — profile names/renderers are deployment-specific config, check your `config.<env>.yaml`). |
| `lang` | no | A configured language code (e.g. `DE`, `EN`, ...), or `ALL`. Defaults to `EN` if omitted or invalid. `ALL` with a Markdown/Hugo-style profile exports every configured language; `ALL` with an HTML profile exports only the languages currently marked `close{LANG}: true`. |

### Responses

- `200` — the rendered content, with `content-type` and filename set from
  the profile (`fileNameTemplate`). Single language + HTML profile ⇒ raw
  HTML body; multiple languages / zip `bundleMode` ⇒ a `.zip` stream.
- `422` — `Missing exportProfile`, or `Unknown export profile: <name>`.

---

## `GET /api/blogPreviewDownload/:apiKey/outstanding`

Bulk export: bundles **every** WeeklyNote blog that is closed for the
requested language(s) but not yet delivered under the given export profile,
into a single ZIP — intended for pipelines (e.g. a Hugo static-site build)
that pull "whatever is new since last time" rather than one blog at a time.

**Not the same as `current` above.** `current` (in the single-blog route)
always means "the one currently-open blog". `outstanding` means "every
closed-but-undelivered blog, of which there can be zero, one, or several".
They are deliberately different endpoints so existing `current` consumers
are unaffected.

### Query parameters

| Param | Required | Description |
|---|---|---|
| `exportProfile` | yes | Must be a profile with a `pathTemplate` configured (e.g. `HugoDownload`, `MarkdownDownload` in the test config) — profiles without one (plain HTML export profiles) can't produce a bundle and are rejected. |
| `lang` | no | A single language code, or `ALL` (default: all configured languages). Each blog is only included for languages where it is actually closed and not yet exported. |
| `dryRun` | no | `true` → return a JSON preview instead of building/downloading/marking anything (see below). |

### What counts as "outstanding"

A blog+language is included if **all** of:
- the blog is a WeeklyNote blog (name matches `WN<number>`)
- `blog.status` is `edit` or `closed` (not `open`, not archived states)
- `close{LANG}` is `true` for that language
- `blog.exportedBy[exportProfile][lang]` is **not** set

### Side effects on success

After the ZIP has been fully sent, each included blog+language is marked:

```json
"exportedBy": { "<exportProfile>": { "<LANG>": "<ISO timestamp>" } }
```

This is written as a normal blog change (via `setAndSave`), so it also
produces a change-log entry (`property: "exportedBy"`), attributed to:
- the calling user's `OSMUser`, for a personal API key
- `"apikey:<label>"` (the configured label, not the secret key), for a
  shared API key

If a blog's language is reopened later (`close{LANG}` → `false`), its marker
for that language is cleared and it becomes "outstanding" again. If a blog's
`status` changes back to `edit`/`open`, **all** of its export markers are
cleared.

A marker failing to save for one blog does not affect the others — each is
saved independently; a failure is only debug-logged server-side. That blog
simply stays "outstanding" and is offered again on the next call (safer to
re-deliver than to silently drop it).

### Partial rendering failures

If one blog fails to render (e.g. malformed content), it is **skipped**, not
fatal to the request — the rest of the batch still gets bundled, downloaded
and marked. Skipped items are listed in a response header:

```
X-Outstanding-Export-Warnings: WN1234:DE,WN1235:EN
```

(comma-separated `<blogName>:<lang>` pairs). Absent if nothing failed.

### Concurrency

Only one non-dry-run `outstanding` request per `exportProfile` may be in
flight at a time (prevents two overlapping requests from re-delivering and
double-marking the same blogs). A second concurrent request for the same
profile gets:

```
HTTP 409
Outstanding export for profile '<exportProfile>' is already in progress, please retry shortly
```

This is an **in-process** guard (kept in memory) — it does not coordinate
across multiple server instances/processes.

### Responses

- `200` (ZIP) — `application/zip`, filename from `fileNameTemplate` (with
  template placeholders resolved to `outstanding`) or `outstanding.zip`.
- `200` (dry run, `dryRun=true`) — `application/json`:
  ```json
  {
    "exportProfile": "HugoDownload",
    "count": 2,
    "blogs": [
      { "name": "WN1234", "langs": ["DE"] },
      { "name": "WN1235", "langs": ["DE", "EN"] }
    ]
  }
  ```
  No side effects — nothing is rendered, bundled, or marked.
- `200` (empty ZIP) — only if the profile sets `noContentBehavior:
  "emptyZip"` and nothing is outstanding.
- `404` — nothing outstanding and the profile's `noContentBehavior` is
  unset or `"404"` (the default): `No blogs available for outstanding
  export`.
- `409` — see Concurrency above.
- `422` — missing/unknown `exportProfile`, or profile has no `pathTemplate`.

### Example

```bash
# See what would be exported, without downloading or marking anything
curl "https://<host>/api/blogPreviewDownload/<apiKey>/outstanding?exportProfile=HugoDownload&dryRun=true"

# Actually pull it (and mark everything included as delivered)
curl -o outstanding.zip \
  "https://<host>/api/blogPreviewDownload/<apiKey>/outstanding?exportProfile=HugoDownload"
```
