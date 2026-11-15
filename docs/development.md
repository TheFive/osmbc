# Readme for Developer

If you are interested in do some bugfixing, develop some enhancements or just get a local copy
running for your own multi language blog project, this readme should give you some usefull advise.


## Tooling

Following development tools are required

* PostgreSQL (tested with 16.10)
* Node.js 22 or newer with npm (tested with 22.22.0)
* main developer is using VS Code with some plugins to develop

More info in the [Installation Guide](install.md). How the code is organised:
[Architecture](architecture.md).

## Tests

Tests use mocha; the files are in `test/`. Requirements:

* a local Postgres server. `config.test.yaml` holds the connection (user
  `postgres`/`postgres` on `localhost:5432`); the `POSTGRES_HOST`,
  `POSTGRES_PORT`, `POSTGRES_USER` and `POSTGRES_PASSWORD` environment
  variables override it. The user must be allowed to create databases.
* Chrome for the Selenium UI tests (`uc.*.test.js`); selenium-webdriver
  finds the matching chromedriver itself.

| Command | What runs |
|---|---|
| `npm test` | everything, without coverage (`test:fast` is the same) |
| `npm run test:model` | model, notification, render, util and merger tests |
| `npm run test:router` | `test/routes.*.test.js` |
| `npm run test:ui` | Selenium use case tests `test/**/uc.*.test.js` |
| `npm run test:coverage` | everything, with coverage (`c8`), report in `coverage/` |
| `npm run coverage:check` | coverage per directory against `coverage-thresholds.json` |

Single files: `npm test -- test/model.blog.test.js`
(add `-g "<name part>"` for single tests).

### Coverage

Coverage is measured with [c8](https://github.com/bcoe/c8) (V8's own
coverage, works with ES modules; settings in `.c8rc.json`). It is a
separate run, `npm test` does not measure it. CI runs
`npm run test:coverage` followed by `npm run coverage:check` and attaches
the HTML report (`coverage/index.html`) as artifact `coverage-report`;
the per-directory table is in the job summary.

