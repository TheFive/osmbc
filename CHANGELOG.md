# Changelog

## [4.11.1](https://github.com/TheFive/osmbc/tree/4.11.1) (2026-11-27)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.11.0...4.11.1)

**Fixed bugs:**

- wiki: conflict check on every change, input checks in the store
- changes: key the diff cache by content, not by change id

**Performance:**

- article: render partial views and mails with a template cache [#1182](https://github.com/TheFive/osmbc/issues/1182)
- layout: cache the menu bar blogs instead of loading them per request
- changes,users: time range for the history log, pages for the user list
- changes: skip the character diff and cache the history diffs

## [4.11.0](https://github.com/TheFive/osmbc/tree/4.11.0) (2026-11-27)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.10.0...4.11.0)

**Features:**

- container: add a Containerfile and a CI job that builds and starts it

**Fixed bugs:**

- createdb: detect and add missing primary keys and tables
- **BREAKING** server: stop cleanly on SIGTERM, read OSMBC_HOSTNAME instead of HOSTNAME – the environment variable HOSTNAME no longer overrides serverhostname; use OSMBC_HOSTNAME.
- db: accept the database password from POSTGRES_PASSWORD alone
- article: store \n line breaks so unchanged texts are no change [#1187](https://github.com/TheFive/osmbc/issues/1187) [#1018](https://github.com/TheFive/osmbc/issues/1018)
- comments: match @mentions on the whole name [#986](https://github.com/TheFive/osmbc/issues/986)
- comments: show date and time of comments older than a day [#952](https://github.com/TheFive/osmbc/issues/952)
- comments: check @mentions literally everywhere [#986](https://github.com/TheFive/osmbc/issues/986)
- comments: let a mentioned guest answer the comment
- security: look up users by exact value [#1188](https://github.com/TheFive/osmbc/issues/1188)
- db: keep secrets out of the slow-query log

## [4.10.0](https://github.com/TheFive/osmbc/tree/4.10.0) (2026-11-22)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.9.0...4.10.0)

**Features:**

- article: confirm links the link check can't verify [#1183](https://github.com/TheFive/osmbc/issues/1183)
- blog: answer exists or missing for links that can't be checked [#1183](https://github.com/TheFive/osmbc/issues/1183)
- home: show the next automatic actions in one line
- home: show only the next automatic action
- firstdraft: show Claude the current issue and save drafts as ClaudeAI [#1185](https://github.com/TheFive/osmbc/issues/1185)
- link: store link check results and editors' answers in one table [#1184](https://github.com/TheFive/osmbc/issues/1184)
- link: all link check durations configurable in LinkCheck [#1184](https://github.com/TheFive/osmbc/issues/1184)

**Fixed bugs:**

- layout: centre the menu bar entries on the admin pages too
- notification: a failing receiver no longer stops the others [#1182](https://github.com/TheFive/osmbc/issues/1182)
- article: the charset decoder no longer breaks other requests
- auth: a failed OSM login returns to the login page under htmlroot
- tools: coverage:dead escapes function names in its regular expressions
- article: list links that can't be checked on the article page too [#1183](https://github.com/TheFive/osmbc/issues/1183)
- layout: keep the admin pages' content below the menu bar

## [4.9.0](https://github.com/TheFive/osmbc/tree/4.9.0) (2026-11-22)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.8.2...4.9.0)

**Features:**

- layout: show the running version at the end of the Help menu

**Fixed bugs:**

- model: findById of article and blog calls back twice on a DB error
- blog: refuse unknown languages for review and close status
- blog: a review comment is never a status command
- blog: answer an unknown blog with 404 on every blog route
- blog: name the close functions after what they do
- blog: the review form buttons send an action, not a magic text
- calendar: show the town for places not tagged as city [#1181](https://github.com/TheFive/osmbc/issues/1181)

## [4.8.2](https://github.com/TheFive/osmbc/tree/4.8.2) (2026-11-20)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.8.1...4.8.2)

**Fixed bugs:**

- db: createdb.js hangs since the index analysis was removed

**Performance:**

- blog: read authors of all articles of a blog with one query
- user: find new users of the start page through an index

## [4.8.1](https://github.com/TheFive/osmbc/tree/4.8.1) (2026-11-20)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.8.0...4.8.1)

**Fixed bugs:**

- layout: centre the menu bar entries vertically

## [4.8.0](https://github.com/TheFive/osmbc/tree/4.8.0) (2026-11-20)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.7.0...4.8.0)

**Features:**

- transition: start the review when every article is written
- transition: weekly time for switching to edit and creating the next blog
- blog: a language can only be closed when every article is written [#1137](https://github.com/TheFive/osmbc/issues/1137)
- transition: close a whole blog when its active languages are done [#1134](https://github.com/TheFive/osmbc/issues/1134)
- blog: broken caption anchors block the close, Auto Close tells the team [#1130](https://github.com/TheFive/osmbc/issues/1130)
- notification: choose new submissions, changes and guest texts [#1170](https://github.com/TheFive/osmbc/issues/1170)
- notification: editor-only level and channel preview of the new keys [#1170](https://github.com/TheFive/osmbc/issues/1170)
- help: show the admin configuration help in the help menu to full users [#1170](https://github.com/TheFive/osmbc/issues/1170)

**Fixed bugs:**

- article: set no translation for closed languages of a new article [#1133](https://github.com/TheFive/osmbc/issues/1133)
- collect: keep found duplicates in sight on phones [#987](https://github.com/TheFive/osmbc/issues/987)
- article: ask for the unpublish reason right below the category [#1171](https://github.com/TheFive/osmbc/issues/1171)
- collect: show categories in the phone language on phones [#1176](https://github.com/TheFive/osmbc/issues/1176)
- article: save the comment together with the article [#914](https://github.com/TheFive/osmbc/issues/914)
- article: accept auto translation review for multi-line texts [#1177](https://github.com/TheFive/osmbc/issues/1177)

## [4.7.0](https://github.com/TheFive/osmbc/tree/4.7.0) (2026-11-15)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.6.0...4.7.0)

**Features:**

- wiki: git-backed page store and wiki config
- wiki: view, edit and index pages
- wiki: history, move/delete, search, images, Mattermost messages
- wiki: choose the target folder when moving a page
- wiki: choose the folder when creating a page
- wiki: allow single user names in readAccess and writeAccess
- wiki: migration script from the DokuWiki git history
- config: split the wiki block into technical and editorial parts
- helpmenu: paths inside OSMBC and a default without instance links

**Fixed bugs:**

- ui: react to text changed without key events
- wiki: treat link targets case-insensitively like DokuWiki
- ui: drop auto translation marker after inline save [#1175](https://github.com/TheFive/osmbc/issues/1175)
- wiki: keep file access inside the wiki directory, linear name trims

## [4.6.0](https://github.com/TheFive/osmbc/tree/4.6.0) (2026-11-14)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.5.1...4.6.0)

**Features:**

- config: allow config, cache and profile directories outside the app directory
- config: optional second file for the editorial settings

## [4.5.1](https://github.com/TheFive/osmbc/tree/4.5.1) (2026-11-13)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.5.0...4.5.1)

**Fixed bugs:**

- deps: update follow-redirects to 1.16.3

## [4.5.0](https://github.com/TheFive/osmbc/tree/4.5.0) (2026-11-13)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.4.14...4.5.0)

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
- mobile: beta.3 feedback — menu from the left, save at the end
- mobile: no sideways scroll in the blog overview, growing inline editor
- mobile: growing comment fields, no hint texts on phones
- mobile: chosen votes in the blog views on phones too
- mobile: show First Draft as buttons at the text field on small screens
- article: offer a First Draft when collecting a link
- article: let First Draft suggest a compact title when collecting
- article: roll out First Draft by user list, full or guest
- mobile: beta.4 feedback — open editor, back to top, one icon line
- firstdraft: suggest the category when collecting

**Fixed bugs:**

- article: show translate progress and done mark again
- views: table cells in the blog overview and tap to copy a language text
- mobile: keep the desktop view of phone browsers in desktop mode
- mobile: way home from the menu panel
- mobile: keep the blog status table on the start page
- mobile: compact blog status table and folded legend on phones
- mobile: only the mobile language row of the status table is tall
- deps: update follow-redirects to 1.16.1
- deps: update sanitize-html to 2.18.0
- user: keep avatars on disk, placeholder while unknown
- test: pick the chromedriver port on 127.0.0.1
- test: wait for page reloads in the blog UI tests
- test: keep the UI test browser off the internet
- test: wait for the navigation of every page-loading click
- test: measure driver.wait timeouts with a real timer
- test: treat "node does not belong to the document" as stale
- test: wait for the review form submit and slow page renders
- db: wait up to 10 s for a free pool client

## [4.4.14](https://github.com/TheFive/osmbc/tree/4.4.14) (2026-10-25)

[Full Changelog](https://github.com/TheFive/osmbc/compare/4.4.13...4.4.14)

**Features:**

- **BREAKING** article: offer translate into many languages to all users – manyTranslationVisibleFor replaced by the boolean manyTranslationEnabled (default true).
- blog: auto-translate open languages at a configured time
- admin: show upcoming automatic actions

**Fixed bugs:**

- **BREAKING** security: remove server-side script plugin – config key scripts is gone; set manyTranslationVisibleFor to keep the many-languages translate menu.
- deps: drop express-fileupload, sanitize-filename and glob
- test: write the export log of a test run to its temp directory
- blog: auto-translate only once per blog and language

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
previous tool): see [CHANGELOG-ARCHIVE.md](docs/CHANGELOG-ARCHIVE.md).
