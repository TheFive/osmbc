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
| ART-01, ART-02, ART-04 | 390, 412 | E | major | `views/article/article_mixin.pug`, collection link list: `a.badge.text-bg-secondary` (link badge under the Collection field) | A long collection URL (or URL + link-check note like `#404` / error text) is one `badge` (`white-space: nowrap`): 429 px wide in the test. The page becomes 456 px wide at 390 and 412, the whole article page scrolls sideways and the header's language button sits outside the screen (x = 387–444). Real collections often have URLs longer than ~45 characters. | Link badge may wrap or is truncated with ellipsis (`text-truncate`, max-width 100 %), full URL on tap/long-press only. The page must never be wider than the screen (assert `scrollWidth <= innerWidth` in the mobile tests for the article page with a long URL). | **P1, own fix, mobile only.** Correction: the badge is not in `article_mixin.pug`, it is built client-side in `public/javascripts/article_view.js` `onchangeCollection()`. `linkShortener()` already cuts URLs over 50 characters to 52; the width comes from text appended later: ` #(Check for Doublette)` and ` #<status>` from `highlightWrongLinks()` (`osmbc_staff.js`, appends to every `a` in `#linkArea`). Fix in `style.css`: `.osmbc-mobile #linkArea .badge { white-space: normal; overflow-wrap: anywhere; text-align: start; max-width: 100%; }`. Wrap, not ellipsis: an ellipsis would cut off exactly the link-check result (`#404`) at the end of the badge. Mobile class: see the global rule (last row). Test: `scrollWidth <= innerWidth` on the article page with a long URL, a doublette and a failing link check. | S | low – CSS only, mobile only, desktop DOM unchanged. |
| ART-02, ART-04 | 390, 412 | D | major | `views/article/article_mixin.pug`, per collection link: `button.insertLink` "+ Link", `button.insertTranslatedLink` "+ translated" (X7), the two document icons `a > i.fa-file-text` / `fa-file-text-o`, the `DE` `EN` links after the badge | "+ Link" 62×23, "+ translated" 102×23, gap 4 px between them, 0–1 px to the icons of the line above. Icons 12–16×17, touching each other (gap 0). Link badge 14.5 px high. `DE`/`EN` text links ~18×17. Per link the row wraps into 2 lines (46 px) when the URL is short enough to share the line, otherwise 3 lines. 3 links = 9–12 tap targets in ~70 px height. | One row per link, full width: URL (truncated, tap = open) on the first line, below one `d-flex flex-wrap gap-2` row with "+ Link" and "+ translated" at ≥ 44 px height (`btn` not `btn-sm`). Secondary link actions (readable text, translated page, DE/EN) into one "⋯" menu per link. | **P1, own change, mobile only.** In `onchangeCollection()` build a different row when `document.documentElement.classList.contains("osmbc-mobile")`: line 1 the badge (wraps, see above; tap = open); line 2 `div.d-flex.flex-wrap.gap-2` with "+ Link" / "+ translated" as normal `btn btn-outline-primary` (drop `btn-sm py-0`; keep the classes `insertLink`/`insertTranslatedLink` that `ArticlePage` uses) and one "⋯" Bootstrap dropdown built in JS (listeners attached in JS, no inline handlers) with "Readable text" / "Page content" (today the two `fa-file-text*` icons) and the DE/EN translate links. Rows separated by `mb-2` instead of `<br>`. Desktop keeps building today's row. Note: the insert buttons are hidden by breakpoint (`d-lg-none`), the new row by mode; in a phone's desktop view (980 px) the old row with the insert buttons stays, which is fine. | M | medium – X7 tests (`uc.article.mobile`, `ArticlePage` mobile section) use these buttons; `#linkArea` is rebuilt on every keyup in `#collection`, so an open "⋯" menu closes while typing (acceptable). |
| ART-08 | 390, 412 | D, E | major | `views/article/commentArea.pug`, `form#AddComment`: "Add Comment" (`btn-lg btn-primary`), "Reload Comments", "Solve Comment" (`btn-lg btn-secondary`) | Three `btn-lg` (174–211×48) wrap into three stacked rows, 144 px high, **gap 0** between them and 0 to the text field. "Solve Comment" sends the comment directly, right below "Reload". | One primary action "Add Comment" (full width or right-aligned, ≥ 44 px). "Solve" as a checkbox/toggle "mark as solved" next to it, or in a "⋯" menu. "Reload" as an icon button in the "Comments" heading (or drop it: the area redraws after posting). Row `d-flex flex-wrap gap-2`, normal `btn`, not `btn-lg`. | **P3, own change, all widths.** The 0 px gap is on desktop too: pug renders the three buttons without whitespace. `views/article/commentArea.pug`: wrap them in `div.d-flex.flex-wrap.gap-2.mt-2`, normal `btn` instead of `btn-lg` (mobile height from the global rule). "Reload Comments" → icon button (`btn btn-link`, `fa-refresh`, `aria-label`) in the "Comments (…)" heading, or drop it (PO decision; the area already redraws after add/edit/mark-read, Reload only fetches other people's new comments). "Solve Comment" appends ` #solved` and posts at once. Option A (cheap): keep it as `btn-outline-secondary` with a gap. Option B (reviewer): a "mark as solved" checkbox that adds `#solved` on Add. That changes behaviour: solving without a text needs an exception, because Add refuses an empty text today. The three inline `onclick`s → `data-action` + one delegated listener in `article_view.js` on `#commentArea` (it must be delegated, because `callAndRedraw` replaces the HTML). | M | medium – desktop look changes (smaller buttons, gaps); `uc.article` comment tests click these buttons: keep `name="AddComment"` and the labels, or adjust `ArticlePage`. |
| ART-09 | 390, 412 | D | major | `views/article/commentArea.pug`: `i.fa.fa-envelope` (mark read, `onclick` on the bare icon), `i.fa.fa-pencil#EditCommentN` (edit own comment) | Bare icons as controls: envelope 14×14, pencil 12×14, no padding. Envelope 1 px from the `@user` mention link. A wrong tap on the envelope marks the comment read with no undo on the page. | Icon buttons with a 44×44 tap area (`btn btn-link p-2` or a `::before` hit area), envelope on the right side of the comment header, away from the mention links. Alternatively: "mark read" as an explicit button under unread comments ("Mark as read"), and "Edit" in a "⋯" menu of own comments. | **P3, own change, all widths.** Replace the bare `i.fa-envelope` / `i.fa-pencil` (inline `onclick` on the icon) with `button.btn.btn-link.p-2` around the icon (`aria-label` "Mark as read" / "Edit comment", `data-action` + the delegated listener from ART-08). Comment header as `d-flex`, envelope at the end (`ms-auto`), away from the name and the mentions. Prefer this over a mobile-only "Mark as read" text button: one variant for all widths, no second markup. "Undo" is not proposed: mark-read means "read up to here", the same as today. | S | low – `#EditCommentN` ids stay; the envelope moves to the right on desktop too. |
| ART-09 | 390, 412 | D | minor | `views/article/commentArea.pug`, `form#EditCommentForm`: "Update" / "Cancel" (`btn-lg`) | 103×48 and 99×48, touching each other (gap 0) and the text field (gap 0). | `d-flex gap-2 mt-2`, Update primary, Cancel secondary. | **P3, own change, all widths** (the gap is 0 on desktop too). `div.d-flex.gap-2.mt-2` around Update/Cancel in `commentArea.pug`, normal `btn` (mobile height from the global rule). Inline `onclick`s → the delegated listener from ART-08. Done together with ART-08. | S | low – same file and listener as ART-08. |
| ART-02, ART-15 | 390, 412 | D | minor | `views/article/article_mixin.pug`, save bar `.osmbc-save-bar`: `#saveButtonBar` "Save", `#cancelButtonBar` "last Version" | Save 61×38, "last Version" 117×38, gap 8 px. The main action of the most frequent use case is below 44 px and smaller than the secondary one. | Save ≥ 44 px high and the widest button (e.g. flex-grow), "last Version" as a smaller secondary/outline button on the left, so Save sits under the thumb on the right. | **Height covered by the global rule.** Own part, P1, below lg only (the bar is only shown there): in `article_mixin.pug` `.osmbc-save-bar`, put "last Version" first as `btn-outline-secondary`, and Save last with `flex-grow-1`, so Save is the widest button, on the right under the thumb. Move the two inline `onclick`s to `article_view.js` while editing those lines. Desktop does not show the bar. | S | low – ids `#saveButtonBar` / `#cancelButtonBar` stay (`uc.article.mobile` through `ArticlePage`); that test measures the bar with `getBoundingClientRect` → rerun. |
| ART-02, ART-03 | 390, 412 | D | minor | `views/article/article_mixin.pug`: `#toggleSecondLang` "Show EN"/"Hide EN", `#translateToSecondLang` "Translate → EN", "Translate from DE" (shown with the second language) | 87–166×38, gap 8 px between them. Only the height is short. | Keep, height ≥ 44 px (`btn` with `py-2` on mobile, or a mobile utility class for all buttons, see last row). | **Covered by the global rule.** No own work. | – | low |
| ART-10 | 390, 412 | D | major | `views/article/article.pug` / `voteButtons.pug`: vote buttons `button.btn.osmbc-btn-not-voted` (thumbs-up / thumbs-down) under Predecessor | 61×38, **gap 0** between thumbs-up and thumbs-down, 0 px to the Predecessor select above. Tapping "pro" can hit "unpublish". The vote table at the page bottom ("Votes & Tags") has the same buttons at 36–62×38–62. | Vote buttons with `gap-2`, ≥ 44 px, and 8 px clearance to the select. "unpublish" vote visually distinct (outline danger) and not right next to "pro". | **P2, own change, all widths.** `views/mixins.pug` `mixin voteButtonList` and `views/voteButtonsList.pug`: put the buttons in a `div.d-flex.flex-wrap.gap-2` (gap 0 on desktop too, no whitespace between buttons). Inside the mixin, not around the include: `routes/article.js` re-renders `voteButtons.pug` with `renderFile` and replaces `#voteButtons`. Spacing to the select: `.osmbc-mobile #voteButtons { margin-top: .5rem }`. Height from the global rule. "unpublish" in a different style or position: votes, icons, colours and order come from the config (`votes`, `displayAtTop`), not from the view → change the order in the config, or add a style flag per vote (PO decision). Inline `onclick` → `data-vote-url` + delegated listener. | S (gap) / M (with listener) | medium – the redraw via `renderFile` must keep the wrapper; `uc.article` vote tests click these buttons. |
| ART-13 | 390, 412 | D | minor | `views/article/article_mixin.pug`: flag strip `img#<language>` (copy flag/emoji) | 9 flags 40×20, gap 0, in one row. Rare use (R). | Hide in mobile mode, or a "Flags…" button that opens a grid of ≥ 44 px cells. | Correction: the strip is in `views/article/article_all_column.pug` (`.row#languageFlags`), not in `article_mixin.pug`. **P4, own change, mobile only:** `class=layout.mobileView ? "d-none" : undefined` on `#languageFlags` and its help text. Hide it, don't drop it: `article_view.js` `addLanguageFlags()` reads the `img.flag` src to render flag emojis in the preview, so removing the markup breaks the preview. A "Flags…" grid only if the PO wants flags on phones (R use case; today a tap shows an `alert`). | S | low – mobile only; flag emojis in the preview must keep working (check in the mobile article test). |
| ART-05, ART-07 | 390, 412 | D | minor | `views/article/article.pug`: selects `#blog`, `#categoryEN`, `#predecessorId` (38 px high), `#noTranslationButton` "no translation to rest" (`btn-small`, 190×38), small text links (`Blog`, WORTLIGA, `[changes]`, 17–21 px high) | Full width, only the height is short. Link "Blog" touches the `#blog` select (gap 0). | Form controls ≥ 44 px on mobile (`form-control-lg` or a mobile rule). Text links in their own line with padding. | **Height covered by the global rule** (`#categoryEN`, `#predecessorId` are `select.form-control`, `#blog` comes from `+blogSelector`). `#noTranslationButton` has `btn-small`, which is not a Bootstrap class (no effect) → remove it; the button then counts as a normal `.btn` (global rule). Own part, P4, mobile only: the text links ("Blog" is `a.col-sm-2.col-form-label`, WORTLIGA, `[changes]`) get a class `osmbc-text-link` with `.osmbc-mobile .osmbc-text-link { display: inline-block; padding-block: .625rem; }`. | S | low – mobile only. |
| BLOG-02, BLOG-08 | 390, 412 | D | major | `views/blog/blog_overview.pug`, `blog_review.pug`, `blog_full.pug`: edit icon `a > i.fa-edit` (open article) next to the inline-edit area `div[onclick]` | 9 icons per issue (test data; a real issue has 40–80) of 16×17, **2 px** from the text cell that opens the inline editor. Text cells of one-line articles are only 17 px high. The most used mobile writing path (inline edit) sits right next to a tiny "open in new tab" target: mis-taps open a new tab, or the editor instead of the article. | Whole article row = one tap target ≥ 44 px high that opens the inline editor. "Open article" as an icon button (44×44) at the right end of the row, or inside the opened editor next to Save/Cancel ("Open article"). | Correction: the edit icon (`views/mixins.pug` `mixin articleIcons`, `a(href=/article/<id>)`) has no `target`, so it opens the article **in the same tab**, not a new one. A pending inline edit is autosaved on blur (X3), so nothing is lost, but the user leaves the issue view. **P2, own change, mobile only.** (a) The `fa-edit` link gets a 44×44 hit area: class `osmbc-article-open` only when `layout.mobileView`, plus `.osmbc-mobile .osmbc-article-open { display: inline-block; padding: .75rem; margin: -.5rem; }`. (b) The inline-edit trigger `div(onclick=…)` (the same handler copied 4× in `blog_overview.pug`, `blog_review.pug`, `blog_full.pug` ×2) gets `min-height: 44px` in mobile mode; the handler moves to `data-inline-editor="div<id>"` + one delegated listener (script block in `blog_mixin.pug` or a new `public/javascripts/blog_view.js`). (c) An "Open article" link next to Save/Cancel in `mixin inlineEditorButtons` (all widths, cheap). The row is already the tap target, it just has no height. Moving the icon to the right end of the row would need a new table cell on phones (not proposed). | M | medium – `uc.blog` / `uc.blog.mobile` open the editor by clicking that div; moving the handler changes the desktop DOM → regenerate the `uc.blog` HTML snapshots (`expectHtml`) and review the diff. |
| BLOG-02, BLOG-08 | 390, 412 | D | minor | `views/blog/blog_mixin.pug` `mixin inlineEditorButtons`: `#inlineSaveN` "Save", `#inlineCancelN` "Cancel" (X3) | 61×38 and 78×38, gap 8 px. Height only. | ≥ 44 px high, Save primary on the right. | **Covered by the global rule** (height). "Save on the right": today Save is first (left). Swapping changes desktop too; `flex-row-reverse` only in mobile mode is possible but not worth it. The inline `onclick`/`onmousedown` move to data attributes together with BLOG-02. | – (S if swapped) | low |
| BLOG-01, BLOG-05, BLOG-09 | 390, 412 | D | major | `views/blog/blogheader.pug` + `blog_mixin.pug` `blogReviewButtons`: `#readyreview` "Set WN… ready for review" / `#didexport` / `#closebutton` (`btn-lg`) directly above the tabs `a.nav-link` Overview / Full / Review and the export dropdown | Status button 315×48, only **2 px** above the tab row (tabs 58–96×35, gap 4 px between tabs). A tap on a tab that lands 3 px too high changes the language status (start review / close) — no confirmation. | Separate navigation and state change: tabs first (≥ 44 px, `nav-fill`), the status action in its own block with a short explanation, ≥ 16 px away, or in the sticky bottom bar of the review view. Close/Did Export with a confirmation. | Confirmed: `setLangStatus` (script block in `blog_mixin.pug`) posts without a confirmation. **P2, own change.** (a) Spacing, mobile only: status column (`.col-md-3` with `+blogReviewButtons`) `mb-3`; `ul.nav.nav-tabs` with `nav-fill` (`class=layout.mobileView ? "nav-fill" : undefined`); tabs ≥ 44 px with `.osmbc-mobile .nav-tabs .nav-link { padding-block: .625rem; }`. (b) Confirmation for Close / Did Export (and "ready for review"?): one Bootstrap modal per page (`#confirmLangStatus`, text set by JS), all widths or mobile only → PO decision. Inline `onclick=window.setLangStatus(…)` → `data-lang-status` / `data-lang` + delegated listener. Status action below the tabs or in a bottom bar: not in X10 (third layout variant of the header); spacing and a confirmation already stop the mis-tap. Side find: `setLangStatus` does `$(button).prop('html', "wait ...")`, which sets a DOM property; the label never changes → `.text("wait …")`. | M | medium – a confirmation adds a step for desktop users (if all widths) and for the `uc.blog` tests that click `#readyreview` / `#closebutton` / `#didexport` (`BlogPage` must confirm); tab changes are mobile only. |
| BLOG-10 | 390, 412 | D | minor | `views/blog/blogheader.pug`: `a#dropdownExportLanguages` (icon-only download dropdown in the tab row) | Icon only, 59×35, gap 4 px to the "Review" tab. Export is desktop only (D). | Hide in mobile mode (BLOG-10 = D), frees the tab row. | **P2, own change, mobile only:** wrap the `li.nav-item.dropdown` with `#dropdownExportLanguages` in `if !layout.mobileView` (BLOG-10 = D). The two `fa-download` preview tabs to its left are already `d-none d-md-block`. The phone's desktop view keeps it. | S | low – check that `uc.blog.mobile` does not use the export menu. |
| BLOG-07 | 390, 412 | D | major | `views/blog/blogheader.pug` `mixin reviewBlog`: `a > i.fa-pencil` (edit own review comment) | Bare icon, 12×17, inline after the timestamp. The matrix already asks for "larger edit target than the pencil". | Tap on the own review comment text opens the edit form; or an "Edit" text button (≥ 44 px) under the own comment. | Confirmed, and worse: `a(onclick=…)` has no `href`, so it is not keyboard-focusable either. **P3, own change, all widths:** `button.btn.btn-link.p-2` with icon + "Edit" (`aria-label`), `data-edit-review="<lang><i>"` + a delegated listener that toggles `#editReview…` / `#reviewLeftText…`. Making the comment text the edit trigger is not proposed: the text holds links, so taps meant for a link would open the editor. | S | low – no test clicks the pencil today (grep); desktop gets a slightly larger "Edit". |
| BLOG-06 | 390, 412 | D | minor | `views/blog/blogheader.pug` `mixin reviewBlog`: "Review" / "cancel" (`btn-lg`) after "Start Personal Review"; "Change" in the edit form | Not rendered (state not set up). From the markup: two `btn-lg` side by side without gap class → touching (gap 0) like the comment area. "Start Personal Review" itself 240×48, fine. | `d-flex gap-2`, "Review" primary; "cancel" renamed "Stop review" and visually secondary. | Confirmed from the markup. **P3, own change, all widths:** `div.d-flex.flex-wrap.gap-2.mt-2` around "Review" / "cancel" and around "Change" (spacing to the textarea), normal `btn` (mobile height from the global rule). "cancel" submits the text `delete`, which ends the personal review → rename it to "Stop review", `btn-outline-secondary`. Inline `onclick` / `onkeyup` → delegated listeners. | S | low – ids `#reviewButton<lang>` / `#reviewButtonCancel<lang>` stay; check tests that search by the label. |
| BLOG-04 | 390, 412 | D | minor | `views/blog/blog_overview.pug` / `blog_review.pug` / `blog_full.pug` "Options": `div.form-check` (16 per page in overview, 5 in review) | Checkbox rows 24 px high, gap 2–4 px. Rare (R). | Mobile: `form-check` rows with `py-2` (≥ 44 px), or collapse the options behind one "View options" button. | **Covered by the global rule** with one addition: `.osmbc-mobile .form-check { min-height: 44px; padding-top: .625rem; }` (Bootstrap's float-based checkbox keeps working). A "View options" collapse is not needed for an R use case. | – | low |
| BLOG-01, BLOG-03, BLOG-08 | 390 | E | minor | `views/blog/blog_review.pug`, `blog_full.pug`: lead picture block ("WN… Picture") | Page 407 px wide at 390 (17 px horizontal scroll). Not at 412. | Picture block max-width 100 %. Add the scrollWidth check to the blog mobile test for review/full. | **P1, own fix, all widths.** `render/HtmlRenderer.js` `_renderArticlePicture` writes an inline `width: <img width + 10>px` (default 810 px) on `div.wp-caption`. `style.css` caps it at `max-width: 320px` and the image at 300 px, which is more than the table cell has at 390 px. Change to `max-width: min(320px, 100%)` / `min(300px, 100%)` (`.preview > div.wp-caption`, `.preview > div.wp-caption > p.wp-caption-text > img`); on desktop the cell is wider than 320 px, so nothing changes. Test: `scrollWidth` check in `uc.blog.mobile` for review and full. | S | low – the CSS is the same as before wherever the cell is ≥ 320 px. |
| BLOG-01, BLOG-13, BLOG-14 | 390, 412 | D | minor | `views/blog/blog*.pug` footer: `[changes]`, `[Statistic]`, `[Edit Blog Detail]` | Text links 63–112×17, stacked in separate paragraphs (gap ≥ 8 px). | Fine to keep as text links if padded to ≥ 44 px height; Edit Blog Detail is D and could be hidden in mobile mode. | **P4, own change, mobile only:** `[Edit Blog Detail]` in `if !layout.mobileView` (D). `[changes]` / `[Statistic]` get `osmbc-text-link` (see ART-05). | S | low – mobile only. |
| COL-05, BLOG-01 | 390, 412 | D | major | `views/index.pug`, "Blogs to work on" table: count badges as links (`a > span.badge`) per issue × language | 12 links 21–73×16–27, gaps **0–6 px** (e.g. review/edit/written counts of one cell). The start page is the most used mobile screen by people (27). `(more)` and "click here" (admin) 17 px high. | One row per issue (not a table): issue name as a large link (≥ 44 px), counts as non-interactive badges; a second line "DE: 4 open · 4 written" with one link for the open ones. Admin link hidden in mobile mode (ADM = D). | **P2, own change, mobile only, a second markup.** "Blogs to work on" is `mixin blogStatusTable(true, true)` (`views/mixins.pug`, inside `.table-responsive`: the table scrolls, the page does not). In mobile mode render a new mixin `blogStatusList` instead: per issue one `list-group-item-action` (≥ 44 px) to the blog, below it one line for the mobile language (X4) with the counts as plain badges and one link "N open" to the same filtered list the badges link to today. `(more)` → `osmbc-text-link`. `#adminlink` ("click here") in `if !layout.mobileView` (ADM = D). Desktop keeps the table. | M | medium – two markups for the same data; `uc.index` desktop snapshot unchanged; the mobile test needs issues in open/edit/review. |
| COL-03, ART-09 | 390, 412 | D | major | `views/inbox.pug`: `a > i.fa-envelope` (mark read), `a > i.fa-edit` (open article) | Envelope 14×17 per comment, edit icon 16×17, bare icons. Daily use case. | Comment card as one tap target (opens the article at the comment), "Mark read" as a text/icon button ≥ 44 px on the right; "Mark all read" per article. | **P3, own change.** `views/inbox.pug` `mixin displayArticle`: the envelope link (`markCommentRead?index=i`, a page load, marks read up to `i`) → `a.btn.btn-link.p-2` with `aria-label`, at the end of the comment line (`d-flex`, `ms-auto`), all widths. The left `.col-1` with `+articleIcons` is about 30 px wide on phones: in mobile mode drop it, and make the article title in the card header the link to the article (≥ 44 px). "Mark all read" per article = the existing route with the last index, a button in the card header (cheap). Whole card as tap target: not proposed, the comments contain links. | M | low – `inboxPage.js` exists; on desktop only the envelope padding and position change. |
| COL-01, COL-02 | 390, 412 | D | major | `views/collect.pug`: `#searchField` (156×38), `#searchButton` (`btn-lg`, 98×48); after search: `button#OK` (`btn-lg`, 63×48) and `a.btn` "Cancel" (78×38) | Search field only 40 % of the width and 38 px high, button on its own line below. OK and Cancel **touch (gap 0)** and have different heights; OK is the action that creates the article. Collect is a typical on-the-go task (22 %, 9 people). | Search field full width with the search button inside the same row (input group, ≥ 44 px). New-link form: OK as the one primary action (full width or sticky bottom bar like the article save bar), Cancel as a text link ≥ 8 px away. | **P2, own change.** `views/collect.pug` search row: `div.col-3` + `div.col-6` + button on its own line → below md `col-12` with a `div.input-group` (`#searchField` + `#searchButton` without `btn-lg`); from md the grid stays as today. New-link form: `#OK` and Cancel in `div.d-flex.gap-2` (OK first; Cancel `btn-outline-secondary`, normal size; mobile height from the global rule). Sticky OK bar: not in X10 (the form is short, OK is visible after the search). Side find: `addSpinnerAndSubmit()` (`osmbc_staff.js`) leaves `display: block` on `#OK` (repaint hack) → in a flex row the button jumps to full width on submit; reset it to `""`. `#OK` inline `onclick` → listener in the `collect.pug` script block. | M | medium – `uc.collect` (direct driver calls, no POM) and `searchAndCollectPage.js` click `#searchButton` / `#OK`; desktop HTML snapshots in `uc.collect` change (form markup) → regenerate. |
| USR-02, USR-03 | 390, 412 | E | major | `views/user.pug`: bootstrap-select buttons `button.btn.dropdown-toggle.btn-light` (220 px, "Mail defined comments", "Translation Services" …) in a fixed label/field grid | Page 457 px wide at 390 (471 at 412): the menu button (`navbar-toggler`) sits outside the screen (x = 389–445 at 390). Inputs only 101–126 px wide. The header is the desktop one (app name, toggler on the right), not the compact X9 header. 21 % mobile use (10 people). | Label above field (`col-12`) on phones, selects full width. Check why this page does not get the X9 header. | **Confirmed, cause found:** `views/user.pug` (and `user_guest.pug`, `userList.pug`, `adminindex.pug`) `extends adminlayout`, a separate layout without the X1 offcanvas, the X9 header, the mode-detection script and `mobileView` (old collapse navbar with UserLists / Tools / `+langMenu(1)`). Overflow: bootstrap-select buttons have a fixed 220 px width inside the `div.col-5` of the `labeled*` mixins in `views/mixins.pug` (only used by `user.pug` / `user_guest.pug`). **P2:** (a) `user.pug` / `user_guest.pug` `extends layout`; the admin menus go into `block additionalMenuMain` for `access === "full"` as today; `userList` / `adminindex` stay on adminlayout (ADM = D). (b) Mixins: label `col-12 col-md`, field `col-12 col-md-5` (identical from md up), selects `data-width="100%"` (changes the desktop select width from 220 px to the column → or only in mobile mode). Same for the colour row. | M | medium – desktop snapshots `test/screens/user_self_edit.html` / `user_welcome.html` (`uc.user`) change with the layout switch → regenerate and review; admin menu entries must stay reachable. |
| USR-02, USR-03 | 390, 412 | D | minor | `views/user.pug`: `input#save` "OK" (49×38), "logout user" / "Switch temporary to Guest" (`a.btn`, 115/231×38), OSM profile icons `fa-map` / `fa-line-chart` (14–16×17, gap 4) | Save of the profile is a 49 px "OK". Logout and Switch-to-guest stacked with **gap 0**. | "Save" as full-width primary; logout/guest in a separate "Account" block with gap. Profile icons as labelled links. | **P4, own change, with USR-02.** `input#save`: `w-100` in mobile mode; label "OK" → "Save" (PO: wording). Remove `div.col-sm-offset-2` (Bootstrap 3 leftover, no effect). Logout / Switch to Guest: `div.d-flex.flex-wrap.gap-2` (today only a text space between them; in the `flex-row-reverse` wrapper they stack and touch), all widths. Profile icons → `a.btn.btn-link.p-2` with `aria-label` ("OSM profile", "HDYC"). Height from the global rule. | S | low – `#save` stays (`userPage.js`); on desktop only the gap changes. |
| BLOG-15 | 390, 412 | D | minor | `views/bloglist.pug`: issue links in the list table | 16 links 21–71×17, 7 pairs touching (gap 0). R. | Rows as list items ≥ 44 px. | Not covered by the global rule (table links are not `.btn`). **P4, own change, mobile only:** `.osmbc-mobile` rule for `views/bloglist.pug`: `td a { display: inline-block; padding-block: .625rem; }`, and in mobile mode show only the mobile language column instead of all active languages (one column per active language today). A list-group rewrite is not worth it for R. Side find: the "service" column has a plain GET link "Close Blog" (`?setStatus=closed`) per open issue, without a confirmation, in the same row as the badges → hide it in mobile mode (PO decision). | S | low – mobile only; `blogListPage.js` selectors stay. |
| all | 390, 412 | D | minor | `views/layout.pug` header (X9): `button.navbar-toggler` 56×40, `a.navbar-brand` (issue link) 45–72×33 touching the toggler (**gap 0**), `#mobileLangMenu` 57×29; language menu items `a#mobileLang_XX.dropdown-item` 154×26, gap 2 | Toggler and issue link touch: a tap on the right half of the toggler edge opens the issue. Language button 29 px high. | Toggler 44×44, `ms-2` between toggler and issue link; language badge with a padded 44 px hit area (visual badge can stay); dropdown items `py-2`. | **P1, own change, mobile only** (`mixin mobileHeader` in `views/layout.pug` + `style.css`): brand `ms-2` (only in `mobileHeader`; the desktop `homeButton` stays as it is); `.osmbc-mobile .navbar-toggler { min-width: 44px; min-height: 44px; }`; `#mobileLangMenu` keeps the badge look and gets a 44 px hit area through `position: relative` + `::before { content: ""; position: absolute; inset: -8px; }`. It has to be `::before`, because `.dropdown-toggle::after` is Bootstrap's caret. Exclude it from the global `.btn` rule (`.btn.badge`). Dropdown items `py-2`. Inline `onclick=chooseMobileLanguage` → `data-mobile-lang` + listener in `osmbc_staff.js`. | S | low – mobile only; `uc.mobilelanguage` uses `#mobileLang_XX` (stays); `uc.navbar.mobile` measures navbar vs. content (still holds, padding follows the navbar height). |
| all | 390, 412 | D | minor | `views/layout.pug` offcanvas menu (X1): `a.nav-link` (Collect, Inbox, issues, Search, Tools, Help) 353×33–35, gap 4; Search submenu `a.dropdown-item` 351×26, **gap 0**; `button.btn-close` 30×30; avatar `img` 40×40 | Full width, so only height/gap. Submenu items 26 px high and touching. Close button 30×30 at the top right corner. | Menu entries `py-2` (≥ 44 px), submenu items as indented list entries ≥ 44 px, close button with a 44 px hit area. | **P1, CSS only, below lg** (`@media (max-width: 991.98px)`: the offcanvas only exists below lg, so the phone's desktop view benefits too; desktop ≥ lg untouched): `#navbarSupportedContent .nav-link, #navbarSupportedContent .dropdown-item { padding-block: .625rem; }`, submenu items `padding-inline-start: 1.5rem`, `.offcanvas-header .btn-close { padding: .875rem; }`. | S | low – CSS only; `uc.navbar.mobile` taps entries, larger targets do not break it. |
| all | 390, 412 | D | minor | Bootstrap default `.btn` / `.form-control` / `.form-select` (38 px) across all pages | Every normal button and input is 38 px high, `btn-lg` 48 px. That is why the views use `btn-lg` as a general "make it touchable" style, which then wraps (comment area, review). | One mobile rule instead of `btn-lg` per view: in mobile mode `.btn, .form-control, .form-select { min-height: 44px }`, button rows `d-flex flex-wrap gap-2`; `btn-lg` only for the one primary action of a block. | **Assessment: do it, with changes. P1, the base for the other rows.** There is no mobile class yet: mobile mode is only known on the server (`req.mobileView`, `layout.mobileView`, `routes/layout.js`); `style.css` has one `@media (min-width: 992px)` block. A plain `@media (max-width: 991.98px)` would also hit the phone's desktop view (~980 px), which was decided to stay desktop (`803a7551`) → use a class: `html(lang='en' class=layout && layout.mobileView ? "osmbc-mobile" : undefined)` in `views/layout.pug`. Pug leaves out an `undefined` attribute, so the desktop DOM and all desktop HTML snapshots (`expectHtml`) stay unchanged; the phone tests have no snapshots. Rules: `.osmbc-mobile .btn:not(.badge) { --bs-btn-padding-y: .5625rem; }` (24 px line height + 18 px padding + 2 px border = 44 px; the text stays centred, `min-height` would leave it at the top), `.osmbc-mobile .form-control:not(textarea), .osmbc-mobile .form-select { min-height: 44px; }`, plus the `.form-check` line (BLOG-04). The bootstrap-select toggle is a `.btn`, so it is covered. `py-0` / `py-1` utilities (`!important`) win over the rule (`linkInsertButtons` → ART-02). Gaps cannot be global: `.btn + .btn` margins break `input-group` / `btn-group` → `d-flex flex-wrap gap-2` per row (ART-08/09/10, BLOG-06, COL-01, USR-03). `btn-lg` is removed per block, in the row fixes. **Covered by this rule alone:** ART-02/03 toggle buttons, BLOG-02/08 inline Save/Cancel, BLOG-04 options. **Height part covered:** save bar, ART-05/07 selects, COL-01 search field, USR-02 selects. | S | low – mobile only, desktop DOM unchanged; buttons get 6 px taller on phones; `uc.article.mobile` (save-bar geometry) and `uc.blog.mobile` must be rerun. |

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

### X10 — implementation proposal (frontend-dev)

The global rule comes first, the other rows build on it. Packages in order,
each package is one commit (plus a separate `refactor` commit for the inline
handlers/dead code it removes):

- **P1 — global rule + article overflow + navigation** (S+S+M+S+S+S+S ≈ M):
  `osmbc-mobile` class on `<html>`, `.btn`/form height rules, `.form-check`;
  `#linkArea` badge wrap and the mobile link row with "⋯" menu (ART-01/02);
  save bar order (ART-15); picture `max-width` (BLOG review/full); header
  hit areas and offcanvas padding. Risk low–medium (only ART-02 changes
  behaviour, the rest is mobile-only CSS).
- **P2 — blog and start page** (≈ L): blog row height + `osmbc-article-open`
  + inline-editor handler to a delegated listener (BLOG-02/08), tab spacing +
  `nav-fill` + status confirmation (BLOG-01/05/09), export menu hidden
  (BLOG-10), votes `gap-2` (ART-10), start page list (COL-05), collect search
  row and OK/Cancel (COL-01/02), user page on `layout` + mixin grid
  (USR-02/03). Risk medium: desktop HTML snapshots of `uc.blog`, `uc.collect`,
  `uc.user` must be regenerated and the diffs checked; `BlogPage` must handle
  the confirmation.
- **P3 — comment and review area, inbox** (≈ M): comment buttons/icons and
  their delegated listeners (ART-08/09), review edit button and button rows
  (BLOG-06/07), inbox envelope and card header (COL-03). Risk medium:
  desktop look changes (no `btn-lg`, gaps), done for all widths.
- **P4 — rest** (≈ S): flags hidden, text-link padding, `#noTranslationButton`
  class, footer links, user page buttons, blog list. Risk low.

Total ≈ L (roughly 4–6 working days including tests and snapshot review).
The inline handlers moved in P1–P3 count towards the planned CSP work
(`fix/csp-inline-handlers`), they are not new work there.

**Tests** (through page objects, `getNewDriver(user, { device: "phone" })`):

- Page-object helper `Page.assertNoHorizontalScroll()` (`scrollWidth <=
  innerWidth`) and `Page.tapTargetsTooSmall(selector)` (returns elements below
  44 × 44 px or closer than 8 px, via `getBoundingClientRect` in one
  `executeScript`).
- Article page with a long collection URL, a doublette and a failing link
  check: no horizontal scroll; "+ Link" / "+ translated" ≥ 44 px and the "⋯"
  menu opens (`ArticlePage` mobile section); comment buttons and vote buttons
  ≥ 44 px and ≥ 8 px apart.
- Blog overview / review / full (`BlogPage`): no horizontal scroll with a
  picture article; inline-edit row ≥ 44 px; status button ≥ 16 px above the
  tabs; Close asks for confirmation (if decided).
- Start page, collect, inbox, user page: no horizontal scroll, main action
  ≥ 44 px (`MainPage`, `SearchAndCollectPage`, `InboxPage`, `UserPage`).
- Desktop: existing snapshots stay unchanged after P1 (proves the global
  rule is mobile-only); P2/P3 snapshot diffs reviewed by hand.
- Firefox run of the new mobile tests (platform-matrix decision 2026-10-16),
  if the test setup supports it by then.

**Decisions for the product owner:**

1. Confirmation before Close / Did Export (and "ready for review"?) — all
   widths or mobile only (BLOG-01/05/09).
2. "Solve Comment": keep as a separate button (cheap) or a "mark as solved"
   checkbox (behaviour change, empty text has to be allowed) (ART-08).
3. "Reload Comments": icon button in the heading, or drop it (ART-08).
4. Hide in mobile mode: export menu (BLOG-10), language flags (ART-13),
   `[Edit Blog Detail]`, admin link on the start page, "Close Blog" link in
   the blog list.
5. Vote "unpublish": change its order/colour in the config, or add a style
   flag per vote (ART-10).
6. Comment and review buttons without `btn-lg` on desktop too (P3 is
   proposed for all widths), or keep `btn-lg` on desktop and switch only in
   mobile mode (more markup branches).
7. User page: switch `user.pug` / `user_guest.pug` to the normal layout
   (gets offcanvas and X9 header, desktop navbar changes too), and label "OK"
   → "Save".

## Decisions (2026-10-20, product owner)

Product-owner questions from the implementation proposal:

1. **Confirmation** before Close and Did Export on **all widths**. No
   confirmation for "ready for review".
2. **"Solve Comment"** stays a separate button (with spacing). No behaviour
   change.
3. **"Reload Comments"** becomes an icon button in the "Comments" heading.
4. **Hidden in mobile mode:** export menu, language flags (hidden, not
   removed: the preview reads `img.flag`), admin link on the start page,
   "Close Blog" in the blog list. **`[Edit Blog Detail]` stays visible**,
   because "Reopen" (BLOG-12 = M, 2026-10-20) is reached through it.
5. **"unpublish" vote:** spacing only for now (`gap-2`, ≥ 44 px). Order,
   colour or a style flag only if mis-taps remain.
6. **Comment and review buttons without `btn-lg` on all widths** (one markup
   for all widths).
7. **User page** moves to the normal layout (`user.pug`, `user_guest.pug`);
   "OK" becomes "Save".

UX ↔ dev conflicts:

- **Status action (BLOG-01/05/09):** spacing + `nav-fill` tabs +
  confirmation (option a), no bottom bar.
- **Inbox (COL-03):** the title link in the card header becomes the large
  tap target (option a), not the whole card.
- **Own review comment (BLOG-07):** an "Edit" button, no tap on the text.
- **Link badge (ART-01):** wrap, no ellipsis (keeps the link-check result
  visible).
- **"Open article" in the blog row (BLOG-02/08):** an icon button (44 × 44)
  at the **right end of the row** (the reviewer's proposal; M instead of S),
  so it is visible without opening the editor.

## Status

- **P1 done (2026-10-20):** class `osmbc-mobile` on `<html>` in mobile mode,
  44 px rule for buttons, inputs, selects and checkboxes; collection links
  in mobile mode as one block per link (link wraps, "+ Link" / "+ translated"
  full size, other actions in a "⋯" menu); save bar with Save on the right;
  header and menu panel entries 44 px; blog picture never wider than its
  cell. Found while testing: the doublette table at the end of the article
  page ("Links used in other Post") made the page 680 px wide on phones (the
  full URL in a table, `table-responsive` on the table instead of a wrapper)
  → wrapper, the table scrolls. Desktop (1280 px) unchanged on all 15
  screens of the baseline; the only desktop HTML change is the hidden save
  bar. Phone (390 px): no screen except the user page (P2) scrolls sideways
  any more. Test: `uc.article.mobile` (long link + doublette).

- **P2 done (2026-10-20):** blog views: the article text (inline editor)
  is ≥ 44 px high, "Open article" as a 44 px button at the end of the row
  (left edit icon hidden in mobile mode), tabs 44 px and `nav-fill`, room
  below the status button, export menu hidden; Close, Did Export and
  Delete Review ask first (all widths, native `confirm`), the status
  buttons show "wait ..." again (the old code set a DOM property). Votes in
  a `gap-2` row. Start page: the status table stays (product owner,
  2026-10-20, after trying the list per blog: the table shows the state of
  all languages, there are about three blogs to work on); in mobile mode
  the table is only as wide as its content; the blog names and the row of
  the mobile language are tap targets, 44 px high and 32 px wide (the
  numbers of a cell stay together; a mis-tap hits the neighbour in the same
  blog and language); the other languages stay compact for reading (13
  languages × 44 px was too high, product owner 2026-10-20); the badge
  legend opens on demand; admin link hidden. Collect:
  search button beside the field below md, OK and Cancel apart. User page
  (and guest user page) on the normal layout, form label above the field
  below md, "OK" → "Save". Inline handlers replaced by data attributes and
  delegated listeners on the way. Desktop (1280 px): page heights unchanged
  except the user page (+26 px, normal layout with its e-mail notice);
  intended changes: vote gap, collect columns, Cancel outline, user page
  menu. Tests: `uc.blog.mobile`, `uc.article.mobile` (votes),
  `layout/uc.startpage.mobile`, `collect/uc.collect.mobile`,
  `user/uc.user.mobile`.

- **P3 done (2026-10-20), all widths:** comment area: "Reload Comments"
  is an icon button in the heading; Add Comment and Solve Comment (outline)
  in a `gap-2` row without `btn-lg`; the pencil and the envelope are
  buttons with a tap area, the envelope at the end of the comment's header
  line; Update / Cancel apart. Review: the pencil of an own review comment
  is a button, Review and "Stop review" (was "cancel") apart, without
  `btn-lg`. Inbox: the envelope as a button at the end of the line; phones
  without the icon column, "Open article" in the card header. Fixed on the
  way: a comment read state of 0 (first comment read) counted as "nothing
  read" (article and inbox; also stored as a string by the route); the
  badge "X is reviewing since …" did not wrap and made the blog page 474 px
  wide on phones. Desktop: the article page +45 px, the blog review +21 px
  (larger comment/review action buttons), envelope moved to the right.
  Tests: `uc.article.mobile` (comments), `uc.blog.mobile` (review),
  `user/uc.inbox.mobile`.

- **P4 done (2026-10-20):** mobile mode: the language flags are hidden
  (kept in the page, the preview reads `img.flag`) — product owner waits
  for feedback from the editors whether flags are needed on phones (then a
  "Insert flag…" grid like "+ Link"); text links ([changes], [Statistic],
  [Edit Blog Detail], (more), "Blog", WORTLIGA) 44 px high; OSM profile
  icons on the user page as labelled buttons; blog list only with the
  mobile language column and without "Close Blog". `btn-small` (not a
  Bootstrap class) removed. Desktop unchanged. Tests: `uc.article.mobile`,
  `uc.blog.mobile` (blog list).
- **Still small on phones (accepted):** the avatar in the menu panel
  (40 px), the issue link in the header (33 px high).

Order: P1 → P2 → P3 → P4, each package tested on the beta. P1 has no desktop
effect; desktop baseline (1280 × 900) measured on `7ca9f522`, compare after
every package.

## Beta.3 feedback (2026-10-23, one editor, Android)

Done (2026-10-23):
- Menu panel slides in from the left, where the toggler is (`offcanvas-start`).
- Space below the doublet badge on the article page.
- Button order: cancel at the start, primary action at the end (under the
  thumb) — blog inline editor (Cancel … Save), personal review (Stop
  review … Review), edit comment (Cancel … Update). Desktop too, like the
  save bar.
- Avatar in the menu is a link; in the side panel (below lg) the OSM name
  stands next to it.
- History log: a text change opens via its own caret button (tap size); a
  tap on a link in the row only follows the link (was: row `onclick`
  toggled and the info link navigated).

- Blog overview scrolled sideways (533 px on a 390 px phone): a long word
  in an article text (URL, tag like `ref:penndot`) set the minimum width of
  the text column. The inline-edit text now wraps anywhere on phones. The
  navbar and the menu animation only looked wrong because the page was
  wider than the screen.
- Inline editors (overview, review, full) grow with their text, on open
  and while typing; `rows` stays the minimum. Desktop too (product owner).

- Missing profile pictures: the avatar URL is looked up on demand from the
  OSM profile page and was kept in memory only, so after every restart
  (deploy) the first page showed `<img>` without `src`. Now kept on disk
  (`cache/avatar.cache`, `{ url, fetchedAt }`), shown while older than 7
  days (1 day for "no avatar") and looked up again in the background; no
  prefetch at startup (dropped in `18ac882d`, OSM throttles). A placeholder
  (`/images/avatar.svg`) is shown while unknown, and in the browser when
  the image does not load (changed on OSM, blocked by tracker protection).

- Comment fields grow with their text too (article comment new/edit,
  review comment new/edit), one helper for all: `textarea[data-fit-content]`
  + `fitToContentIn()` in `osmbc_staff.js`. The old FitToContent bindings
  for comments hit the form and a not yet rendered field — removed.
- X12: hint paragraphs (`p`/`div.osmbc-help-text`) hidden in mobile mode;
  the start page legend and the "Configure a translation service" link stay.
- Drag of the translated-page link `DE` (`[]()` garbage, 2026-10-17): fixed
  by the drop fix `5d106317`, covered by "should insert a dropped text where
  it is dropped"; phones have no drag source any more ("+ translated").

- Votes in the blog views: they were already choosable one by one ("Display
  Votes" under each view), but the labels sat in a part hidden below md, so
  on phones the option had no effect. Now shown on phones too (review: in
  the row; overview: last cell, next to the open button), tap-sized, a tap
  votes; inline `onclick` replaced by a listener. The redraw route
  `GET /article/:id/:votename` answered 500 (`assert`) for any unknown
  second path part, now 404 — likely part of the vote route's error rate in
  the access log.

For the product owner:
- History log: choose visible columns.
- Liked: "make comment" button on the right of the review page.

## Merge of master 4.4.11/4.4.12 (2026-10-24)

- First Draft (Claude) came as a navbar dropdown with `d-none d-sm-block`
  and the languages of the desktop pair — on phones a hidden function
  (class A) and the wrong languages. Like Translate: in mobile mode the menu
  is replaced by "First Draft <url>" buttons at the empty text field of the
  mobile language (and of the second language when shown); desktop keeps
  the menu.

## First Draft while collecting (2026-10-24, idea from the editors' channel)

Collectors often submit a link from the phone but have no time to write
the article; they know the page and can judge a summary at once. Editors
should not generate drafts for pages they never read, so the draft is only
offered here, to the users in `FirstDraftConfig.visibleFor`.

- After the search, the collect form shows a draft of the markdown in the
  user's language (mobile language on phones, main language on desktop),
  editable, with a preview. For a new link it is made right away, for a link
  found in other articles only on request ("First Draft" button).
- Cancel / "Save link only" / "Save with draft"; the edited collection is
  saved either way.

