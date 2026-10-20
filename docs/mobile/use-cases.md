# OSMBC use-case catalogue (mobile UI analysis)

Status: first pass, built from code only (routes, views, client scripts, help
pages, `test/uc.*`). Nothing here was tried on a real device. The
"mobile risk hints" are things the code suggests; whether they are real
problems is up to the UX review.

Bootstrap 5 breakpoints used below: **xs** < 576px (phone portrait),
**sm** 576–767px (phone landscape / small tablet), **md** 768–991px,
**lg** ≥ 992px.

## Overview

| ID | Goal (in the user's words) | Role | Frequency |
|----|----------------------------|------|-----------|
| ART-01 | Open an article and see where it stands | full | per article (very high) |
| ART-02 | Write or fix the text of an article in my language and save it | full | per article (very high) |
| ART-03 | Translate an article with a translation service | full | per article × language (very high) |
| ART-04 | Turn a link into a markdown link (paste on a selected word, drag a link in) | full | per article (high) |
| ART-05 | Move an article to another blog/category or set its position | full | per issue, several |
| ART-06 | Unpublish an article (doublette, too old, …) with a reason | full | per issue, a few |
| ART-07 | Mark the remaining languages as "no translation" | full | per issue, several |
| ART-08 | Comment on an article, mention someone or a language, solve a comment | full, guest | per issue, many |
| ART-09 | Edit my own comment / mark a comment as read | full, guest | weekly |
| ART-10 | Vote on or tag an article | full | per issue, several |
| ART-11 | Check whether the link was already used (doublettes) | full | per article (collect/edit) |
| ART-12 | Read the linked page's text without leaving OSMBC | full | per article, sometimes |
| ART-13 | Insert a language flag / emoji into the text | full | per issue, a few |
| ART-14 | Generate the event calendar text | full | per issue, once |
| ART-15 | Throw away my unsaved changes | full | rare |
| ART-16 | See who changed what in an article | full | rare |
| ART-17 | Run the German text analysis | full (DE) | rare |
| BLOG-01 | Open the current issue and see how far my language is | full | daily during an issue |
| BLOG-02 | Quickly fix an article directly in the blog overview | full | per issue, many |
| BLOG-03 | Read and edit the full text, two languages side by side | full | per issue |
| BLOG-04 | Change what the blog views show / filter articles | full | weekly |
| BLOG-05 | Set my language ready for review | full | per issue × language |
| BLOG-06 | Do my personal review and write the review comment | full | per issue × reviewer |
| BLOG-07 | Change my review comment | full | per issue, some |
| BLOG-08 | Correct an article in the review view / confirm an automatic translation | full | per issue, many |
| BLOG-09 | Close my language (or confirm it was exported) | full | per issue × language |
| BLOG-10 | Export / download the issue for publishing | full | per issue × language |
| BLOG-11 | Translate the whole blog in one go | full (restricted) | per issue |
| BLOG-12 | Reopen a language, delete its review, copy texts from another language | full | rare |
| BLOG-13 | Edit the blog details (name, dates, status, categories, team) | full | rare |
| BLOG-14 | Look at the blog statistics | full | rare |
| BLOG-15 | See all blogs and close a finished one | full | per issue |
| BLOG-16 | Create a blog by hand | full | rare |
| BLOG-17 | Sort the TBC list (links from chat) into blogs | full | weekly |
| COL-01 | Collect a new link for the next issue | full | weekly, many |
| COL-02 | Search existing articles | full | weekly |
| COL-03 | Work through my inbox (mentions) | full, guest | daily |
| COL-04 | Get a list of articles (my empty collections, trash, future, unwritten in my language) | full | weekly |
| COL-05 | See on the start page what needs to be done | full | daily |
| GST-01 | Log in with my OSM account | guest, full | per new device / session |
| GST-02 | Submit a news link as a guest | guest | occasional |
| GST-03 | See what happened to my submitted links | guest | occasional |
| GST-04 | Answer a comment on my submission | guest | occasional |
| USR-01 | Switch my language pair / language set | full, guest | weekly |
| USR-02 | Change my profile and notification settings | full, guest | rare |
| USR-03 | Try the guest view / log out | full | rare |
| USR-04 | Look at another editor's profile | full | rare |
| USR-05 | Open a help page | full, guest | rare |
| ADM-01 | Check the admin start page (absent users, translation quota, changes) | full | rare |
| ADM-02 | Edit a configuration entry (categories, calendar, votes, …) | full | rare |
| ADM-03 | Manage users (list, create, change access) | full | rare |
| ADM-04 | Run a script plugin and read its log | full (script users) | rare |
| ADM-05 | Search the change history | full | rare |

Counts: Article 17, Blog/Review 17, Collect/Inbox 5, Guest 4, User/Profile 5,
Admin/Config 5 — 53 in total.

## Hidden-on-small-screen inventory

Every place in `views/` that hides something on small screens, with a key
used in the use cases below. "xs" = gone below 576px, "<md" = gone below
768px.

| Key | Where | What disappears | Gone at |
|-----|-------|-----------------|---------|
| H-NAV | `layout.pug`, `adminlayout.pug` `nav.navbar-expand-lg.fixed-top#fixedNavbar` | Not hidden, but **all** menus (Collect, Inbox, current blogs, Search, Tools, Translate, language chooser, Help, avatar) collapse behind the toggler below 992px. The bar is `fixed-top`; when expanded it covers the top of the page. | < lg |
| H-TBC | `layout.pug` mixin `tbcMenu` (`dynamicHide = "d-none d-sm-flex"`) | TBC menu entry, when the user has no own TBC articles | xs |
| H-TRANS | `article/article_mixin.pug` mixin `translationMenu`, `li#translation.d-none.d-sm-block` | The whole article **Translate** menu (only way to call a translation service in the article view) | xs |
| H-ARTHIST | `article/article.pug` `.row.d-none.d-sm-block` / `.row.d-block.d-sm-none` | Article history table, replaced by a `[changes]` link | xs (has substitute) |
| H-ICONS | `mixins.pug` `articleIcons` | Collector/editor count badges, predecessor pin/stop icons | xs |
| H-EXPL | `mixins.pug` `labeledInput/Textarea/Select/MultiSelect/Text` | Explanation text next to each form field | < md |
| H-PROG2 | `blog/blogheader.pug` `div.d-none.d-md-block` | Progress bar and unsolved-comment count of the **second** language | < md |
| H-BNAME | `blog/blogheader.pug` `h2 span.d-none.d-md-block` | Long blog name and status text in the header | < md |
| H-REVBTN2 | `blog/blogheader.pug` `.col-md-3.d-none.d-md-block` → `blogReviewButtons(right_lang)` | "Set … ready for review", "Close …", "Did Export" for the **second** language | < md |
| H-REV2 | `blog/blogheader.pug` `div.d-none.d-md-block(class=columnRightSize)` → `reviewBlog(right_lang)` | Whole review card of the **second** language: review comments, edit pencil, "Start Personal Review", review textarea | < md |
| H-FILTERTAB | `blog/blogheader.pug` `li.nav-item.d-none.d-md-block` (`#filter`) | Tab that jumps to the options/filter block | < md |
| H-DLTAB | `blog/blogheader.pug` two `li.nav-item.d-none.d-md-block` | Preview/download tabs for left and right language (the download dropdown `#dropdownExportLanguages` stays) | < md |
| H-OVCOLS | `blog/blog_overview.pug` 10× `td.d-none.d-md-block` | Overview columns: vote labels + short language badges, collector/editor names, full language status | < md |
| H-OVOPT | `blog/blog_overview.pug` `p.d-none.d-md-block` | "Right Col.:" label in the options table (the options themselves stay) | < md |
| H-FULL2 | `blog/blog_full.pug` 2× `div.d-none.d-md-block(class=columnRightSize)` | **Second-language column** of the Full view: category title, rendered text, inline editor, "Mark Auto Translation OK" | < md |
| H-REVCOLS | `blog/blog_review.pug` `span.d-none.d-md-block` ×2, `div.d-none.d-md-block` ×2, `.row.d-none.d-md-block` | Collector/editor labels, language + vote labels per article; options showNumbers / showCollector / showEditor / showLanguages / showColoredUser | < md |
| H-COLTAB | `collect.pug` `th/td.d-none.d-sm-table-cell` | Search result columns "Cat (EN)" and the "Collection"/"Submission" header (its `td.pre` cell is **not** hidden, so header and cells no longer line up) | xs |
| H-HOME | `index.pug` `h2/p.d-none.d-sm-block`, `.col-12.col-xl-6.d-none.d-lg-block` | Welcome text; the whole **Last Changes** column of the start page | xs / < lg |
| H-GHOME | `index_guest.pug` `h2.d-none.d-sm-block` / `h2.d-block.d-sm-none` | Long title swapped for short one | xs (cosmetic) |
| H-BLIST | `bloglist.pug` `.row.d-none.d-sm-flex` | Configurable additional text under the blog list | xs |
| H-TBCT | `blog/blog_tbc.pug` `span.d-none.d-sm-inline` | "(To be Collected)" in the heading | xs (cosmetic) |
| H-USER | `user.pug` `div.col.d-none.d-md-block`, `div.d-none.d-md-block` | Colour-picker explanation and links; the activity heatmap | < md |

---

## Article

Main screen: `views/article/article.pug` + `article_mixin.pug`, rendered
only through `article/article_all_column.pug` (`routes/article.js`
`renderArticleId`). Client logic: `public/javascripts/article_view.js`.
The other `article_*column.pug` files are not rendered by any route.

### ART-01 — Open an article and see where it stands
- **Role:** full
- **Frequency:** per article, very high — every edit, translation and
  comment starts here.
- **Steps:** click the edit icon (`i.fa.fa-edit` from `articleIcons`) in a
  blog view, a title in the inbox/search/list, or a link in a comment →
  `/article/:id`. Read blog date, category, title, collection, the
  language badges (`languageDisplay`, green/blue/grey) and the per-language
  markdown + preview.
- **Screens/controls:** `article.pug` header rows (`#blog`, `#categoryEN`,
  `#predecessorId`), `#voteButtons`, `+languageDisplay(article,{func:"showRL"})`,
  `#title`, `#collection`, `#linkArea`, `article_all_column.pug`
  markdown columns.
- **Mobile risk hints:**
  - Every language column is `div(style="min-width:400px;max-width:900px")`
    inside `.row > .col`: wider than any phone in portrait, so it probably
    scrolls sideways.
  - The header is two `col-md-6` blocks (blog/category/predecessor, then
    votes/doublettes/language legend/Save) that stack on phones; the text
    fields come only after them.
  - Collector/editor badges in the source list are hidden (H-ICONS) — only
    matters when arriving from a blog view.

### ART-02 — Write or fix the text of an article in my language and save it
- **Role:** full
- **Frequency:** per article × language, the most frequent action of all.
- **Steps:** open article (ART-01) → type in `textarea#markdown<LANG>`
  (live preview `#preview<LANG>`, link check, "unsaved" badge) → click
  **Save** (`#saveButton`, `window.saveButton()`). Save first checks the
  feature image for category "Picture" (`/article/checkfeatureimage`),
  posts a non-empty comment from `#comment` (`form#AddComment`), then
  submits `form#input` to `/article/:id/witholdvalues`. Leaving with
  unsaved changes triggers a `beforeunload` warning.
- **Screens/controls:** `+saveButton` / `+cancelButton` in the top-right
  block `.col-md-7.text-end`; `.markdownEdit`, `.markdownMessage`,
  `#<field>_unsaved` badges.
- **Mobile risk hints:**
  - The Save button exists **only at the top** of the form. After typing
    further down the user has to scroll all the way up; under the
    `fixed-top` navbar (H-NAV), especially when the menu is expanded, the
    button can sit under the bar. Reported problem.
  - `FitToContent` grows the textarea to fit its content, which makes the
    way back to Save even longer.
  - Save also sends whatever is in the comment box further down — easy to
    miss on a small screen.
  - `beforeunload` warnings are unreliable on mobile browsers (iOS Safari
    mostly ignores them), so unsaved text can be lost.

### ART-03 — Translate an article with a translation service
- **Role:** full
- **Frequency:** per article × target language, very high in the
  translation phase.
- **Steps:** open article → **Translate** in the navbar
  (`#articleTranslateMenu`) → choose "Translate XX->YY" for the configured
  service (`a.dropdown-item.translateXXYY`, `window.translate()`) → text is
  posted to `/article/translate/<service>/<from>/<to>` and written into
  `#markdownYY` (for `deepl` free: opens deepl.com in a new tab) → check
  → Save (ART-02). "One to many" entries exist for script users. Menu also
  links to the profile to configure services.
- **Screens/controls:** `article_mixin.pug` mixins `translationMenu`,
  `articleTranslateMenu`; dropdown height set by script from `#fixedNavbar`.
- **Depends on hidden controls:** **H-TRANS** (whole menu gone below
  576px), H-NAV.
- **Mobile risk hints:**
  - Below 576px there is **no way** to call a translation service from the
    article view. Reported problem.
  - Between 576 and 991px the menu is inside the collapsed navbar; the
    dropdown's `max-height` is computed from the window height minus the
    navbar, which may come out very small when the navbar is expanded.
  - `translate()` toggles the class `hidden`, which Bootstrap 5 does not
    define; the "Please Wait"/"done"/"error" entries keep `d-none`, so there
    is no visible progress feedback on any screen size.
  - The deepl-free variant opens a new tab/app — context switch on a phone.

### ART-04 — Turn a link into a markdown link
- **Role:** full
- **Frequency:** per article, high — almost every article contains links.
- **Steps:** (a) select a word in the markdown field and paste a URL →
  `[word](url)` (`pasteEvent`, `generateMarkdownLink2`); (b) paste a URL
  without selection → `[](url)` with cursor between the brackets; (c) drag
  a link from `#linkArea` (collection links or Google-translate language
  links built by `generateGoogleTranslateLink`) into the markdown field;
  (d) drag a language badge (`ondragstartLangLabel`) to copy a whole text.
- **Screens/controls:** `#linkArea` (help text "Drag me to a markdown
  field…"), `.markdownEdit` `paste`/`drop` handlers, language badges with
  `draggable="true"`.
- **Mobile risk hints:**
  - (c) and (d) are **drag & drop only**; HTML5 drag & drop between
    elements does not work on most touch browsers. The translate-link
    markdown (`:??-s: > [:XX-t:](…)`) is only reachable by dragging.
  - (a) needs select-then-paste on touch, which is fiddly but works in
    principle.
  - The links in `#linkArea` are long `badge`s; the Google-translate links
    are two-letter targets.

### ART-05 — Move an article to another blog/category or set its position
- **Role:** full
- **Frequency:** per issue, several (moving to next week, Future, fixing
  categories, ordering).
- **Steps:** open article → change `select#blog` (open/edit/review blogs,
  Future, Trash, TBC), `select#categoryEN` (description shown in
  `#categoryDisplay`), `select#predecessorId` (None/First/other article)
  → Save.
- **Screens/controls:** `article.pug` header `+blogSelector`, `#categoryEN`,
  `#predecessorId`.
- **Mobile risk hints:** native selects are fine on phones; the category
  option text is "left / right" language and the predecessor list holds
  every title of the category — long options. Save is at the top (ART-02).
  Predecessor status icons are hidden in lists (H-ICONS).

### ART-06 — Unpublish an article with a reason
- **Role:** full
- **Frequency:** per issue, a few.
- **Steps:** set category `--unpublished--` or blog `Trash` → hidden row
  `#unpublishReasonRow` appears → choose `#unpublishReason`, optionally
  `#unpublishReference` → Save.
- **Screens/controls:** `article.pug` `#unpublishReasonRow`;
  `showHideUnpublishReason()`.
- **Mobile risk hints:** the row appears below the title, far from Save
  (top). Otherwise plain form fields.

### ART-07 — Mark the remaining languages as "no translation"
- **Role:** full
- **Frequency:** per issue, several (articles relevant only for some
  languages).
- **Steps:** (a) button **no translation to rest** (`#noTranslationButton`,
  `setNoTranslation()` → `form#noTranslationForm` to
  `/article/:id/notranslation`); only shown when nothing is unsaved; or
  (b) type `-` / `no translation` into a language field and Save.
- **Screens/controls:** `+noTranslationButton` under the language legend.
- **Mobile risk hints:** small button (`btn-small`) in the stacked header;
  becomes `invisible` as soon as anything is modified, without a hint why.

### ART-08 — Comment, mention, solve
- **Role:** full, guest (guests see only comments that mention them or
  are their own)
- **Frequency:** per issue, many — the main communication channel between
  language teams.
- **Steps:** scroll to `#commentArea` → type into `textarea#comment`
  (`@user`, `@LANG`, `#solved`, `#open`) → **Add Comment**
  (`submitAndRedraw` → `/article/:id/addComment`), or **Solve Comment**
  (appends `#solved`), or **Reload Comments**.
- **Screens/controls:** `article/commentArea.pug`.
- **Mobile risk hints:** three `btn-lg` buttons in one line probably wrap;
  avatar column `.col-sm-1` stacks above the text below 576px. The comment
  box sits below the long markdown area — far scrolling. Silent failure on
  error (`console.error` only).

### ART-09 — Edit my own comment / mark a comment as read
- **Role:** full, guest
- **Frequency:** weekly.
- **Steps:** pencil `i.fa.fa-pencil#EditComment<i>` → edit form
  `#EditCommentForm` → **Update** / **Cancel**. Envelope `i.fa.fa-envelope`
  marks a comment read (`callAndRedraw` → `/markCommentRead`).
- **Screens/controls:** `commentArea.pug`.
- **Mobile risk hints:** pencil and envelope are bare icons (no button, no
  padding) — small touch targets.

### ART-10 — Vote on or tag an article
- **Role:** full
- **Frequency:** per issue, several.
- **Steps:** click a vote button in `#voteButtons` (top, votes marked
  `displayAtTop`) or in the "Votes & Tags" table `#voteButtonsList`
  → `/article/:id/setVote.<name>` / `unsetVote`, redraw via JSON. In blog
  views the vote labels (`voteLabel` badges) also toggle votes.
- **Screens/controls:** `voteButtons.pug`, `voteButtonsList.pug`,
  `mixins.pug` `voteButton`, `voteLabel`.
- **Depends on hidden controls:** in blog overview/review the vote labels
  are hidden (H-OVCOLS, H-REVCOLS); in the article view they stay.
- **Mobile risk hints:** 4-column table with descriptions in the article
  view; badges in lists are small.

### ART-11 — Check whether the link was already used
- **Role:** full
- **Frequency:** per article, during collect and edit.
- **Steps:** red **"N doub."** button (`+doublettesButton`) jumps to
  `#doublettes`; links in `#linkArea` show "#(Check for Doublette)";
  wrong/duplicate links in the preview are highlighted
  (`highlightWrongLinks`, `/article/urlexist`).
- **Screens/controls:** `article.pug` `#doublettes` table
  (`table-responsive`, 4 columns, link text up to 80 chars).
- **Mobile risk hints:** wide table with long URLs; horizontal scroll.

### ART-12 — Read the linked page's text inside OSMBC
- **Role:** full
- **Frequency:** per article, sometimes (writing summaries).
- **Steps:** click one of the two text icons (`fa-file-text`,
  `fa-file-text-o`) before each link in `#linkArea` →
  `/article/readability` → text shown in `#linkTextPlainRow`; click again
  to hide.
- **Mobile risk hints:** icons are tiny inline targets; the text block
  appears between collection and markdown fields and pushes them down.

### ART-13 — Insert a language flag / emoji
- **Role:** full
- **Frequency:** per issue, a few (mainly DE).
- **Steps:** click a flag in `#languageFlags` → markdown image copied to
  clipboard (`clip()` + `alert`), then paste; or drag the flag into the
  text (`ondragstartflag`).
- **Mobile risk hints:** drag variant does not work on touch;
  `document.execCommand("copy")` is deprecated and may fail on mobile
  (the code has a fallback alert "use your mobile to copy"). Tooltips
  (`data-bs-toggle="tooltip"`) are hover-only.

### ART-14 — Generate the event calendar text
- **Role:** full
- **Frequency:** per issue, once per language.
- **Steps:** article with category "Upcoming Events" → **(Re)Generate
  Calendar** (`div.btn.btn-info`, `getEventTable`) → `/tool/getEventTable`
  fills the markdown → Save.
- **Mobile risk hints:** generated markdown is a table (`checkForTable`
  switches to monospace); very wide on a phone.

### ART-15 — Throw away my unsaved changes
- **Role:** full
- **Frequency:** rare.
- **Steps:** **last Version** (`#cancelButton`) → reload with `?edit=false`.
- **Mobile risk hints:** sits right next to Save at the top — easy to hit
  the wrong one on a small screen.

### ART-16 — See who changed what in an article
- **Role:** full
- **Frequency:** rare.
- **Steps:** History table at the bottom of the article, or `[changes]`
  link on xs → `/changes/log?table=article&oid=…`; `i.fa-info-circle` →
  `/changes/:id`.
- **Depends on hidden controls:** H-ARTHIST (table replaced by link on xs).
- **Mobile risk hints:** `history.pug` is an 8-column table with an inline
  filter form of six `col-sm-2` inputs.

### ART-17 — Run the German text analysis
- **Role:** full (DE text only)
- **Frequency:** rare.
- **Steps:** link "WORTLIGA Analyse" under the DE preview → posts the
  preview text to an external page (`#textanalyseform`).
- **Mobile risk hints:** leaves OSMBC in the same tab; unsaved text may be
  lost if `beforeunload` is ignored (see ART-02).

---

## Blog / Review

Screens: `views/blog/blogheader.pug` (header, review cards, tabs, export)
with `blog_overview.pug`, `blog_full.pug`, `blog_review.pug` as tab content;
`blog_mixin.pug` holds the client script (`onLeaveText`, `setLangStatus`,
`translate`). Routes in `routes/blog.js`. Help: "The Blog Views".

### BLOG-01 — Open the current issue and see how far my language is
- **Role:** full
- **Frequency:** daily while an issue is being produced.
- **Steps:** navbar blog entry (`firstBlogOfList`, with "not formulated"
  badges) or the home status table → `/blog/<name>` (tab Overview). Read
  the progress bar(s), unsolved comment count `(*)`, review cards.
- **Depends on hidden controls:** H-NAV, H-PROG2, H-BNAME, H-REV2.
- **Mobile risk hints:** only the first language's progress is visible on
  a phone; the second language's state is invisible. Progress bar segments
  carry numbers as text and get very narrow.

### BLOG-02 — Quickly fix an article directly in the blog overview
- **Role:** full
- **Frequency:** per issue, many (help: "Create / Edit / Translate").
- **Steps:** Overview tab → click an article title (`div(onclick=…)`
  toggles `div.card#div<id>`) → edit `textarea#markdown<id>` → leave the
  field: `onchange` → `onLeaveText()` submits `form#EditArticle<id>` to
  `/article/:id/setMarkdown/:lang` (full page reload, scroll position
  restored from `sessionStorage`). Deleting the text = saving an empty
  field.
- **Screens/controls:** `blog_overview.pug` mixin `displayOverviewRow`.
- **Depends on hidden controls:** H-OVCOLS (votes, collectors/editors,
  language status), H-ICONS.
- **Mobile risk hints:**
  - No Save button: saving depends on the `change` event when the textarea
    loses focus. On phones focus loss happens by keyboard "done", tapping
    elsewhere or scrolling — unclear whether `change` fires when the editor
    is closed by tapping the title again (the `div` gets `d-none` while
    focused). Candidate for the **reported failure "deleting/editing
    language contributions in the blog view"** (not reproduced).
  - `openEditor` toggle logic: when one editor is open, tapping another
    title closes the open one instead of opening the new one.
  - The overview is a bare `table` (no `table-responsive`); hidden cells use
    `td.d-none.d-md-block`, which turns cells into blocks on desktop too.
  - Only the left language can be edited here.

### BLOG-03 — Read and edit the full text, two languages side by side
- **Role:** full
- **Frequency:** per issue, editors and translators.
- **Steps:** tab **Full** → rendered text per article, left and right
  language in `columnLeftSize`/`columnRightSize`; click a text to open the
  inline editor (`#ldiv<id>` / `#rdiv<id>`), same blur-to-save as BLOG-02;
  **Mark Auto Translation OK** for machine translations.
- **Depends on hidden controls:** **H-FULL2** (whole second-language column
  incl. its editor and "Mark Auto Translation OK").
- **Mobile risk hints:** on a phone the second language can neither be
  read nor edited in this view — the user must switch the language pair
  (USR-01). Same blur-to-save risk as BLOG-02 — second candidate for the
  reported failure.

### BLOG-04 — Change what the blog views show / filter articles
- **Role:** full
- **Frequency:** weekly (settings are stored per user and view).
- **Steps:** tab icon `#filter` (or scroll to the end) → tick options
  (`userConfigOption` → `setUserConfig` → `/setuserconfig`, reload);
  active filters show dismissable warnings at the top.
- **Depends on hidden controls:** H-FILTERTAB, H-OVOPT, H-REVCOLS (review
  options), and most "show …" options only affect columns that are hidden
  on phones anyway (H-OVCOLS, H-REVCOLS).
- **Mobile risk hints:** all checkboxes use the same `id="exampleCheck1"`;
  the click handler sits on the wrapping `div`, labels are small; option
  block is only reachable by scrolling past the whole blog.

### BLOG-05 — Set my language ready for review
- **Role:** full
- **Frequency:** per issue × language.
- **Steps:** blog header → **Set <blog>(<LANG>) ready for review**
  (`#readyreview`, `setLangStatus(lang,"startreview")` → `/blog/:id/setLangStatus`).
- **Depends on hidden controls:** **H-REVBTN2** for the second language.
- **Mobile risk hints:** button only for the left language on phones; the
  user has to swap the language pair to act on the second. `btn-lg` with
  long label. No error shown on failure (`console.error`).

### BLOG-06 — Do my personal review and write the review comment
- **Role:** full
- **Frequency:** per issue × reviewer × language.
- **Steps:** review card → **Start Personal Review** (`#reviewButton<LANG>`,
  posts "reviewing...") → read the issue (usually in the Review tab) →
  type into `textarea#reviewComment<LANG>` → **Review**, or **cancel**
  (posts "delete").
- **Screens/controls:** `blogheader.pug` mixin `reviewBlog`.
- **Depends on hidden controls:** **H-REV2** (second language's review card).
- **Mobile risk hints:** review card is at the top, the content to review
  below; writing the comment means scrolling back up.

### BLOG-07 — Change my review comment
- **Role:** full
- **Frequency:** per issue, some.
- **Steps:** pencil next to my comment (`a(onclick=…)` without `href`,
  shows `#editReview<LANG><i>`) → edit → **Change**
  (`/blog/:id/editReviewComment/:index`).
- **Depends on hidden controls:** **H-REV2** for the second language.
- **Mobile risk hints:** tiny icon target; anchor without `href` gets no
  pointer/focus semantics. Third candidate for the reported "editing
  language contributions" failure, at least for the second language.

### BLOG-08 — Correct an article in the review view / confirm an automatic translation
- **Role:** full
- **Frequency:** per issue, many (help: "Review … allows to edit an article
  in the view itself").
- **Steps:** tab **Review** → click an article text → inline editor
  (`#div<id>`), blur-to-save as BLOG-02 → **Mark Auto Translation OK**
  (`#reviewTranslation<id><LANG>` → `/article/:id/reviewChange/:lang`).
  Links in the text need right-click to open (help page).
- **Depends on hidden controls:** H-REVCOLS (collector/editor/vote/language
  labels).
- **Mobile risk hints:** "use the right mouse click to open a hyperlink" —
  no right click on touch; a long-press may or may not trigger the
  toggle. Blur-to-save as in BLOG-02.

### BLOG-09 — Close my language (or confirm it was exported)
- **Role:** full
- **Frequency:** per issue × language.
- **Steps:** blog header → **Close <blog>(<LANG>)** (`#closebutton`) or, for
  languages reviewed in WordPress, **Did Export** (`#didexport`) first;
  also in the blog detail table (BLOG-12).
- **Depends on hidden controls:** **H-REVBTN2** for the second language.
- **Mobile risk hints:** no confirmation before closing; button has no busy
  state that works (`prop('html', …)` sets nothing visible).

### BLOG-10 — Export / download the issue
- **Role:** full
- **Frequency:** per issue × language.
- **Steps:** download dropdown `#dropdownExportLanguages` → "Export by
  language" (per profile, nested collapses when > 3 languages) / "Export
  all languages" (closed ones) / "Download corresponding Headers"; or the
  preview tabs per language (`/blog/:id/preview?lang=…`).
- **Depends on hidden controls:** H-DLTAB (preview tabs; dropdown remains).
- **Mobile risk hints:** long dropdown with nested collapses inside the
  tab bar; downloads of HTML/markdown files on a phone have limited use
  (copy into WordPress is a desktop task).

### BLOG-11 — Translate the whole blog in one go
- **Role:** full (only users in `blogTranslationVisibleFor`)
- **Frequency:** per issue.
- **Steps:** navbar **Translate Blog** (`#translateMenu`) → "Translate
  XX->YY" → `/blog/:id/translate/<service>/<from>/<to>` → reload.
- **Depends on hidden controls:** H-NAV.
- **Mobile risk hints:** inside the collapsed navbar; long-running request
  without visible progress (same `d-none`/`hidden` mix as ART-03).

### BLOG-12 — Reopen a language, delete its review, copy texts from another language
- **Role:** full
- **Frequency:** rare (fixes after mistakes).
- **Steps:** `[Edit Blog Detail]` (`#editBlogDetail`) → table per language
  → **Reopen** (`editlang`), **Delete Review** (`#deletereviewbutton`,
  `deleteallreviews`), **Copy From XX** / **Set empty articles to no
  translation** (`/blog/:id/copy/:from/:to`), download icon, close/review
  buttons.
- **Screens/controls:** `blog/blog_edit.pug` (view mode).
- **Mobile risk hints:** 8-column `table.table` **without**
  `table-responsive`, buttons in the last columns — the destructive
  "Delete Review" sits at the far right, likely off-screen. No
  confirmation. Possible link to the reported "deleting language
  contributions" problem.
- **Mobile (2026-10-20):** Reopen is needed on phones and works; see the
  matrix (BLOG-12).

### BLOG-13 — Edit the blog details
- **Role:** full
- **Frequency:** rare.
- **Steps:** blog detail → **Edit** (`#edit`) → name, start/end date
  (plain text fields), status select, categories YAML (`rows=30`),
  team string per language → **OK**.
- **Mobile risk hints:** OK button at the top next to the name; YAML
  editing in a 30-row textarea on a phone.

### BLOG-14 — Look at the blog statistics
- **Role:** full
- **Frequency:** rare.
- **Steps:** `[Statistic]` → `/blog/:id/stat`: progress per language,
  user × field table with rotated headers (`table-header-rotated`).
- **Mobile risk hints:** rotated-header matrix, one column per user — wide.

### BLOG-15 — See all blogs and close a finished one
- **Role:** full
- **Frequency:** per issue.
- **Steps:** home "(more)" or `/blog/list?status=…` → table with one column
  per active language → **Close Blog** (GET `?setStatus=closed`).
- **Screens/controls:** `bloglist.pug`.
- **Depends on hidden controls:** H-BLIST (additional text only).
- **Mobile risk hints:** `table-responsive` with ~15+ columns; "Close Blog"
  is a plain link in the last column, no confirmation.

### BLOG-16 — Create a blog by hand
- **Role:** full
- **Frequency:** rare (normally automatic every Tuesday).
- **Steps:** admin navbar **Tools → Create Blog** → `createblog.pug` →
  **Create Blog** (`#createBlog`).
- **Mobile risk hints:** none beyond the collapsed admin navbar.

### BLOG-17 — Sort the TBC list into blogs
- **Role:** full
- **Frequency:** weekly (links collected through the chat integration).
- **Steps:** navbar **TBC** → `/blog/TBC` (`blog_tbc.pug`) → open each
  article (edit icon) → choose blog/category → Save (ART-05). Option
  "disable other collections".
- **Depends on hidden controls:** **H-TBC** (menu entry gone on xs when I
  have no own TBC articles), H-TBCT, H-ICONS.
- **Mobile risk hints:** on xs the TBC list is reachable only through the
  article search menu (`#articleMenuTBC`, a list without TBC context).

---

## Collect / Inbox

### COL-01 — Collect a new link for the next issue
- **Role:** full (guest variant: GST-02)
- **Frequency:** weekly, many per editor — main input of the whole process.
- **Steps:** navbar **Collect** (`#collect`) → `/article/create` →
  paste link/keywords into `#searchField` → **Search** (`#searchButton`,
  enabled after 2 characters) → check result table for duplicates
  (rows expand to show texts) → in "Create Article" choose blog
  (`#blog`) and category (`#categoryEN`), title (`#title`, ≥ 6 chars),
  collection text → **OK** (`#OK`, `addSpinnerAndSubmit`) → lands in the
  new article (ART-02).
- **Screens/controls:** `collect.pug`; Selenium test
  `test/collect/uc.collect.test.js`.
- **Depends on hidden controls:** **H-COLTAB** (Cat (EN) and Collection
  header), H-NAV.
- **Mobile risk hints:**
  - Search row is `col-3 / col-6 / col` with **non-responsive** columns:
    the search field gets half the width, the `btn-lg` Search button the
    rest — cramped at 360px.
  - Result table: header for "Collection" hidden but the cell is still
    rendered → columns shifted on xs.
  - Expanding a result row works by tapping anywhere in the row, which also
    contains links (blog, title).
  - OK/Cancel sit above title and collection fields; after typing the
    collection the user has to scroll up.
  - Sharing a link from another phone app into OSMBC is not supported
    (would need a share target) — a mobile-native path worth considering.

### COL-02 — Search existing articles
- **Role:** full
- **Frequency:** weekly.
- **Steps:** navbar **Search → Search** (`#articleMenuSearch`) → same
  screen as COL-01 without the create form.
- **Depends on hidden controls:** H-COLTAB, H-NAV.
- **Mobile risk hints:** as COL-01; results are capped, "Show All" link.

### COL-03 — Work through my inbox
- **Role:** full, guest
- **Frequency:** daily — badges in the navbar (`#inbox`) count personal,
  main-language and second-language mentions.
- **Steps:** navbar **Inbox** → `/usert/inbox` (`inbox.pug`): cards per
  article with unread comments, grouped by blog, "direct" and "indirect"
  (language) mentions → envelope link marks a comment read → title opens
  the article to answer (ART-08). Option "show read messages".
- **Depends on hidden controls:** H-NAV, H-ICONS.
- **Mobile risk hints:** fixed `col-1 / col-11` grid (not responsive):
  the icon column is ~30px on a phone and holds several icons
  (`articleIcons`, `flex-nowrap`) — will overflow. Envelope is a small icon
  link.

### COL-04 — Get a list of articles
- **Role:** full
- **Frequency:** weekly.
- **Steps:** navbar **Search** → "My Empty Collections", "Trash", "TBC",
  "Future", "No Blog"; or click a badge in the home status table
  (`?unwrittenLang=` / `?writtenLang=`) → `articlelist.pug` (5 columns:
  title, blog, category, collection, text in main language).
- **Depends on hidden controls:** H-NAV.
- **Mobile risk hints:** `table-responsive` with shortened texts; the
  status table badges on home are the main entry point (COL-05).

### COL-05 — See on the start page what needs to be done
- **Role:** full
- **Frequency:** daily — start page after login.
- **Steps:** `/` (`index.pug`): blog status table (languages × blogs,
  badges link to article lists), badge legend, current users, visitors
  today, new users, admin link; right column "Last Changes".
- **Depends on hidden controls:** **H-HOME** (welcome text on xs; whole
  "Last Changes" column below 992px).
- **Mobile risk hints:** `blogStatusTable` is `table-responsive`, one row
  per active language (many languages → long page). The admin link is the
  only path to ADM-01 besides the URL.

---

## Guest

Guests log in with their OSM account and get role `guest`
(`test/uc.access/uc.access.test.js`). Guests are the most likely to use a
phone without training.

### GST-01 — Log in with my OSM account
- **Role:** guest, full
- **Frequency:** once per device/session.
- **Steps:** `/login` (`login.pug`) → **Login with OpenStreetMap OAuth 2.0**
  (`#login`) → OSM authorisation → back to home.
- **Mobile risk hints:** long text before the button (the page says "use
  the button at the end of the page"); OAuth round trip may open the OSM
  app or another browser context.

### GST-02 — Submit a news link as a guest
- **Role:** guest
- **Frequency:** occasional, per guest.
- **Steps:** navbar **Submit Link** (`#collect`) → same flow as COL-01
  (search for duplicates, "Submission" instead of "Collection") → OK.
- **Depends on hidden controls:** H-COLTAB, H-NAV.
- **Mobile risk hints:** as COL-01. The blog selector is shown to guests
  too (open blogs + Future).

### GST-03 — See what happened to my submitted links
- **Role:** guest
- **Frequency:** occasional.
- **Steps:** home `/` (`index_guest.pug`, also navbar **My Articles**) →
  table of my articles with blog, category, title, unpublish reason →
  open an article (read-only for most fields, comments).
- **Depends on hidden controls:** H-GHOME (cosmetic).
- **Mobile risk hints:** production status table (`col-md-4`) stacks under
  the list — fine. The guest article view is the same heavy article page
  (ART-01 hints apply).

### GST-04 — Answer a comment on my submission
- **Role:** guest
- **Frequency:** occasional — triggered by mail or inbox badge.
- **Steps:** Inbox (COL-03) or mail link → article → comment area → Add
  Comment (ART-08).
- **Mobile risk hints:** as ART-08 / COL-03.

---

## User / Profile

### USR-01 — Switch my language pair / language set
- **Role:** full, guest
- **Frequency:** weekly; on a phone more often, because second-language
  content is hidden (H-FULL2, H-REV2, H-REVBTN2) and switching is the only
  workaround.
- **Steps:** navbar right: language dropdowns (`#language`, `#language2`,
  … via `langChooser`, `chooseLanguage()` → `/language`) or language set
  menu (`#languageSetMenu`, `chooseLanguageSet()` → `/languageset`), save
  a set (`#newSetToBeSaved`, `#saveNewSet`), delete a set.
- **Depends on hidden controls:** H-NAV.
- **Mobile risk hints:** up to four stacked dropdowns (article view allows
  `langMenu(99)`) inside the collapsed navbar; a text input inside a
  dropdown (on-screen keyboard may close the menu).

### USR-02 — Change my profile and notification settings
- **Role:** full, guest (guest form is shorter: `user_guest.pug`)
- **Frequency:** rare.
- **Steps:** avatar in navbar (`img` with `onclick`) or mail alert link →
  `/usert/self` → email (resend/delete), weekly author markdown, language,
  mail options (multi-selects), translation services, Mattermost user,
  number of languages, public profile, colour → **OK** (`#save`).
- **Screens/controls:** `user.pug`, `user_guest.pug`, `mixins.pug`
  `labeled*` mixins.
- **Depends on hidden controls:** **H-EXPL** (every field's explanation —
  the only description of what "Thread Mentioning" etc. mean), H-USER.
- **Mobile risk hints:** OK at the very end of a long form; multi-selects
  (`bootstrap-select`) on touch; avatar is an `img` with `onclick`, not a
  link.

### USR-03 — Try the guest view / log out
- **Role:** full
- **Frequency:** rare.
- **Steps:** profile → **Switch temporary to Guest**
  (`?becomeGuest=true`) / **logout user** (`/logout`).
- **Mobile risk hints:** logout exists only at the bottom of the profile
  page, not in the navbar.

### USR-04 — Look at another editor's profile
- **Role:** full
- **Frequency:** rare.
- **Steps:** user name links on home ("Full Visitors Today", "Welcome To
  The Team") → `/usert/:name`; OSM/HDYC icon links; change history table.
- **Depends on hidden controls:** H-USER (heatmap).
- **Mobile risk hints:** 6-column history table.

### USR-05 — Open a help page
- **Role:** full, guest
- **Frequency:** rare.
- **Steps:** navbar **Help** (`#helpDropdown`, items from config
  `helpmenu`) → `/help/<page>` or external links.
- **Depends on hidden controls:** H-NAV.
- **Mobile risk hints:** help texts describe desktop gestures (right click,
  drag & drop, upper right corner).

---

## Admin / Config

All admin screens use `adminlayout.pug` (own navbar: user lists, Tools →
Create Blog). These are desk tasks; mobile use is unlikely but possible
for quick checks.

### ADM-01 — Check the admin start page
- **Role:** full
- **Frequency:** rare.
- **Steps:** home "Admin View → click here" (`#adminlink`) →
  `/osmbc/admin` (`adminindex.pug`): config links, long-absent users,
  DeepL usage, last changes (7-column table).
- **Mobile risk hints:** wide changes table (`table-responsive`).

### ADM-02 — Edit a configuration entry
- **Role:** full
- **Frequency:** rare.
- **Steps:** admin page link → `/config/<name>` (`config/config.pug` +
  per-config views) → edit YAML/text in `textarea#yaml` / `#text`
  (`wrap="off"`, monospace, 14 rows) → **OK** → errors/warnings shown.
- **Mobile risk hints:** fixed `col-11 / col-1` grid with explanation in a
  ~30px column; `wrap="off"` YAML needs horizontal scrolling; YAML
  indentation hard to type on a phone keyboard.

### ADM-03 — Manage users
- **Role:** full
- **Frequency:** rare.
- **Steps:** admin navbar **Users** (`#userLists`) → list variants
  (`userList.pug`, 13 sortable columns) / **Create** (`#createUser`) →
  user page (USR-02 form incl. **Access**) → OK.
- **Depends on hidden controls:** H-EXPL.
- **Mobile risk hints:** 13-column table.

### ADM-04 — Run a script plugin and read its log
- **Role:** full, only users listed in `scriptUser`
- **Frequency:** rare.
- **Steps:** navbar **Tools → Execute Scripts** → choose script →
  parameter form (`script_execute_page.pug`, `col-sm-3/5/4`) → **Execute**;
  **Script Results** → log list → log.
- **Depends on hidden controls:** H-NAV.
- **Mobile risk hints:** file inputs / multipart form; log output width.

### ADM-05 — Search the change history
- **Role:** full
- **Frequency:** rare.
- **Steps:** `[changes]` links or `/changes/log` (`history.pug`) → filter
  inputs (user, blog, table, oid, property, date) → submit → click a row
  for `/changes/:id` (`change.pug`).
- **Mobile risk hints:** six `col-sm-2` inputs in a row inside a table
  header; 8-column result table.

---

## Cross-cutting hints

- **Navbar (H-NAV):** `navbar-expand-lg` + `fixed-top`. Below 992px every
  navigation and the language chooser sit behind the toggler; when
  expanded the menu overlays the page. `public/stylesheets/style.css`
  reserves a fixed `padding-top: 50px` on `body`; that covers only the
  collapsed bar, not the expanded menu, and possibly not a two-line bar
  either.
- **Second language on phones:** the blog views hide nearly everything of
  the right-hand language below 768px (H-PROG2, H-REVBTN2, H-REV2,
  H-FULL2). Users who edit two languages have to switch the language pair
  (USR-01) for every task.
- **Blur-to-save editors** (BLOG-02, BLOG-03, BLOG-08, also
  `blog_tbc.pug`'s `onLeaveText`) have no explicit save control.
- **Drag & drop** (ART-04, ART-13) and **hover tooltips** have no touch
  equivalent.
- **Bare icons as controls** (pencil, envelope, edit icon, flag, avatar)
  without button padding — small touch targets.
- **Non-responsive grids:** `col-1/col-11` (inbox), `col-3/col-6/col`
  (collect search), `col-11/col-1` (config) stay side by side on phones.
- **Wide tables:** blog detail (no `table-responsive`), bloglist, user
  list, history, statistics, article doublettes/history.
- **Silent failures:** most AJAX actions only `console.error` on failure
  (`setLangStatus`, `submitAndRedraw`, `saveWithComment`), so a failed
  action on a flaky mobile connection looks like "nothing happened".
