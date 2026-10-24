# Tools

Scripts for maintaining and testing OSMBC. They are run by hand or from
`npm` scripts and are not part of the running application.

Run them from the repository root.

| Tool | Purpose | Usage |
|---|---|---|
| `run-tests.mjs` | Runs a test command with its own port, database `osmbc_test_<port>` and temp directory, so parallel test runs don't collide. All `npm test*` scripts use it. | `NODE_ENV=test node tools/run-tests.mjs [--keep] <command> [args...]` |
| `coverage-uncovered-functions.js` | Lists the functions without coverage from an lcov report. | `npm run test:coverage:render:functions`, or `node tools/coverage-uncovered-functions.js [lcov.info] [path prefix]` |
| `staticFileServer.js` | Serves `public/` and `test/` on port 3032, e.g. to look at the HTML files of the render tests in a browser. | `npm run staticHtmlServerd` |
| `whoisonline.sh` | Before restarting a server: shows editors online in the last 10 minutes, running Postgres queries (exports, API calls) and recent writes to the change log. | `tools/whoisonline.sh [config file]` (default: `config.production.yaml` if present, else `config.development.yaml`) |

See [docs/development.md](../docs/development.md) for the test setup.
