# Hugo export front matter

The `HUGO` renderer ([render/HugoMarkdownRenderer.js](../render/HugoMarkdownRenderer.js))
prepends a TOML front-matter block (`+++ … +++`) to every rendered issue,
one file per language. It is produced by `_generateFrontText(lang, …)` and
looks like this:

```toml
+++
date = 2024-01-07
draft = false
title = '''weeklyOSM 703'''
aliases = ['/archives/16247', '/en/archives/16247']
featureImage = '''https://example.com/lead.png'''
featureImageCap = '''[¹](#wn703_12345) the lead picture'''
+++
```

| Field | Source | Notes |
|---|---|---|
| `date` | `blog.endDate` + `Hugo.DateAdjust` days, in `Europe/Berlin`, as `YYYY-MM-DD` | `DateAdjust` is a config knob (see [docs/config.md](config.md)); it shifts the collection end date forward to the intended publication date. |
| `draft` | always `false` | |
| `title` | `"<blog title for export> <issue number>"` | Blog title per language from `categorytranslation` (the row whose `EN` equals `"Blog Title For Export"`), issue number from `blog.name.substring(2,10)`. |
| `aliases` | `slugalias.json` — see below | Omitted entirely when the issue has no mapping. |
| `featureImage` | first Picture-category article's image URL | Omitted when there is no lead picture. |
| `featureImageCap` | that article's caption markdown | `^text^` superscript is folded to Unicode characters here — front matter runs no shortcodes, unlike the content body. Omitted when empty. |

Empty optional lines are dropped, not emitted as blank lines.

## `aliases` — keeping the old weeklyosm.eu URLs alive

### Background

Before the Hugo migration, issues were WordPress posts on `weeklyosm.eu`.
Their permalink was:

```
https://www.weeklyosm.eu/<lang>/archives/<postId>     e.g. /de/archives/16247
https://www.weeklyosm.eu/archives/<postId>            English (the default language) had no prefix
```

After the migration the issue URL is derived from the issue number
(`HugoDownload.pathTemplate` = `##lang##/archives/##blogNumber-4-digits##`,
e.g. `/de/archives/0703`), so the old post-id URLs would 404. A Hugo
[alias](https://gohugo.io/content-management/urls/#aliases) makes Hugo
generate a tiny redirect page at the old path that forwards to the new one.

### Data source: `data/slugalias.json`

A file supplied by the weeklyOSM WordPress admin, mapping issue number →
WordPress post id:

```json
{
  "219": 214,
  "703": 16247,
  "841": 18849
}
```

- Covers the **weeklyosm.eu era only** (WN 219–841 at the time of writing).
  Gaps exist for issue numbers that were never published on weeklyosm.eu.
- Issues **before** WN 219 (the old `blog.openstreetmap.de` era, slug-based
  URLs on a different domain) are deliberately **out of scope** — those
  redirects, if ever wanted, belong at the web-server level, not in this
  front matter.
- The file is read once at module load. If it is missing, the export still
  works — issues just get no `aliases` line.

### What gets emitted

For an issue in the map with post id `P`, rendered in language `L`:

| Language | `aliases` line |
|---|---|
| `EN` | `aliases = ['/archives/P', '/en/archives/P']` |
| any other | `aliases = ['/<segment>/archives/P']` |

`<segment>` is `language.wpExportName(L).toLowerCase()`. Brazilian Portuguese
gets a **second** alias for a historical segment:

| OSMBC language id | URL segments | why |
|---|---|---|
| `BR` | `br`, `pb` | weeklyosm.eu served Brazilian Portuguese under `/pb/` until the qtranslate language code was renamed to `br` (~mid-2024, matching OSMBC's id). qtranslate recomputes every permalink from the current config, so the whole archive now also answers under `/br/`. Both forms exist in old newsletters / external links, so both are aliased. |

The alias is emitted for **every language OSMBC exports for the issue**.
If a language did not exist on weeklyosm.eu back then, its alias simply
points at a page nobody requests — harmless.

### Maintenance

- New issues: extend `data/slugalias.json` with the new `"<WN>": <postId>`
  pair (get the post id from the WordPress admin) and re-export.
- The extra-segment table lives in `WP_ARCHIVE_EXTRA_SEGMENTS` in
  [render/HugoMarkdownRenderer.js](../render/HugoMarkdownRenderer.js).
- Tests: `test/render.blogrenderer.test.js`, `describe("hugoMarkdownFrontMatterAliases")`,
  plus fixture `test/data/render.blog.preview.6.md` (WN823).

## See also

- [docs/export-profiles.md](export-profiles.md) — the `HugoDownload`
  profile and its `pathTemplate`.
- [docs/API.md](API.md) — the export endpoints that produce Hugo bundles.