`coverage-thresholds.json` holds one floor per top-level directory
(lines, branches, functions in %). It means "don't get worse", not a
target: the check fails when a directory drops below its floor, for
example because new code came without tests. After adding tests, raise
the floors with `node tools/coverage-check.mjs --write` (it writes the
current values rounded down, minus one point of headroom, because the UI
tests don't hit exactly the same code in every run) and commit the file.
Never lower a floor just to get CI green without saying why in the commit.

More useful than the percentage is the list of untested code: open
`coverage/index.html` and look for red branches in code you touch.
`render/` has its own, stricter check (`npm run test:coverage:render:check`).

### Parallel test runs

The `npm` scripts run through `tools/run-tests.mjs`. For every run it

1. picks a free port for the test server,
2. creates the database `osmbc_test_<port>`,
3. creates a temp directory for the mail log, the export log and the blog
   sync state file,
4. starts the tests with these values in `OSMBC_TEST_PORT`,
   `OSMBC_TEST_DB`, `OSMBC_TEST_TMPDIR` and `OSMBC_SYNC_STATE_FILE`
   (`config.js` and `syncState.js` read them; `config.test.yaml` is not
   changed),
5. drops the database and deletes the temp directory afterwards, also
   after Ctrl-C.

So several test runs can run at the same time, in different worktrees or
in the same one. CI uses the same scripts. Two `npm test` runs in the same
worktree still write the same `coverage/` report (the last one wins);
the tests themselves are not affected.

To look at the database after a run, start the wrapper with `--keep`:

```
NODE_ENV=test node tools/run-tests.mjs --keep npx mocha test/model.blog.test.js
```

The first output line names port, database and temp directory. Drop the
database by hand afterwards (`DROP DATABASE osmbc_test_<port>`); a run
killed with `kill -9` leaves its database as well:

```
psql -U postgres -h localhost -c "SELECT datname FROM pg_database WHERE datname LIKE 'osmbc_test_%'"
```

Calling `mocha` directly with `NODE_ENV=test` (without the wrapper) uses
the fixed port 35043 and the database from `config.test.yaml`; such runs
must not run in parallel.

### Environment variables

* `TEST_HEADLESS=TRUE` runs Chrome without a window (set by all `npm`
  scripts). Without it you can watch the UI tests.
* `TEST_LOG=TRUE` shows the application log during tests.
* `TEST_HTML_PRETTY=TRUE` reformats expected HTML files that are not
  pretty-printed.

### HTML comparison

Many UI tests compare the rendered page with an expected file
`test/<area>/<name>.html`. On a difference the test writes
`<name>_actual.html` next to it (CI uploads these as artifact
`test-actual-files`). If the new page is correct, rename the
`_actual` file to the expected one; `test/mv_actual2test.sh` does that for
all `_actual.html` files in the current directory.

## Lint rules for readability

The goal: code that a person can read and change without help. ESLint
(`eslint.config.js`) checks the application code (not `test/`, not
`tools/`) for

| Rule | Limit | Why |
|---|---|---|
| `complexity` | 15 | branches per function; more is hard to follow and to test |
| `max-depth` | 4 | nested blocks |
| `max-lines-per-function` | 80 (without blank and comment lines) | a function should fit on a screen |
| `max-params` | 5 | more parameters want an options object |
| `jsdoc/require-jsdoc` | exported functions, classes and methods | what a module offers is described where it is defined |
| `jsdoc/check-param-names`, `jsdoc/check-tag-names` | — | a JSDoc comment that exists matches the code |

A JSDoc comment says what the function does and what the caller has to
know (side effects, callback/promise, errors), not what the name already
says. Parameters don't have to be listed one by one; if they are, the
names must be right.

**Existing code** breaks these rules in about 480 places. They are listed
per file and rule in `eslint-suppressions.json`
([bulk suppressions](https://eslint.org/docs/latest/use/suppressions)),
so they don't fail the lint. New violations do — `npm run lint` and the
ESLint test in `npm test` fail. When a file goes over its allowed count,
ESLint shows *all* violations of that rule in the file; the new one is
the one you added.

When you fix old violations (split a function, add a JSDoc), the
suppression file still allows the old count and `npm run lint` says
"There are suppressions left that do not occur anymore". Run
`npm run lint:prune` and commit `eslint-suppressions.json`, so the
allowed count goes down for good. Don't add entries by hand and don't run
`--suppress-all` again to hide new violations.

## Commit messages

Please follow the Conventional Commits format described in
[CONTRIBUTING.md](../CONTRIBUTING.md) — the project is moving its changelog
generation to read directly from commit history.

To check your commit messages locally before pushing, install the
commit-msg hook once per clone (all worktrees of a clone share its
`.git/hooks`, so it applies to them automatically):

```
cp git-hooks/CommitMsg.sh .git/hooks/commit-msg
```

(requires `npm install` to have run, so `commitlint` is available).

## Changelog and releases

`CHANGELOG.md` is generated by [git-cliff](https://git-cliff.org/)
(npm devDependency, config in `cliff.toml`) from the commit history since
4.4.9 and fully regenerated on every run; older releases are in the
static `docs/CHANGELOG-ARCHIVE.md`. Between releases the committed
`CHANGELOG.md` is not updated; it is regenerated as part of each release.

When the tests run:

* while working: only the affected part, `npm test -- test/<file>` or
  `npm run test:model` (a full run takes about 7 minutes locally);
* on every push to `master`, `feature/**`, `fix/**`, `ci/**`: the full
  suite with coverage in CI;
* **before merging a branch into `master`:** the CI run of the branch's
  last commit is green;
* **before a release:** the CI run of the commit on `master` that the
  release is cut from is green (`gh run list --branch master --limit 1`).
  The release commit itself only changes version and changelog.

To cut a release:

```
npm version <x.y.z|patch|minor|major> -m "chore(release): %s"
git push origin master <x.y.z>
```

`npm version` bumps `package.json`/`package-lock.json`, runs the
`version` script (`npm run changelog` + stage `CHANGELOG.md`), commits
everything as one release commit and tags exactly that commit (`.npmrc`
sets `tag-version-prefix=""`, so tags stay `x.y.z`, not `vx.y.z`). The
commit-msg hook checks the release message too; if it rejects it, no
commit or tag is created, but the bumped files stay staged — reset them
with `git checkout HEAD -- package.json package-lock.json CHANGELOG.md`
before retrying.


