# Tools

Scripts for maintaining and testing OSMBC. They are run by hand or from
`npm` scripts and are not part of the running application.

Run them from the repository root.

| Tool | Purpose | Usage |
|---|---|---|
| `run-tests.mjs` | Runs a test command with its own port, database `osmbc_test_<port>` and temp directory, so parallel test runs don't collide. All `npm test*` scripts use it. | `NODE_ENV=test node tools/run-tests.mjs [--keep] <command> [args...]` |
| `coverage-uncovered-functions.js` | Lists the functions without coverage from an lcov report. | `npm run test:coverage:render:functions`, or `node tools/coverage-uncovered-functions.js [lcov.info] [path prefix]` |
| `staticFileServer.js` | Serves `public/` and `test/` on port 3032, e.g. to look at the HTML files of the render tests in a browser. | `npm run staticHtmlServerd` |
| `coverage-check.mjs` | Checks the c8 coverage per directory against `coverage-thresholds.json`; `--write` raises the floors. | `npm run coverage:check` after `npm run test:coverage` |
| `dataAdminTemplate.py` | Starting point for a bulk correction script against the blogSync API of a running instance (dry run unless `--commit`). See [docs/API.md](../docs/API.md#bulk-corrections-through-the-api-data-admin). | `python3 tools/dataAdminTemplate.py --remote-url https://<host><htmlroot> --min-blog-number 300 --max-blog-number 320` |
| `split-config.mjs` | Splits a config file into a technical and an editorial part (`editorial_config`). | `node tools/split-config.mjs <config file> <technical out> <editorial out>`, see [docs/config.md](../docs/config.md) |
| `dokuwiki-to-md.mjs` | Converts a DokuWiki data directory into the Markdown wiki. See [docs/wiki.md](../docs/wiki.md). | see `docs/wiki.md` |
| `whoisonline.sh` | Before restarting a server: shows editors online in the last 10 minutes, running Postgres queries (exports, API calls) and recent writes to the change log. | `tools/whoisonline.sh [config file]` (default: `config.production.yaml` if present, else `config.development.yaml`) |

See [docs/development.md](../docs/development.md) for the test setup.
