# OSMBC — base assumptions for Claude

OSMBC (OpenStreetMap Blog Collector) supports the editorial workflow for the
weekly OSM news (German "Wochennotiz" / international "WeeklyOSM"). Editors
collect article references, edit them bilingually (German/English, plus more
languages), and export the finished issue.

This file holds facts that are true regardless of which branch/worktree/task
you're on. Task- or worktree-specific notes belong in `CLAUDE.local.md`
(gitignored, imported below) — not here, to avoid drift between branches.

## Data model (Postgres)

- Every content table (`blog`, `article`, `changes`, `config`, `usert`,
  `session`) stores one row per object as `id` + a `jsonb` `data` column —
  there are no real typed columns. Query fields via `data->>'field'`
  (e.g. `data->>'categoryEN'`), not as if they were columns.
- The user table is named `usert`, not `users`.
- No foreign keys exist between these tables — a per-table
  TRUNCATE/DROP+reload has no ordering constraints to worry about.
- `blog.categories` is an ordered array: its element order drives both the
  rendered heading order **and** the lead-picture caption's position — not
  just display order. Reorder relative to an existing anchor category, never
  to absolute index 0.

## Configuration (`config.js`)

- Config is environment-based: `config.<NODE_ENV>.yaml` (or `.yml`/`.json`)
  is loaded from the repo root. Known environments: `development` (local
  work), `test` (CI/local test runs), `wpreconcile`, `production`.
- `config.development.yaml` and other environment-secret files are
  gitignored — they hold local DB credentials and are per-machine, not
  shared via git. Each worktree has its own copy: since every branch now
  gets its own dedicated worktree (see "Development workflow" below), a
  worktree's `config.development.yaml` can just directly hold whatever
  DB/port that branch needs — no per-branch overlay/switching required.
- `NODE_ENV=test` has no branch overlay of any kind. `config.test.yaml` always
  points at the same fixed database/table names, and the test bootstrap
  (`test/testutil.js` `clearDB`) drops/recreates those fixed tables on
  (almost) every test file. Running test suites from two worktrees against
  the same local Postgres server at the same time is not safe.

## Export

- Export targets are defined under `ExportProfiles` in the config
  (HTML/WP, Markdown, Hugo — `renderer: HUGO`). OSMBC is meant to be the
  editorial source of truth; Hugo export is one of several render targets
  generated from it, not a separate data source. See
  `docs/export-profiles.md` for the field-by-field meaning of a profile
  entry, `docs/hugo-export.md` for the Hugo front matter (including the
  `slugalias.json` old-URL redirect mechanism), and `docs/API.md` for the
  caller-facing API that consumes it.

## Notifications (`setAndSave` → `messageCenter`)

- Every `setAndSave`/`closeBlog`/etc. mutation broadcasts the full `change`
  object to **every** registered `messageCenter.global` receiver
  (`notification/messageCenter.js`), via `updateBlog`/`updateArticle`/
  `sendReviewStatus`/`sendCloseStatus`/`addComment`/`editComment`/`sendInfo`.
  It is each receiver's own job to decide whether a given change is
  relevant to it — the broadcaster does not filter anything itself.
  Concretely today: `LogModuleReceiver` (Postgres `changes` log, wrapped in
  a `FilterReceiver`), `ExportReceiver` (text-log for operational markers),
  and, via `IteratorReceiver`, one `MailReceiver`/`SlackReceiver` instance
  per interested channel/user.
- `MessageCenter` calls every receiver method **unconditionally, with no
  existence check** — a receiver that's missing one of the seven interface
  methods (`sendInfo`, `updateArticle`, `updateBlog`, `sendReviewStatus`,
  `sendCloseStatus`, `addComment`, `editComment`) throws as soon as that
  event fires. Any new receiver must implement all seven (no-op stubs for
  the irrelevant ones), e.g. `notification/exportReceiver.js`.
- Relevance filtering is inconsistent by receiver, and that inconsistency
  matters: `UserConfigFilter` (wrapping `MailReceiver` per user) checks
  `change.status` before reacting; `LogModuleReceiver` on its own does
  **not** filter at all — it logs whatever keys are present in `change`
  unconditionally, so an unfiltered receiver turns every field change into
  a Postgres row visible to editors. `notification/FilterReceiver.js` is
  the generic, reusable wrapper for bolting a relevance predicate in front
  of a receiver that doesn't already do its own filtering (formalizes what
  `UserConfigFilter` did ad hoc) — see `notification/messageCenter.js` for
  how it wraps `LogModuleReceiver` to skip purely operational fields (e.g.
  `blog.exportedBy`, set by `Blog.prototype.markAsExported`).
- Net effect: a field that should stay invisible to editors (not appear in
  the change history, not trigger a mail/Slack "changed" notification)
  should still be written via `setAndSave` like everything else — never by
  reaching for a bare `save()` to dodge the broadcast — and instead get a
  `FilterReceiver`-wrapped or self-filtering receiver that ignores it.

## Development workflow

- Prefer `git worktree` for working on unrelated things in parallel (e.g.
  one worktree per feature branch) instead of stashing/switching branches
  in a single checkout — keeps configs, local DB pointers, and in-progress
  edits from bleeding into each other.
- Run tests with `npm test` (`test:model`, `test:router`, `test:ui` for
  narrower layers). See "Configuration" above for the shared-test-DB
  caveat when multiple worktrees are in play.
- New feature/fix work (e.g. implementing a GitHub issue) belongs on its
  own branch created off `master`, not committed directly to `master` —
  part of the GitHub-Flow model being adopted (see
  `RELEASE_PROCESS_CHECKLIST.md`). Small, purely internal process/tooling
  changes the user is actively directing turn-by-turn (like the
  Conventional Commits rollout itself) are the exception and can go
  straight to `master`.
- That feature/fix branch gets its **own new worktree/folder** — never
  check it out inside an existing worktree that's meant to track a stable
  branch (e.g. `osmbc-master` tracking `master`, `osmbc-develop` tracking
  `develop`). Checking out a feature branch inside one of those pulls the
  branch out from under any other session still using that directory —
  confirmed painful in practice once multiple concurrent Claude Code
  sessions share a machine.
- Commit messages must follow the Conventional Commits format described in
  `CONTRIBUTING.md` (`type(scope): subject`, types from
  `@commitlint/config-conventional`, `Closes #123`/`Refs #123` footer for
  issue links) — applies to every commit made in this repo, including ones
  Claude makes on the user's behalf. A `commit-msg` hook
  (`git-hooks/CommitMsg.sh`) can enforce this locally once installed (see
  `README Developer.md`), but don't rely on the hook being installed —
  write commit messages in this format regardless.
- **Closing out a finished feature/fix branch:** merge into `master` and
  push first, then — before removing anything — check the worktree for
  untracked files (`git status --short --untracked-files=all`), especially
  stray `.md` notes, that might hold content that should have been folded
  into a commit instead of left on disk. Only after that's clean: remove
  the worktree (`git worktree remove`), delete the local branch
  (`git branch -d`, safe-delete — refuses unless it's actually merged),
  and delete the remote branch if it was pushed
  (`git push origin --delete <branch>`). Don't skip straight to deleting.

@CLAUDE.local.md
