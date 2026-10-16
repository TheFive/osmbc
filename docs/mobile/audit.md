# Mobile UI audit (code-based)

Status: 2026-10-10. A general check of the views, derived from the first
mobile bug reports (GitHub milestone "MobileUI Improvement", #1154, #1155).
It is based on the pug/CSS code and on screenshots from the reports, not on a
systematic device test. Device verification is the next step (see
`findings.md`, ux-reviewer).

## Finding classes

| Class | Meaning | Typical user report |
|---|---|---|
| A | hidden (control removed on small screens) | "I can't find X" |
| B | covered (fixed/overlay element over content) | "X is gone after I did Y" |
| C | unreachable (action far away from where you work, scrolling) | "I can't save" |
| D | touch target too small | "I can't tap it" |
| E | layout breaks (overflow, columns, tables) | "the page is cut off" |
| F | desktop-only interaction (drag, hover, tooltip) | "nothing happens" |
| G | trap of the browser's "desktop view" | workaround makes it worse |
| H | invisible behaviour (implicit save, no feedback) | "I can't save" |

## The reported cases

| Report | Class | Cause |
|---|---|---|
| #1154 Translate missing | A | `views/article/article_mixin.pug` `mixin translationMenu`: `li#translation.d-none.d-sm-block` hides the menu below 576 px. |
| #1155 Save missing after translating (desktop view on a phone) | B, C, G | Save is at the top of the article form (`views/article/article.pug`), the text being translated is far below. The navbar is `fixed-top` (`views/layout.pug`); at ~980 px (below `lg`) it is collapsed, and once opened it stays open over ~40 % of the screen. Clicking a dropdown action does not close it. |
| Blog view: "edited an article, can't save" | H (hypothesis) | The inline editor in the blog views (`blog_overview.pug`, `blog_review.pug`, `blog_tbc.pug`) has **no Save button**. It submits on the textarea's `onchange` (`onLeaveText` in `blog/blog_mixin.pug`), i.e. only when the field loses focus. On a phone there is no visible way to save, and leaving the page or switching apps may not trigger the change event. To verify. |

## Systemic findings

### 1. Functions disappear instead of moving (class A)

About 50 places hide content below `sm`/`md`; only 2 offer a mobile
replacement. Most are labels and help text (harmless). Function losses:

| Where | Hidden on phones | Effect |
|---|---|---|
| `article/article_mixin.pug:131` | Translate menu | cannot auto-translate (#1154) |
| `blog/blogheader.pug:206` | review/close buttons of the **second** language | second language cannot be set to review, closed or marked exported |
| `blog/blogheader.pug:170` | progress bar of the second language | no status of the second language |
| `blog/blogheader.pug:212` | review comments of the second language | |
| `blog/blogheader.pug:220,234,242` | filter tab, per-language preview/download links | export dropdown remains; filter only via scrolling to `#filter` |
| `blog/blog_full.pug:75,136` | second language column | Full view shows one language only |
| `blog/blog_overview.pug` (11×), `blog/blog_review.pug` | collector/editor/language/vote columns | status of an article not visible in the list |
| `blog/blog_review.pug:99,102,113` | parts of the view options | some options cannot be switched on a phone |
| `index.pug:114` (`d-lg-block`) | "Last changes" on the start page | hidden up to 992 px |
| `article/article.pug:218` | history table | replaced by a `[changes]` link (one of the 2 real replacements) |

Note: hiding the second language is in effect already a *mobile flow* ("work
on one language at a time"). It is just incomplete: the actions for that
language are missing too, and switching languages goes through the language
dropdowns in the navbar.

### 2. Table cells hidden with `td.d-none.d-md-block` (class E, also desktop)

`blog/blog_overview.pug` hides `td` elements with `d-md-block`. From `md`
upwards that sets `display: block` instead of `table-cell`, so the hidden
columns break the table layout **on the desktop as well**. Correct would be
`d-none d-md-table-cell` (as `collect.pug` does).

### 3. Navbar (classes B, G)

- `fixed-top` with a fixed `body { padding-top: 50px }` (`public/stylesheets/style.css`).
  If the bar is higher (wrapping items, opened menu), it covers content.
- The opened collapse has no `max-height`/scrolling and does not close after an
  action. With many items (blogs, Search, Tools, Translate, Help, three
  language dropdowns, avatar) it fills much of a phone screen.
- The three language dropdowns are full-width coloured blocks on phones.
- `navbar-expand-lg`: the "desktop view" of phone browsers (~980 px) lands
  exactly below the breakpoint, i.e. desktop layout with a mobile navbar.

### 4. No mobile CSS at all

`public/stylesheets/style.css` has **no `@media` rule**. All responsiveness
comes from Bootstrap grid classes in the views.

### 5. Desktop-only interactions (class F)

- Language badges in the article view (`mixin markdownWithPreview` in
  `article/article_mixin.pug`): "Drag me for copy full text" (`ondragstartLangLabel`).
  No tap alternative → copying a full language text is impossible on touch.
- Tooltips (`data-bs-toggle="tooltip"`) carry the only explanation for several
  badges; tooltips need hover.
- Collection links ("Drag me to a markdown field") have a paste alternative;
  calendar flags have a click alternative. Both fine.

### 6. Actions far from the work (class C)

Article view: Save and "last Version" sit at the top of the form, the
markdown fields of the languages below. On a phone (one column) the distance
is several screens.

### 7. Small things

- **Correction 2026-10-16:** the article page always renders
  `article/article_all_column.pug` (`routes/article.js`). The other column
  templates (`article_onecolumn/twocolumn/threecolumn/fourcolumn.pug`) and
  `showRL` are dead code. In `article_all_column.pug` every language of the
  user gets a column with `min-width: 400px` → wider than a phone screen (E,
  major, X8 in the matrix). Clicking a language badge does nothing.
- `btn-sm` in the article translate buttons, `blog_full`, `blog_review` (D, minor).
- 18 of the ~40 tables use `table-responsive`; admin/config and history tables
  mostly do not (E, mostly desktop-only use cases anyway).

## Consequences for the use-case set

- Simply removing `d-none` is not a fix: a phone screen cannot take the
  desktop's two-language layout. The mobile design should state which flow
  is intended (e.g. one language at a time, one primary action per screen,
  explicit Save) and then make *all* actions of that flow reachable.
- Cross-cutting changes come first because they affect almost every use case:
  navbar (height, auto-close, language switch), a reachable primary action
  (Save) in the article view, explicit save in the blog inline editor.
- Admin/config pages are candidates for "desktop only" — to be decided per
  use case in the platform matrix.
