# Platform matrix: which use case on which platform

Status: 2026-10-11, **proposal** — the column "Decision" is filled by the
product owner. Use-case IDs from `use-cases.md`, finding classes A–H from
`audit.md`.

## Target levels

| Level | Meaning on a phone (≤ 430 px, portrait) |
|---|---|
| **M** | Must work with the desktop flow, once the cross-cutting fixes are in. |
| **M\*** | Must work, but with its **own mobile flow** (the desktop flow does not fit a small screen). |
| **R** | Read / look up only; editing may be clumsy, no extra work for it. |
| **D** | Desktop only. On a phone the page may be shown, but nothing is promised. |

Desktop (≥ 992 px) stays the reference for **all** use cases.

## Cross-cutting prerequisites

Most use cases depend on a few shared changes. They come first.
Order agreed 2026-10-16: X5 → X3 → X1, then the rest.

| ID | Change | Fixes | Status |
|---|---|---|---|
| X1 | Navbar: does not cover content (height, scrolling inside, closes after an action), works in the browser's "desktop view" (~980 px). Below `lg` the menu is a side panel (offcanvas) that closes after choosing an entry; the content padding follows the real navbar height. Desktop unchanged. Language dropdowns stay until X4. | B, G – every use case | **done** 2026-10-16 (see commit `feat(layout)`). Test `test/layout/uc.navbar.mobile.test.js` (#1155 case). |
| X2 | One reachable primary action per edit screen. Article view below `lg`: the Save / last Version buttons at the top are replaced by a bar at the bottom of the screen (one Save only); it appears only when something is changed, so it also signals "unsaved". The tap keeps the focus in the text field (on touch screens the tap was lost otherwise). Desktop unchanged. | C – ART-02/03/05/06/07 | **done** 2026-10-16 (commit `feat(article)` save bar). Test `test/uc.article/uc.article.mobile.test.js`. |
| X3 | Blog inline editors get an explicit Save (and visible feedback), not only save-on-blur. Save/Cancel in Overview, Review and Full; saving in the background without page reload (`keepalive`, so leaving the page right away does not lose it); leaving the field still saves; status "saved" / "not saved". | H – BLOG-02/03/08 | **done** 2026-10-16, `aa7eeb2d`. Test `test/blog/uc.blog.mobile.test.js`. |
| X4 | "One language at a time" on phones: a separate mobile language on the user (see Decisions 6), one language display and one language choice; per article and per blog all actions of that language available (review, close, comments, progress) | A – ART-03, BLOG-01/03/05–09 | **done** 2026-10-16: mobile mode below 992px (cookie `osmbc_view`, set by a script in the page head; the server renders one language). Separate `mobileLang` on the user (default: main language; choice: active languages plus the user's own), switched in the header, never touches the desktop pair. Article and blog views show only that language, so review/close/progress are available for it. Tests `test/layout/uc.mobilelanguage.test.js`. |
| X5 | Replace the Bootstrap 3 class `hidden` in `public/javascripts/article_view.js` with `d-none`: after a translation the menu entry stayed and the done mark never appeared (all platforms, since 2020-12, `6e5e23e2`). | ART-03 on all platforms | **done** 2026-10-16, `9de97811` |
| X6 | `td.d-none.d-md-block` → `d-md-table-cell` (`blog/blog_overview.pug`); align hidden `th`/`td` in `collect.pug` | E – BLOG-02/04, COL-01/02, also desktop | **done** 2026-10-16: overview cells use `d-md-table-cell` (were `display:block` from md on, broke the table on the desktop too); the collection cell in the collect search is hidden on phones like its header. Tests in `test/blog/uc.blog.mobile.test.js`. |
| X7 | Tap alternative for drag-only actions (collection links) | F – ART-02/04 | **done** 2026-10-18: below lg every collection link has two buttons, "+ Link" (inserts `[](url)` at the cursor, around a selection) and "+ translated" (Google translate link in the field's language). Dragging still works on the desktop; the drag hint shows on lg only. The first version (2026-10-16, tap a language label to copy its full text) is removed: copying a whole language was replaced by automatic translation (feedback 2026-10-17). Test in `test/uc.article/uc.article.mobile.test.js`. |
| X8 | Article page layout: `article_all_column.pug` puts every language of the user side by side, each column `min-width: 400px` → wider than a phone screen. One language at a time on phones. | E – ART-01/02/03 | **done** 2026-10-16: column width fixed (see above) and in mobile mode one language column; the other languages are hidden, disabled translation sources. Translate buttons at the empty field, one per language with text, EN first. |
| X9 | Compact header on phones: the top bar shows only the menu button and the app name. Show context instead (current issue and, with X4, the mobile language, tappable to switch it, e.g. `WN846 · DE`); hide the bar when scrolling down, show it again when scrolling up. The bottom stays reserved for the save bar. | space on every screen | **done** 2026-10-16: in mobile mode the header shows the issue (link) and the mobile language (tap to switch) instead of the app name; the bar slides out when scrolling down and back when scrolling up. Language dropdowns and the Translate menu are not shown in mobile mode. |
| X10 | Button sizes and spacing on phones: every tap target at least 44 × 44 px, at least 8 px between targets; the visible size may be smaller than the tap area. `btn-lg` is used as a general style (comment area, search, review), so button rows wrap into stacked lines that touch each other and take much height (comment area: 3 rows, about 150 px). One prominent primary action per block, secondary actions compact (icon buttons or a "⋯" menu), rows as `d-flex flex-wrap gap-2`. Bare icons as controls (pencil, envelope, flag, avatar) get a padded tap area. First step: the ux-reviewer measures all interactive elements per screen (too small / too close / much height for a rare action). | D, E – ART-08/09/10, BLOG-05/06, COL-01, all screens | measured and decided 2026-10-20, see `findings.md` (packages P1–P4); in progress |
| X11 | Second language on demand on phones (beta feedback 2026-10-17/18: an editor writes in DE, then translates to EN or checks the auto translation; two languages are enough, the second one editable) | A – ART-02/03 | **done** 2026-10-18: in mobile mode the article page has "Show EN" / "Hide EN" below the text: the other language of the desktop pair, stacked below and editable, saved together (the browser remembers whether it is shown). "Translate → EN" appears while the mobile language has text (also unsaved) and the second one is empty: one tap shows it and translates. Article page only, blog views stay one language. Test in `test/uc.article/uc.article.secondlang.mobile.test.js`. |
| X12 | Hint and help texts on phones: drag hints, formulation tips and explanations above fields take space and partly describe desktop actions. Hide them in mobile mode or move them to a page help (one "?" per page). | layout – all screens (beta feedback 2026-10-17) | open |

Related cleanups (dead code removed while working in the area):
`208bd271` (unused article column templates, `showRL`),
`c1d3552b` (unused blog templates, TBC editor script).

## Measured usage (access log 2026-09-10 – 2026-10-11)

Column "Measured mobile": share of phone + tablet in all actions of that use
case, in brackets the number of people doing it on a phone/tablet. Aggregated,
anonymised count from the production access log (113 users, ~8 % of all
requests from phones/tablets; 31 users used a phone at least once, 10 only a
phone). "–": not visible in the log (client-side only, or no route of its own).

**How to read it.** The numbers show what people manage to do on a phone
**today**, not what they would do with a usable mobile UI. A use case that is
hidden, covered or awkward on a phone is used less there, or people wait until
they are at a desktop. So:

- A low or zero share **with** a known obstacle (marked ⚠ with its class) is
  *suppressed* usage and says nothing about the need. Example: ART-03 translate
  is 0 % because the menu is hidden on phones (A).
- A noticeable share **despite** an obstacle is a strong signal. Example:
  BLOG-02/08 inline edit is the most used mobile writing path (150×), although
  it has no Save button (H).
- A zero share **without** an obstacle (export, blog settings, configuration,
  search) supports "desktop only".
- A phone in the browser's "desktop view" counts as desktop, so mobile usage
  is rather underestimated.

## Matrix

| UC | Goal | Freq. | Proposal | Needs | Mobile flow idea | Measured mobile | Decision |
|---|---|---|---|---|---|---|---|
| ART-01 | Open article, see status | very high | M | X1, X8 | | 6.7 % (21) | M |
| ART-02 | Write/fix text, save | very high | M\* | X1, X2, X7, X8 | One language per screen, Save always visible | 4.5 % (11) ⚠C | M\* |
| ART-03 | Translate with a service | very high | M\* | X1, X2, X4, X5 | "Translate into …" as a button at the empty target language, result in place, then Save | 0 % of 262 ⚠A | M\* |
| ART-04 | Markdown links | high | M | – | Paste on selection is enough; drag stays desktop | – | M |
| ART-05 | Move blog/category/position | several/issue | R | X2 | | – | R |
| ART-06 | Unpublish with reason | few/issue | M | X2 | | – | M |
| ART-07 | Mark rest "no translation" | several/issue | M | X2 | | 0 % of 38 | M |
| ART-08 | Comment, mention, solve | many/issue | M | X1 | | 25 % (4) | M |
| ART-09 | Edit own comment / mark read | weekly | M | X1 | | 7 % | M |
| ART-10 | Vote / tag | several/issue | M | | check touch target size | 21 % (5) | M |
| ART-11 | Check doublettes | per article | R | | | 7.5 % (auto) | R |
| ART-12 | Read linked page text | sometimes | R | | | 0 % of 4 | R |
| ART-13 | Insert flag/emoji | few/issue | R | | click alternative exists | – | R |
| ART-14 | Generate calendar text | once/issue | D | | | 13 % (2) | D |
| ART-15 | Discard unsaved changes | rare | M | X2 | part of the Save bar | – | M |
| ART-16 | Article history | rare | R | | `[changes]` link exists | 15 % (5) | R |
| ART-17 | German text analysis | rare | D | | | – | D |
| BLOG-01 | Open issue, see progress | daily | M\* | X1, X4 | Progress of the chosen language, switch language in place | 6.3 % (18) | M\* |
| BLOG-02 | Quick fix in overview | many/issue | M\* | X3, X6 | Tap article → editor with Save/Cancel | 11 % (6) ⚠H | M\* |
| BLOG-03 | Full text, two languages side by side | per issue | M\* | X3, X4 | One language at a time, toggle | tabs 21 % (6) | M\* |
| BLOG-04 | View options / filter | weekly | R | X6 | | 22 % (2) | R |
| BLOG-05 | Set language ready for review | per issue × lang | M | X4 | | 2.5 % (1) ⚠A | M |
| BLOG-06 | Personal review + comment | per issue × reviewer | M | X4 | | 10 % (5) | M |
| BLOG-07 | Change review comment | some | M | X4 | larger edit target than the pencil | – (no data) | M |
| BLOG-08 | Correct in review / confirm auto translation | many/issue | M\* | X3, X4 | same editor as BLOG-02 | 25 % (2) | M\* |
| BLOG-09 | Close language / did export | per issue × lang | M | X4 | | 2.5 % (1) ⚠A | M |
| BLOG-10 | Export / download | per issue × lang | D | | publishing happens on a desktop | 0 % of 62 | D |
| BLOG-11 | Translate whole blog | per issue | D | | | 0 % of 75 | D |
| BLOG-12 | Reopen, delete review, copy texts | rare | D | | Reopen works on phones (beta feedback 2026-10-17), improve: 8-column table without `table-responsive`, buttons at the far right, Delete Review without confirmation | – | M (Reopen only; Delete Review, Copy: D) |
| BLOG-13 | Edit blog details | rare | D | | | save 0 % of 51 | D |
| BLOG-14 | Blog statistics | rare | R | | | 0 % of 3 | R |
| BLOG-15 | Blog list, close a blog | per issue | R | | | 9 % (3) | R |
| BLOG-16 | Create blog by hand | rare | D | | | – | D |
| BLOG-17 | Sort TBC into blogs | weekly | M | X1 | TBC entry must not disappear (H-TBC) | 0 % of 4 | M |
| COL-01 | Collect a new link | weekly, many | M | X1, X6 | typical on-the-go task | 22 % (9) | M |
| COL-02 | Search articles | weekly | M | X6 | | 0 % of 32 | M |
| COL-03 | Work through inbox | daily | M | X1 | | 12 % (6) | M |
| COL-04 | Article lists (empty, trash, …) | weekly | R | | | 12 % (3) | R |
| COL-05 | Start page: what to do | daily | M\* | | Short "to do" first, "Last changes" can stay hidden | 11 % (27) | M\* |
| GST-01 | Log in | per device | M | | | – | M |
| GST-02 | Submit a link as guest | occasional | M | X6 | | in COL-01 | M |
| GST-03 | My submitted links | occasional | M | | | – | M |
| GST-04 | Answer a comment | occasional | M | | | – | M |
| USR-01 | Switch language pair | weekly | M | X1 | becomes rarer with X4 | 5 % (3) | M |
| USR-02 | Profile, notifications | rare | R | | field explanations hidden < md | 21 % (10) | R |
| USR-03 | Guest view / log out | rare | M | | | – | M |
| USR-04 | Other editor's profile | rare | R | | | in USR-02 | R |
| USR-05 | Help page | rare | M | | | – | M |
| ADM-01 | Admin start page | rare | D | | | 6 % (1) | D |
| ADM-02 | Edit configuration | rare | D | | | 0 % of 40 | D |
| ADM-03 | Manage users | rare | R | | e.g. set a user to guest on the go (happened in a report) | 0 % of 26 | D |
| ADM-04 | Script plugins | rare | D | | | – | D |
| ADM-05 | Search change history | rare | D | | | 15 % (5) | D |

Summary of the proposal: 23 × M, 7 × M\*, 12 × R, 11 × D (of 53).

## Decisions (2026-10-16)

Based on the polls (5 participants), the access log and the analysis:

1. **Mobile model: one language at a time** (X4). On a phone, you work on one
   language; every action for it is on that screen; the language can be
   switched in place.
2. **Translating is fully supported on phones** (ART-03 = M\*).
3. **Admin is desktop only**: ADM-01 to ADM-05 = D.
4. **Order:** X5 first (also a desktop bug), then X3, then X1.
5. All other use cases: the proposed level is accepted.

6. **X4 detail (2026-10-16): a separate mobile language.** On a phone the
   user works in exactly one language. It is stored separately on the user,
   so switching it on the phone does not change the desktop language pair
   and vice versa. Mobile mode is detected by screen width (a small script
   stores it in a cookie). One breakpoint for everything: below 992px
   (Bootstrap `lg`), where the menu panel and the save bar apply too.
   Exception (2026-10-18, beta feedback): the "desktop view" of a phone
   browser (~980px) is desktop mode, the way out for editing several
   languages on a phone. It is recognised by a viewport much wider than the
   screen; the menu panel and the save bar still apply there (CSS, below
   `lg`). The first version (2026-10-16) made it mobile mode as well.
   Default: the user's main language. Choice: all active languages (e.g. for
   reviewers checking several languages). The phone UI then needs only one
   language display and one language choice.

7. **Beta feedback (2026-10-20).** Reopening a language (BLOG-12) is needed
   on phones; it works already and gets a better layout later. Delete Review
   and Copy stay desktop only. Hint texts on phones are a layout topic, not a
   use case: X12.

Feedback that is not in the catalogue yet: be notified when someone submits a
link, and discuss the submission with its author (esp. guests) on the phone.
Candidate for a new use case next to COL-01 / ART-08.

Testing: most editors use **Firefox on Android** (also Vivaldi, Brave; no
iPhone so far). Mobile checks need Firefox, not only Chrome emulation.

## Open questions (answered 2026-10-16, see Decisions)

1. Is "one language at a time" the agreed mobile model (X4)? It decides the
   design of ART-03, BLOG-01/03/05–09.
2. Translating on a phone (ART-03): full support (M\*), or is reading +
   small fixes enough?
3. Admin on a phone: only ADM-03 (change a user's access) as R, the rest D?
4. Does X5 (translate/language switch broken since 2020) go in first as a
   separate fix, since it affects the desktop too?
