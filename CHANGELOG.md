# Changelog

## [4.5.0-beta.2](https://github.com/TheFive/osmbc/tree/4.5.0-beta.2) (2026-10-18)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.4.10...4.5.0-beta.2)

**Features:**

- blog: add save and cancel buttons to the blog inline editors
- layout: open the menu as a side panel on small screens [#1155](https://github.com/TheFive/osmbc/issues/1155)
- article: keep save reachable in a bar at the bottom on small screens [#1155](https://github.com/TheFive/osmbc/issues/1155)
- mobile: work in one language on small screens [#1154](https://github.com/TheFive/osmbc/issues/1154)
- mobile: insert collection links by tapping instead of copying a language
- mobile: show a second language on demand on the article page

**Fixed bugs:**

- blog: store "closed" instead of "close" from the blog edit form
- views: hide translate menu entries for closed target languages
- article: show translate progress and done mark again
- views: table cells in the blog overview and tap to copy a language text
- mobile: keep the desktop view of phone browsers in desktop mode

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
