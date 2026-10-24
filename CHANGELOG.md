# Changelog

## [4.5.0-beta.3](https://github.com/TheFive/osmbc/tree/4.5.0-beta.3) (2026-10-20)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.4.10...4.5.0-beta.3)

**Features:**

- blog: add save and cancel buttons to the blog inline editors
- layout: open the menu as a side panel on small screens [#1155](https://github.com/TheFive/osmbc/issues/1155)
- article: keep save reachable in a bar at the bottom on small screens [#1155](https://github.com/TheFive/osmbc/issues/1155)
- mobile: work in one language on small screens [#1154](https://github.com/TheFive/osmbc/issues/1154)
- mobile: insert collection links by tapping instead of copying a language
- mobile: show a second language on demand on the article page
- mobile: tap-sized controls and no sideways scrolling on phones
- mobile: tap-sized blog views, start page, collect and user page
- mobile: tap-sized comment, review and inbox actions
- mobile: tap-sized text links and blog list, no flags on phones

**Fixed bugs:**

- blog: store "closed" instead of "close" from the blog edit form
- views: hide translate menu entries for closed target languages
- article: show translate progress and done mark again
- views: table cells in the blog overview and tap to copy a language text
- mobile: keep the desktop view of phone browsers in desktop mode
- mobile: way home from the menu panel
- mobile: keep the blog status table on the start page
- mobile: compact blog status table and folded legend on phones
- mobile: only the mobile language row of the status table is tall
- deps: update follow-redirects to 1.16.1

## [4.4.12](https://github.com/TheFive/osmbc/tree/4.4.12) (2026-10-18)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.4.11...4.4.12)

**Features:**

- article: draft an empty language markdown from a link with Claude

## [4.4.11](https://github.com/TheFive/osmbc/tree/4.4.11) (2026-10-18)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.4.10...4.4.11)

**Features:**

- api: accept the blogSync API key in the Authorization header

**Fixed bugs:**

- blog: store "closed" instead of "close" from the blog edit form
- views: hide translate menu entries for closed target languages
- api: reject inherited object property names as API key
- article: check preview links once instead of on every keyup
- deps: update proxy-addr, compression and source-map-js

## [4.4.10](https://github.com/TheFive/osmbc/tree/4.4.10) (2026-10-05)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.4.9...4.4.10)

**Features:**

- article: validate feature image link on save [#1145](https://github.com/TheFive/osmbc/issues/1145)

**Fixed bugs:**

- user: make OSM avatar lookup work again
- user: drop avatar prefetch for all users on startup
- security: escape readability error and text output
- security: sanitize readability html of external pages
- security: pass script route errors to error handler
- security: avoid quadratic regex in feature image parsing
- security: build collection link list as DOM elements
- security: use prototype-free map for config lookup
- share protocol matched SSRF agents for external requests
- security: allow --insecure only for local sync remotes
- security: mask API key in blog sync error messages
- security: set session cookie secure auto and SameSite lax

Older releases (up to 4.4.9, generated from GitHub issues/PRs by the
previous tool): see [CHANGELOG-ARCHIVE.md](CHANGELOG-ARCHIVE.md).
