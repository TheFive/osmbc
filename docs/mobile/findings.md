# Mobile UI findings

Shared artefact of the mobile UI review (see `platform-matrix.md` for the use
cases' frequency, the decisions and the X-items). One row per finding:

- **UC-ID**: use case from `use-cases.md` (several if the control serves several).
- **Viewport**: 390 = 390×844 (iPhone class), 412 = 412×915 (Android class),
  980 = a phone browser's "desktop view".
- **Class**: A hidden · B covered (fixed/overlay) · C unreachable (scroll/position) ·
  D touch target too small · E layout breaks (horizontal overflow, columns) ·
  F desktop-only interaction (drag, hover, tooltip) · G desktop-view trap ·
  H invisible behaviour (implicit save, no feedback).
- **Severity**: blocker / major / minor.
- **Mobile flow proposal**: written by the ux-reviewer.
- **Dev proposal | Effort | Risk**: left empty for the frontend-dev.

Sizes are CSS px of the rendered tap area (`getBoundingClientRect` of the
outermost interactive element), "gap" is the edge-to-edge distance between two
tap targets. Targets: at least 44 × 44 px, at least 8 px apart (the visible
part may be smaller than the tap area).

## X10 — tap targets (measured 2026-10-20)

Measured in mobile mode (cookie `osmbc_view=mobile`, one language DE, desktop
pair DE/EN) with headless Chrome mobile emulation at 390×844 and 412×915, test
data: one issue in edit, one in review with two review comments, articles with
3 collection links, 3 comments (one own), votes. Screens: start page, compact
header + language menu, offcanvas menu (+ Search submenu), article page (plain,
save bar, second language shown, comment edit), blog overview (+ inline
editor), review view (edit + review issue), full view, collect (+ search
result form), inbox, own user page, blog list. 412 px gives the same sizes as
390 px; differences are noted. Not rendered: the review form after "Start
Personal Review" (reasoned from `blogheader.pug`), guest screens, desktop view.

| UC-ID | Viewport | Class | Severity | Where (file/control) | Observation | Mobile flow proposal | Dev proposal | Effort | Risk |
|---|---|---|---|---|---|---|---|---|---|
| ART-01, ART-02, ART-04 | 390, 412 | E | major | `views/article/article_mixin.pug`, collection link list: `a.badge.text-bg-secondary` (link badge under the Collection field) | A long collection URL (or URL + link-check note like `#404` / error text) is one `badge` (`white-space: nowrap`): 429 px wide in the test. The page becomes 456 px wide at 390 and 412, the whole article page scrolls sideways and the header's language button sits outside the screen (x = 387–444). Real collections often have URLs longer than ~45 characters. | Link badge may wrap or is truncated with ellipsis (`text-truncate`, max-width 100 %), full URL on tap/long-press only. The page must never be wider than the screen (assert `scrollWidth <= innerWidth` in the mobile tests for the article page with a long URL). | | | |
| ART-02, ART-04 | 390, 412 | D | major | `views/article/article_mixin.pug`, per collection link: `button.insertLink` "+ Link", `button.insertTranslatedLink` "+ translated" (X7), the two document icons `a > i.fa-file-text` / `fa-file-text-o`, the `DE` `EN` links after the badge | "+ Link" 62×23, "+ translated" 102×23, gap 4 px between them, 0–1 px to the icons of the line above. Icons 12–16×17, touching each other (gap 0). Link badge 14.5 px high. `DE`/`EN` text links ~18×17. Per link the row wraps into 2 lines (46 px) when the URL is short enough to share the line, otherwise 3 lines. 3 links = 9–12 tap targets in ~70 px height. | One row per link, full width: URL (truncated, tap = open) on the first line, below one `d-flex flex-wrap gap-2` row with "+ Link" and "+ translated" at ≥ 44 px height (`btn` not `btn-sm`). Secondary link actions (readable text, translated page, DE/EN) into one "⋯" menu per link. | | | |
| ART-08 | 390, 412 | D, E | major | `views/article/commentArea.pug`, `form#AddComment`: "Add Comment" (`btn-lg btn-primary`), "Reload Comments", "Solve Comment" (`btn-lg btn-secondary`) | Three `btn-lg` (174–211×48) wrap into three stacked rows, 144 px high, **gap 0** between them and 0 to the text field. "Solve Comment" sends the comment directly, right below "Reload". | One primary action "Add Comment" (full width or right-aligned, ≥ 44 px). "Solve" as a checkbox/toggle "mark as solved" next to it, or in a "⋯" menu. "Reload" as an icon button in the "Comments" heading (or drop it: the area redraws after posting). Row `d-flex flex-wrap gap-2`, normal `btn`, not `btn-lg`. | | | |
| ART-09 | 390, 412 | D | major | `views/article/commentArea.pug`: `i.fa.fa-envelope` (mark read, `onclick` on the bare icon), `i.fa.fa-pencil#EditCommentN` (edit own comment) | Bare icons as controls: envelope 14×14, pencil 12×14, no padding. Envelope 1 px from the `@user` mention link. A wrong tap on the envelope marks the comment read with no undo on the page. | Icon buttons with a 44×44 tap area (`btn btn-link p-2` or a `::before` hit area), envelope on the right side of the comment header, away from the mention links. Alternatively: "mark read" as an explicit button under unread comments ("Mark as read"), and "Edit" in a "⋯" menu of own comments. | | | |
| ART-09 | 390, 412 | D | minor | `views/article/commentArea.pug`, `form#EditCommentForm`: "Update" / "Cancel" (`btn-lg`) | 103×48 and 99×48, touching each other (gap 0) and the text field (gap 0). | `d-flex gap-2 mt-2`, Update primary, Cancel secondary. | | | |
| ART-02, ART-15 | 390, 412 | D | minor | `views/article/article_mixin.pug`, save bar `.osmbc-save-bar`: `#saveButtonBar` "Save", `#cancelButtonBar` "last Version" | Save 61×38, "last Version" 117×38, gap 8 px. The main action of the most frequent use case is below 44 px and smaller than the secondary one. | Save ≥ 44 px high and the widest button (e.g. flex-grow), "last Version" as a smaller secondary/outline button on the left, so Save sits under the thumb on the right. | | | |
| ART-02, ART-03 | 390, 412 | D | minor | `views/article/article_mixin.pug`: `#toggleSecondLang` "Show EN"/"Hide EN", `#translateToSecondLang` "Translate → EN", "Translate from DE" (shown with the second language) | 87–166×38, gap 8 px between them. Only the height is short. | Keep, height ≥ 44 px (`btn` with `py-2` on mobile, or a mobile utility class for all buttons, see last row). | | | |
| ART-10 | 390, 412 | D | major | `views/article/article.pug` / `voteButtons.pug`: vote buttons `button.btn.osmbc-btn-not-voted` (thumbs-up / thumbs-down) under Predecessor | 61×38, **gap 0** between thumbs-up and thumbs-down, 0 px to the Predecessor select above. Tapping "pro" can hit "unpublish". The vote table at the page bottom ("Votes & Tags") has the same buttons at 36–62×38–62. | Vote buttons with `gap-2`, ≥ 44 px, and 8 px clearance to the select. "unpublish" vote visually distinct (outline danger) and not right next to "pro". | | | |
| ART-13 | 390, 412 | D | minor | `views/article/article_mixin.pug`: flag strip `img#<language>` (copy flag/emoji) | 9 flags 40×20, gap 0, in one row. Rare use (R). | Hide in mobile mode, or a "Flags…" button that opens a grid of ≥ 44 px cells. | | | |
| ART-05, ART-07 | 390, 412 | D | minor | `views/article/article.pug`: selects `#blog`, `#categoryEN`, `#predecessorId` (38 px high), `#noTranslationButton` "no translation to rest" (`btn-small`, 190×38), small text links (`Blog`, WORTLIGA, `[changes]`, 17–21 px high) | Full width, only the height is short. Link "Blog" touches the `#blog` select (gap 0). | Form controls ≥ 44 px on mobile (`form-control-lg` or a mobile rule). Text links in their own line with padding. | | | |
| BLOG-02, BLOG-08 | 390, 412 | D | major | `views/blog/blog_overview.pug`, `blog_review.pug`, `blog_full.pug`: edit icon `a > i.fa-edit` (open article) next to the inline-edit area `div[onclick]` | 9 icons per issue (test data; a real issue has 40–80) of 16×17, **2 px** from the text cell that opens the inline editor. Text cells of one-line articles are only 17 px high. The most used mobile writing path (inline edit) sits right next to a tiny "open in new tab" target: mis-taps open a new tab, or the editor instead of the article. | Whole article row = one tap target ≥ 44 px high that opens the inline editor. "Open article" as an icon button (44×44) at the right end of the row, or inside the opened editor next to Save/Cancel ("Open article"). | | | |
| BLOG-02, BLOG-08 | 390, 412 | D | minor | `views/blog/blog_mixin.pug` `mixin inlineEditorButtons`: `#inlineSaveN` "Save", `#inlineCancelN` "Cancel" (X3) | 61×38 and 78×38, gap 8 px. Height only. | ≥ 44 px high, Save primary on the right. | | | |
| BLOG-01, BLOG-05, BLOG-09 | 390, 412 | D | major | `views/blog/blogheader.pug` + `blog_mixin.pug` `blogReviewButtons`: `#readyreview` "Set WN… ready for review" / `#didexport` / `#closebutton` (`btn-lg`) directly above the tabs `a.nav-link` Overview / Full / Review and the export dropdown | Status button 315×48, only **2 px** above the tab row (tabs 58–96×35, gap 4 px between tabs). A tap on a tab that lands 3 px too high changes the language status (start review / close) — no confirmation. | Separate navigation and state change: tabs first (≥ 44 px, `nav-fill`), the status action in its own block with a short explanation, ≥ 16 px away, or in the sticky bottom bar of the review view. Close/Did Export with a confirmation. | | | |
| BLOG-10 | 390, 412 | D | minor | `views/blog/blogheader.pug`: `a#dropdownExportLanguages` (icon-only download dropdown in the tab row) | Icon only, 59×35, gap 4 px to the "Review" tab. Export is desktop only (D). | Hide in mobile mode (BLOG-10 = D), frees the tab row. | | | |
| BLOG-07 | 390, 412 | D | major | `views/blog/blogheader.pug` `mixin reviewBlog`: `a > i.fa-pencil` (edit own review comment) | Bare icon, 12×17, inline after the timestamp. The matrix already asks for "larger edit target than the pencil". | Tap on the own review comment text opens the edit form; or an "Edit" text button (≥ 44 px) under the own comment. | | | |
| BLOG-06 | 390, 412 | D | minor | `views/blog/blogheader.pug` `mixin reviewBlog`: "Review" / "cancel" (`btn-lg`) after "Start Personal Review"; "Change" in the edit form | Not rendered (state not set up). From the markup: two `btn-lg` side by side without gap class → touching (gap 0) like the comment area. "Start Personal Review" itself 240×48, fine. | `d-flex gap-2`, "Review" primary; "cancel" renamed "Stop review" and visually secondary. | | | |
| BLOG-04 | 390, 412 | D | minor | `views/blog/blog_overview.pug` / `blog_review.pug` / `blog_full.pug` "Options": `div.form-check` (16 per page in overview, 5 in review) | Checkbox rows 24 px high, gap 2–4 px. Rare (R). | Mobile: `form-check` rows with `py-2` (≥ 44 px), or collapse the options behind one "View options" button. | | | |
| BLOG-01, BLOG-03, BLOG-08 | 390 | E | minor | `views/blog/blog_review.pug`, `blog_full.pug`: lead picture block ("WN… Picture") | Page 407 px wide at 390 (17 px horizontal scroll). Not at 412. | Picture block max-width 100 %. Add the scrollWidth check to the blog mobile test for review/full. | | | |
| BLOG-01, BLOG-13, BLOG-14 | 390, 412 | D | minor | `views/blog/blog*.pug` footer: `[changes]`, `[Statistic]`, `[Edit Blog Detail]` | Text links 63–112×17, stacked in separate paragraphs (gap ≥ 8 px). | Fine to keep as text links if padded to ≥ 44 px height; Edit Blog Detail is D and could be hidden in mobile mode. | | | |
| COL-05, BLOG-01 | 390, 412 | D | major | `views/index.pug`, "Blogs to work on" table: count badges as links (`a > span.badge`) per issue × language | 12 links 21–73×16–27, gaps **0–6 px** (e.g. review/edit/written counts of one cell). The start page is the most used mobile screen by people (27). `(more)` and "click here" (admin) 17 px high. | One row per issue (not a table): issue name as a large link (≥ 44 px), counts as non-interactive badges; a second line "DE: 4 open · 4 written" with one link for the open ones. Admin link hidden in mobile mode (ADM = D). | | | |
| COL-03, ART-09 | 390, 412 | D | major | `views/inbox.pug`: `a > i.fa-envelope` (mark read), `a > i.fa-edit` (open article) | Envelope 14×17 per comment, edit icon 16×17, bare icons. Daily use case. | Comment card as one tap target (opens the article at the comment), "Mark read" as a text/icon button ≥ 44 px on the right; "Mark all read" per article. | | | |
| COL-01, COL-02 | 390, 412 | D | major | `views/collect.pug`: `#searchField` (156×38), `#searchButton` (`btn-lg`, 98×48); after search: `button#OK` (`btn-lg`, 63×48) and `a.btn` "Cancel" (78×38) | Search field only 40 % of the width and 38 px high, button on its own line below. OK and Cancel **touch (gap 0)** and have different heights; OK is the action that creates the article. Collect is a typical on-the-go task (22 %, 9 people). | Search field full width with the search button inside the same row (input group, ≥ 44 px). New-link form: OK as the one primary action (full width or sticky bottom bar like the article save bar), Cancel as a text link ≥ 8 px away. | | | |
| USR-02, USR-03 | 390, 412 | E | major | `views/user.pug`: bootstrap-select buttons `button.btn.dropdown-toggle.btn-light` (220 px, "Mail defined comments", "Translation Services" …) in a fixed label/field grid | Page 457 px wide at 390 (471 at 412): the menu button (`navbar-toggler`) sits outside the screen (x = 389–445 at 390). Inputs only 101–126 px wide. The header is the desktop one (app name, toggler on the right), not the compact X9 header. 21 % mobile use (10 people). | Label above field (`col-12`) on phones, selects full width. Check why this page does not get the X9 header. | | | |
| USR-02, USR-03 | 390, 412 | D | minor | `views/user.pug`: `input#save` "OK" (49×38), "logout user" / "Switch temporary to Guest" (`a.btn`, 115/231×38), OSM profile icons `fa-map` / `fa-line-chart` (14–16×17, gap 4) | Save of the profile is a 49 px "OK". Logout and Switch-to-guest stacked with **gap 0**. | "Save" as full-width primary; logout/guest in a separate "Account" block with gap. Profile icons as labelled links. | | | |
| BLOG-15 | 390, 412 | D | minor | `views/bloglist.pug`: issue links in the list table | 16 links 21–71×17, 7 pairs touching (gap 0). R. | Rows as list items ≥ 44 px. | | | |
| all | 390, 412 | D | minor | `views/layout.pug` header (X9): `button.navbar-toggler` 56×40, `a.navbar-brand` (issue link) 45–72×33 touching the toggler (**gap 0**), `#mobileLangMenu` 57×29; language menu items `a#mobileLang_XX.dropdown-item` 154×26, gap 2 | Toggler and issue link touch: a tap on the right half of the toggler edge opens the issue. Language button 29 px high. | Toggler 44×44, `ms-2` between toggler and issue link; language badge with a padded 44 px hit area (visual badge can stay); dropdown items `py-2`. | | | |
| all | 390, 412 | D | minor | `views/layout.pug` offcanvas menu (X1): `a.nav-link` (Collect, Inbox, issues, Search, Tools, Help) 353×33–35, gap 4; Search submenu `a.dropdown-item` 351×26, **gap 0**; `button.btn-close` 30×30; avatar `img` 40×40 | Full width, so only height/gap. Submenu items 26 px high and touching. Close button 30×30 at the top right corner. | Menu entries `py-2` (≥ 44 px), submenu items as indented list entries ≥ 44 px, close button with a 44 px hit area. | | | |
| all | 390, 412 | D | minor | Bootstrap default `.btn` / `.form-control` / `.form-select` (38 px) across all pages | Every normal button and input is 38 px high, `btn-lg` 48 px. That is why the views use `btn-lg` as a general "make it touchable" style, which then wraps (comment area, review). | One mobile rule instead of `btn-lg` per view: in mobile mode `.btn, .form-control, .form-select { min-height: 44px }`, button rows `d-flex flex-wrap gap-2`; `btn-lg` only for the one primary action of a block. | | | |

### Summary — top 5 (frequency of the use case × severity)

Frequencies from `platform-matrix.md` ("Freq." and "Measured mobile").

1. **Article page wider than the phone with long collection URLs** (ART-01/02,
   very high, 21/11 people on phones; E major): the link badge does not wrap,
   the whole page scrolls sideways and the header's language button is off
   screen. Together with the cramped collection link rows (ART-02/04: "+ Link"
   / "+ translated" 23 px high, 4 px apart, icons 16×17 touching).
2. **Blog views: 16×17 edit icon 2 px beside the inline-edit row** (BLOG-02/08,
   many per issue, the most used mobile writing path; D major): mis-taps open
   the article in a new tab instead of the editor; one-line rows only 17 px high.
3. **Comment area** (ART-08 25 % mobile, ART-09 weekly; D/E major): three
   stacked `btn-lg` with 0 px gaps (144 px) and bare envelope (14×14) / pencil
   (12×14) icons; the same envelope in the inbox (COL-03, daily).
4. **Start page "Blogs to work on"** (COL-05, daily, most people on phones: 27;
   D major): count badges 16–27 px high with 0–6 px gaps.
5. **Status button 2 px above the blog tabs** (BLOG-01 daily, BLOG-05/09; D
   major): "ready for review" / "Close" / "Did Export" without confirmation
   right above Overview/Full/Review — a slightly high tap changes the
   language status.

Next in line: collect OK/Cancel touching (COL-01, 22 %), user page wider than
the phone with the menu button off screen (USR-02, 21 %), vote buttons
touching (ART-10, 21 %), save bar Save only 38 px (ART-02).
