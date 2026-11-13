# UI guidelines

Rules for every change to the web UI (pug views, `public/javascripts/`,
`public/stylesheets/style.css`), desktop and phone. They come from the
mobile UI rework (4.5.0); the analysis behind them is in `docs/mobile/`
(`audit.md`, `use-cases.md`, `platform-matrix.md`, `findings.md`).

## Mobile mode

- OSMBC has a **mobile mode**, not just narrow screens. It is on below
  992 px viewport width: a script in the page head sets the cookie
  `osmbc_view`, the server sets `req.mobileView` and passes
  `layout.mobileView` to the views (`routes/layout.js`).
- A phone browser's "desktop view" (viewport wider than 1.2 × screen
  width) counts as desktop, on purpose.
- In mobile mode `<html>` has the class `osmbc-mobile`. Mobile CSS hangs on
  that class, **not** on media queries (a media query would also hit the
  desktop view of a phone, about 980 px). On desktop the class is absent,
  so the desktop DOM and the HTML snapshots stay unchanged.
- On phones editors work **in one language at a time**: their mobile
  language (`user.mobileLang`, chosen in the menu), separate from the
  desktop language pair. A second language is shown on demand.

## Rules

1. **Don't hide functions on small screens.** No `d-none d-sm-*` /
   `d-md-*` on something an editor needs. Move it (menu, row below), or
   give it its own mobile flow. Showing the desktop element as it is, is
   not automatically the answer either: ask whether the desktop flow fits a
   phone at all.
2. **Tap targets** at least 44 × 44 px, at least 8 px apart. Button rows
   as `d-flex flex-wrap gap-2` (Bootstrap margins between buttons break
   input/button groups). Normal `btn`; the mobile height comes from the
   global rule in `style.css`. `btn-lg` only for the one primary action of
   a block.
3. **Primary action on the right** (Save, Review, Update), Cancel / the
   secondary action on the left, as `btn-outline-secondary`.
4. **Saving is explicit and visible.** Save is always reachable (on phones
   the save bar at the bottom), and the user sees the result (saving … /
   saved / not saved). No silent save without feedback.
5. **No desktop-only interaction** without a tap alternative: drag and
   drop, hover, tooltips.
6. **The page is never wider than the screen.** Long words and URLs wrap
   (`overflow-wrap: anywhere`); tables scroll inside their own container.
   Mobile tests assert `scrollWidth <= innerWidth`.
7. **Menus and overlays don't cover what the user needs** and close after
   the action.
8. **No new inline event handlers** (`onclick=`, `onchange=` …) in views.
   Use `data-*` attributes and listeners in `public/javascripts/`
   (delegated when the area is redrawn). This prepares a CSP without
   `'unsafe-inline'`.
9. **Remove dead code** in the area you touch (unused templates, page
   variables, handlers). It misleads people and agents.

## Tests

- Every mobile change gets a phone test: `getNewDriver(user, { device:
  "phone" })` (`test/browser.js`, Chrome emulation 390 × 844; `"desktopView"`
  emulates a phone in desktop view).
- Tests operate the UI only through the page objects in
  `test/PageObjectModel/`; the test file holds the business steps and
  checks. Waiting belongs in `Page` (`_clickAndWaitForNavigation`,
  `_tapAndWaitForNavigation`).
- `Page.tapTargetsTooSmall()` / `tapTargetsTooClose()` measure rule 2.

## Classifying findings

Error classes used in `docs/mobile/findings.md`:
A invisible (hidden) · B covered (fixed/overlay) · C unreachable
(scroll/position) · D tap target too small · E layout breaks (horizontal
overflow, columns) · F desktop-only interaction (drag, hover, tooltip) ·
G desktop-view trap · H invisible behaviour (implicit save, no feedback).

## Traps

- **Selenium `clear()` fires `change`.** In tests select all and type
  instead, or the blur/change handler saves an empty field.
- **`onclick="translate(...)"`** resolves to `HTMLElement.prototype.translate`
  (an attribute), not to the global function. Another reason for rule 8;
  inline it would need `window.translate(...)`.
- **jQuery `toggleClass(cls, state)`** with a non-boolean state (e.g. `""`)
  toggles instead of setting. Pass a real boolean.
- **Bootstrap sets `scroll-behavior: smooth`.** In tests scroll with
  `Page.tap()` (instant scroll), otherwise the click hits a moving element.
- **A tap on a button below a focused text field can get lost:** the blur
  makes the field shrink (fit to content), the button moves away under the
  finger. Give such buttons `mousedown` → `preventDefault()`, so the field
  keeps the focus until the click.
- **The `scroll` event fires in the next frame** after `scrollTo()`. Tests
  that check a scroll reaction wait for it (see `BlogPage.scrollToEnd`).
- **Layout tweaks that must not change the DOM** (e.g. the body padding
  that follows the navbar height) can use `document.adoptedStyleSheets`;
  the desktop HTML snapshots stay stable.
