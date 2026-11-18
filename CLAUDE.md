# OSMBC — base assumptions for Claude

OSMBC (OpenStreetMap Blog Collector) supports the editorial workflow for the
weekly OSM news (German "Wochennotiz" / international "WeeklyOSM"). Editors
collect article references, edit them bilingually (German/English, plus more
languages), and export the finished issue.

This file holds facts that are true regardless of which branch/worktree/task
you're on. Task- or worktree-specific notes belong in `CLAUDE.local.md`
(gitignored, imported below) — not here, to avoid drift between branches.

## Architecture

`docs/architecture.md` is the map of the code base (startup, request
flow, persistence, `setAndSave`, notifications, configuration, where to
start for a change). Read it before changing unfamiliar code. The rules
that matter most, in short:

- Every table (`blog`, `article`, `changes`, `config`, `usert`,
  `session`) is `id` + `jsonb` `data`; query `data->>'field'`. The user
  table is `usert`. No foreign keys.
- `blog.categories` order drives heading order and the lead-picture
  caption position; reorder relative to an existing category.
- Editorial changes go through `setAndSave`, never a bare `save()`,
  even for fields that should stay invisible — filter those with a
  `FilterReceiver` instead.
- Every `messageCenter` receiver implements all eight methods
  (no-op stubs allowed); each receiver filters relevance itself.

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
- The `npm test*` scripts run through `tools/run-tests.mjs`: each run
  gets a free port, its own database `osmbc_test_<port>` and a temp
  directory (mail log, `.sync-state.json`), passed via `OSMBC_TEST_*` env
  variables that `config.js` lays over `config.test.yaml` (the file itself
  never changes). The database is dropped afterwards (`--keep` to inspect
  it). So parallel runs in different or the same worktree don't collide.
  CI goes through the wrapper too. Calling `mocha` directly
  (without the wrapper, e.g. `test-github`)
  still uses the fixed values from `config.test.yaml` and is not safe to
  run in parallel. `npm test` measures no coverage; `npm run
  test:coverage` (c8) + `npm run coverage:check` do, CI runs those two
  (floors per directory in `coverage-thresholds.json`, see
  `docs/development.md` "Coverage").

## Export

- Export targets are defined under `ExportProfiles` in the config
  (HTML/WP, Markdown, Hugo — `renderer: HUGO`). OSMBC is meant to be the
  editorial source of truth; Hugo export is one of several render targets
  generated from it, not a separate data source. See
  `docs/export-profiles.md` for the field-by-field meaning of a profile
  entry, `docs/hugo-export.md` for the Hugo front matter (including the
  `slugalias.json` old-URL redirect mechanism), and `docs/API.md` for the
  caller-facing API that consumes it.

## Readability rules (ESLint)

- New or changed application code keeps the limits in `eslint.config.js`
  (complexity 15, depth 4, 80 lines per function, 5 params) and gets a
  JSDoc comment on every exported function/class/method (what it does,
  what the caller must know — not a restatement of the name).
- Never grow `eslint-suppressions.json` (no `--suppress-all`, no hand
  edits) to get past a new violation; fix the code. After fixing old
  violations run `npm run lint:prune` and commit the file. Details:
  `docs/development.md` "Lint rules for readability".

## Admin configurations

- `docs/admin-config.md` describes every configuration of the admin page
  (database configs like `slacknotification`, `votes`, `helpmenu`); each
  config page shows its section as help. Whoever changes what such a
  config means — a new config in `model/config.js`, a new or changed key
  or value, its default in `data/<name>.yaml|txt`, how it is read (e.g.
  `notification/ConfigFilter.js`) — updates that section in the same
  commit. A test fails for a config without a section; keys and values
  are not checked automatically. `.claude/settings.json` has a hook that
  reminds of this after edits of those files (it does not see edits made
  through shell scripts).

## Web UI

- Before changing views, client scripts or `style.css`, read
  `docs/ui-guidelines.md`: mobile mode (`osmbc-mobile` class, one language
  at a time on phones), tap targets, no hidden functions, no inline event
  handlers, phone tests through the page objects, and known traps.

## Development workflow

- Prefer `git worktree` for working on unrelated things in parallel (e.g.
  one worktree per feature branch) instead of stashing/switching branches
  in a single checkout — keeps configs, local DB pointers, and in-progress
  edits from bleeding into each other.
- Run tests with `npm test` (`test:model`, `test:router`, `test:ui` for
  narrower layers). See "Configuration" above for how parallel
  runs are isolated.
- New feature/fix work (e.g. implementing a GitHub issue) belongs on its
  own branch created off `master`, not committed directly to `master` —
  part of the GitHub-Flow model being adopted (see
  `docs/RELEASE_PROCESS_CHECKLIST.md`). Small, purely internal process/tooling
  changes the user is actively directing turn-by-turn (like the
  Conventional Commits rollout itself) are the exception and can go
  straight to `master`.
- This is a one-person project — the user is the only reviewer there ever
  is, so a GitHub pull request is pure ceremony for the user's own
  branches and must not be opened for them. Branch → commit → merge
  straight into `master` locally and push (see "Closing out a finished
  feature/fix branch" below); do not run `gh pr create`. PRs (and their
  squash-merge handling from `docs/RELEASE_PROCESS_CHECKLIST.md`) are reserved
  for actual external contributors, who are a different situation
  entirely (someone else's branch, not yours to merge unilaterally).
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
  `docs/development.md`), but don't rely on the hook being installed —
  write commit messages in this format regardless.
- **Closing out a finished feature/fix branch:** the branch's last CI run
  must be green (`gh run list --branch <branch> --limit 1`). Then merge
  into `master` and push first, then — before removing anything — check the worktree for
  untracked files (`git status --short --untracked-files=all`), especially
  stray `.md` notes, that might hold content that should have been folded
  into a commit instead of left on disk. Only after that's clean: remove
  the worktree (`git worktree remove`), delete the local branch
  (`git branch -d`, safe-delete — refuses unless it's actually merged),
  and delete the remote branch if it was pushed
  (`git push origin --delete <branch>`). Don't skip straight to deleting.

@CLAUDE.local.md
