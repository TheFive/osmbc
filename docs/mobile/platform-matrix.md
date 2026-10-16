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

| ID | Change | Fixes |
|---|---|---|
| X1 | Navbar: does not cover content (height, scrolling inside, closes after an action), works in the browser's "desktop view" (~980 px) | B, G – every use case |
| X2 | One reachable primary action per edit screen (e.g. Save bar at the bottom of the article view) | C – ART-02/03/05/06/07 |
| X3 | Blog inline editors get an explicit Save (and visible feedback), not only save-on-blur. **Done 2026-10-16:** Save/Cancel buttons in Overview, Review and Full; saving in the background without page reload (`keepalive`, so leaving the page right away does not lose it); leaving the field still saves; status "saved" / "not saved". Mobile test `test/blog/uc.blog.mobile.test.js`. | H – BLOG-02/03/08 |
| X4 | Language switching designed for "one language at a time": per article and per blog, all actions of the chosen language available (review, close, comments, progress) | A – ART-03, BLOG-01/03/05–09 |
| X5 | Replace the Bootstrap 3 class `hidden` in `public/javascripts/article_view.js` with `d-none`. Confirmed 2026-10-16: after a translation the menu entry stayed and the done mark never appeared (all platforms, since 2020-12, `6e5e23e2`). `showRL` uses it too, but is dead code: the article page only renders `article_all_column`. **Done.** | ART-03 on all platforms |
| X6 | `td.d-none.d-md-block` → `d-md-table-cell` (`blog/blog_overview.pug`); align hidden `th`/`td` in `collect.pug` | E – BLOG-02/04, COL-01/02, also desktop |
| X7 | Tap alternative for drag-only actions (copy full language text) | F – ART-02/04 |
| X8 | Article page layout: `article_all_column.pug` puts every language of the user side by side, each column `min-width: 400px` → wider than a phone screen. One language at a time on phones (fits X4). | E – ART-01/02/03 |

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
| BLOG-12 | Reopen, delete review, copy texts | rare | D | | | – | D |
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
