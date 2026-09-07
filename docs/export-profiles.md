# `ExportProfiles` configuration

`ExportProfiles` is a top-level map in `config.<env>.yaml`. Each key is a
profile name referenced by callers as the `exportProfile` value — in the web
UI's "Export" menu ([routes/layout.js](../routes/layout.js)) and in the
public API ([docs/API.md](API.md), `GET /api/blogPreviewDownload/...`).

```yaml
ExportProfiles:
  HugoDownload:
    renderer: HUGO
    pathTemplate: "##lang##/archives/##blogNumber-4-digits##"
    fileNameTemplate: "Hugo-##blogName##"
    guiEnabled: true
    guiLabel: Export All as Hugo (*.zip)
    guiLangMode: all
    guiOrder: 20
    noContentBehavior: emptyZip
```

There is no schema validation — an unknown/misspelled field is silently
ignored, and a required field that's missing usually only surfaces the first
time that code path runs (see "Fields with no confirmed effect" below for a
concrete case of the former).

## Fields

| Field | Used by | Meaning |
|---|---|---|
| `renderer` | `model/blog.js` (`buildPreviewExport`, single-blog, `outstanding` and `closedSince` export) | Renderer type, e.g. `HTML`, `MARKDOWN`, `HUGO`. Defaults to `"HTML"` if omitted. |
| `rendererOptions` | same | Passed through verbatim to the renderer (e.g. `{ target: "editor" }` / `{ target: "production" }` for `HTML`). |
| `pathTemplate` | `model/blog.js`, `routes/api.js` (`outstanding`, `closedSince`) | Path of each file **inside** a zip bundle. Placeholders: `##lang##`, `##blogNumber-4-digits##`. **Required** for the `outstanding`/`closedSince` bulk-export endpoints — a profile without it is rejected with `422` before any blog is even looked up. Not required for the single-blog route. |
| `fileNameTemplate` | `model/blog.js`, `routes/api.js` | Download filename. Placeholders: `##blogName##`, `##renderer##`, `##langList##`, `##blogNumber-4-digits##`. For `outstanding`/`closedSince`, every placeholder is replaced with the literal string `outstanding`/`closedsince` (there's no single blog to name it after), e.g. `"Hugo-##blogName##"` → `Hugo-outstanding.zip` / `Hugo-closedsince.zip`. |
| `noContentBehavior` | `routes/api.js` (`outstanding`, `closedSince`) | `"404"` (default, also applies if the field is absent) → HTTP 404 when nothing matches. `"emptyZip"` → HTTP 200 with an empty zip instead. Has no effect on the single-blog route (there, an unresolvable blog is always `404`). |
| `guiEnabled` | `routes/layout.js` | Must be `true` for the profile to appear in the web UI's export menu at all. Profiles used only via the API (no UI entry point) can safely omit or set this `false`. |
| `guiLabel` | `routes/layout.js` | Menu label text. Falls back to the profile name if omitted. |
| `guiLangMode` | `routes/layout.js`, `views/blog/blogheader.pug` | `"single"` (default) shows one menu entry per configured language; `"all"` shows one combined "all languages" entry. Purely a UI menu-shape switch — unrelated to the `outstanding` endpoint's own `lang=ALL` query param. |
| `guiOrder` | `routes/layout.js` | Sort key for menu position (ascending); ties broken alphabetically by `guiLabel`. Defaults to `999` (sorts last) if omitted. |

## Fields with no confirmed effect

`bundleMode`, `includeLanguageMarkers`, and `download` appear in the
repo's example config ([config.test.yaml](../config.test.yaml)) on most
profiles, but as of this writing no `.js` code path reads
`profileConfig.bundleMode`, `profileConfig.includeLanguageMarkers`, or
`profileConfig.download` (confirmed via repo-wide grep). Whether a bundle
becomes a raw file vs. a zip is actually decided by the renderer/language
count at render time, not by a `bundleMode` config key; the export menu's
`download=true` query flag is hardcoded in
[views/blog/blogheader.pug](../views/blog/blogheader.pug), not sourced from
the profile's `download` field.

Treat these three as either dead config or reserved for a renderer-internal
code path that wasn't covered by this audit — don't rely on them to change
behavior, and don't copy them into a new profile assuming they do something.
If you find the code path that does consume one of them, please update this
table instead of re-guessing next time.

## See also

- [docs/hugo-export.md](hugo-export.md) — the TOML front matter the `HUGO`
  renderer prepends to each issue (`date`/`title`/`aliases`/`featureImage`),
  including the `slugalias.json` old-URL redirect mechanism.
- [docs/API.md](API.md) — caller-facing documentation of the routes that
  consume `ExportProfiles` (`blogPreviewDownload/:blog_id`,
  `blogPreviewDownload/outstanding` and `blogPreviewDownload/closedSince`),
  including the full `noContentBehavior` behavior, response codes, and
  worked `curl` examples.
- [model/blog.js](../model/blog.js) `buildPreviewExport()` JSDoc — the
  lowest-level renderer contract (`renderer`/`rendererOptions`/
  `pathTemplate`/`fileNameTemplate` and their placeholder syntax).
