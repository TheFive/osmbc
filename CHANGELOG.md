# Changelog

## [4.4.13](https://github.com/TheFive/osmbc/tree/4.4.13) (2026-10-24)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.4.12...4.4.13)

**Fixed bugs:**

- deps: update follow-redirects to 1.16.1
- deps: update sanitize-html to 2.18.0
- deps: update dompurify to 3.4.17
- deps: update markdown-it to 14.3.3
- deps: update sanitize-html to 2.18.1
- deps: update ip-address to 10.7.4
- deps: update body-parser to 2.4.0
- deps: update undici override to 7.30.1
- deps: update nodemailer to 10.2.1
- deps: update dev dependencies fast-uri and serialize-javascript

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
