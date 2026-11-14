# Installing OSMBC

This guide installs OSMBC on a Linux server: Node.js runs the app as a
systemd service, PostgreSQL holds the data, and a reverse proxy (nginx in
the examples) terminates TLS. For a local development setup see
[development.md](development.md).

  1. [Requirements](#1-requirements)
  2. [User and checkout](#2-user-and-checkout)
  3. [Database](#3-database)
  4. [Configuration](#4-configuration)
  5. [Running as a service](#5-running-as-a-service)
  6. [Reverse proxy](#6-reverse-proxy)
  7. [Updating to a new release](#7-updating-to-a-new-release)
  8. [Backup](#8-backup)
  9. [Several instances on one server](#9-several-instances-on-one-server)

## 1. Requirements

| Software | Version |
|---|---|
| Node.js | **22 or newer**, tested with 22.22.0 |
| PostgreSQL | tested with 16.10 (OSMBC uses plain tables with a `jsonb` column, no extensions) |
| git | any |
| Reverse proxy with TLS | e.g. nginx |

Check the Node.js version your distribution ships. Debian 13 (Trixie), for
example, ships Node.js 20, which is too old; install Node.js 22 from
another source such as the [NodeSource](https://github.com/nodesource/distributions)
repository. Install only one Node.js on the server, so the service cannot
start with a different version than the one you installed with.

You also need:

- an OAuth 2 application registered with an OpenStreetMap account
  (OSM → My Settings → OAuth 2 applications), with the redirect URL
  `https://<your host><htmlroot>/auth/openstreetmap_oauth20/callback`.
  Users log in with their OSM account; OSMBC has no passwords of its own.
- optional: an SMTP account for mail notifications, Mattermost/Slack
  incoming webhooks, a DeepL API key for machine translation.

Outgoing connections the server must be allowed to make: openstreetmap.org
(login, user data), your SMTP server, the webhook and translation services
you configure, and arbitrary http(s) URLs (OSMBC checks the links in
articles and loads their titles).

## 2. User and checkout

Any user that can write the paths listed below can run OSMBC, but never
run it as root. A system user of its own (`osmbc` in the examples) is
recommended: it keeps the secrets in the config away from other services
on the server, and a flaw in OSMBC can't reach their files. Install a
tagged release, not a branch:

```sh
sudo adduser --system --group --home /srv/osmbc osmbc
sudo -u osmbc git clone https://github.com/TheFive/osmbc.git /srv/osmbc/app
cd /srv/osmbc/app
sudo -u osmbc git checkout 4.5.1        # the release you want
sudo -u osmbc npm ci --omit=dev
```

`npm ci --omit=dev` installs exactly the versions from `package-lock.json`
without the development tools (mocha, selenium-webdriver, nyc, eslint, …):
about 330 instead of about 800 packages. Its `postinstall` step copies the
browser libraries (Bootstrap, jQuery, …) into `public/`.

At runtime OSMBC reads its config file and writes these files:

| What | Default location | Set with |
|---|---|---|
| config file `config.production.yaml` | app directory | environment variable `OSMBC_CONFIG_DIR` |
| caches: link check, avatars, geocoding (rebuilt when lost) | `<app>/cache/` | config key `cache_directory` |
| public user profiles, written when a user saves their settings | `<app>/public/profile/` | config key `profile_directory` |
| mail log, export log | — | config keys `maillog_directory`, `exportlog_directory` (always set them) |

With the defaults, the app directory must stay writable for the service
user. The application log itself goes to stdout and ends up in the
systemd journal.

### Keeping the app directory read-only (optional)

To keep the code apart from config and data, so that the service user
can't change the code, or to install each release into a new directory:

```text
/srv/osmbc/app/                    code, owned by root or a deploy user, read-only for osmbc
/etc/osmbc/config.production.yaml  OSMBC_CONFIG_DIR=/etc/osmbc, readable by osmbc only
/var/lib/osmbc/config.editorial.yaml  editorial_config (optional, see section 4)
/var/lib/osmbc/cache/              cache_directory, writable by osmbc
/var/lib/osmbc/profile/            profile_directory, writable by osmbc
/var/log/osmbc/                    maillog_directory, exportlog_directory, writable by osmbc
```

Run `git checkout` and `npm ci --omit=dev` as the owner of the code, not
as the service user. OSMBC creates the cache and profile directories if
they don't exist, but it needs write access to their parent directory.
Public profiles stay reachable under `<htmlroot>/profile/` wherever
`profile_directory` points.

## 3. Database

Create a database user and an empty database:

```sh
sudo -u postgres createuser --pwprompt osmbc
sudo -u postgres createdb --owner osmbc osmbc
```

**Moving an existing instance:** restore a dump of the old database
(`pg_dump --format=custom` → `pg_restore --no-owner --role=osmbc`) and
continue with [Configuration](#4-configuration). Copy the public profiles
(`public/profile/` or `profile_directory`) from the old server as well,
or they are missing until each user saves their settings again.

**New instance:** first write the configuration (next section), then
create the tables, views and indexes and the first user. The user name is
your OSM user name; this user gets full access and can give access to
others in the web UI:

```sh
cd /srv/osmbc/app
sudo -u osmbc NODE_ENV=production node import/createdb.js \
  --createTables --createView --createIndex --addUser <OSM user name> --verbose
```

To compare an existing database with the expected structure, run
`import/createdb.js --verbose` without the create options;
`--updateIndex` adds missing indexes.

## 4. Configuration

OSMBC reads `config.<NODE_ENV>.yaml` (or `.yml`/`.json`) from the app
directory, or from the directory in `OSMBC_CONFIG_DIR`; on a server that
is `config.production.yaml`. The log shows which file was read
(`Reading Config from: …`). The file is not in git;
it holds the database password and the other secrets. A missing required
key stops the server at start with a "Missing Value" message that names
the key.

Start from `config.test.yaml` in the repository. [config.md](config.md)
explains every section; [export-profiles.md](export-profiles.md) and
[API.md](API.md) cover `ExportProfiles` and `apiKeys`. On a server, check
at least these keys:

| Key | Set to |
|---|---|
| `serverport` | the local port the proxy forwards to, e.g. `3000` |
| `serverhostname` | `127.0.0.1`, so the app is only reachable through the proxy |
| `serverkey`, `servercert` | leave out: TLS is done by the proxy |
| `url`, `htmlroot` | public base URL (`https://osmbc.example.org`) and path prefix (`""`, or e.g. `/beta`, see [section 9](#9-several-instances-on-one-server)) |
| `postgres` | `server`, `port`, `database`, `username`, `password` |
| `auth.openstreetmap_oauth20` | `clientID`, `clientSecret`, `callbackURL` of your OSM OAuth application |
| `auth.htaccess.enabled` | `false` (basic auth is a test aid) |
| `SessionSecret`, `SessionName` | a long random secret; a name unique per instance on the same host |
| `limitValues.trustProxy` | `1` behind one proxy, see [section 6](#6-reverse-proxy) |
| `maillog_directory`, `exportlog_directory` | absolute paths to the log directory |
| `cache_directory`, `profile_directory` | optional, see [section 2](#keeping-the-app-directory-read-only-optional) |
| `SMTP`, `EmailSender` | your mail server, or `SMTP: {}` to only write the mail log |
| `Transition.enabled` | `true` for the instance that runs the automatic workflow, `false` for any other instance on the same database |

Secrets in the file: `postgres.password`, `SessionSecret`,
`auth.openstreetmap_oauth20.clientSecret`, `apiKeys`, `SMTP`,
`DeeplProConfig.authKey`, the webhook URLs under `slack`/`slacktool`, and
the API keys of optional integrations. Make the file readable for the
service user only (`chmod 600`).

A release can rename or remove config keys; these changes are marked
**BREAKING** in [CHANGELOG.md](../CHANGELOG.md).

### Technical and editorial settings in two files (optional)

The config mixes two kinds of settings: technical ones (server, database,
secrets, mail, directories) that belong to whoever runs the server, and
editorial ones (languages, export profiles, the automatic workflow's
rules, who sees which feature) that belong to the editorial team. They
can live in two files, e.g. when the technical file is generated by a
configuration management tool such as Ansible and would overwrite any
editorial change:

```yaml
# config.production.yaml (technical)
editorial_config: /var/lib/osmbc/config.editorial.yaml
```

OSMBC then reads the second file as well (log: `Reading editorial Config
from: …`) and merges both, sections such as `Transition` key by key. A
value set in both files stops the start with a message that names it, so
every value has exactly one place. A relative path is resolved against
the directory of the technical file.

To split an existing config file:

```sh
node tools/split-config.mjs config.production.yaml \
  /etc/osmbc/config.production.yaml /var/lib/osmbc/config.editorial.yaml
```

The script never overwrites a file, sets `editorial_config` in the
technical file, makes the technical file readable for its owner only and
checks that both files merge back into the original. YAML comments are
not kept. Keys it doesn't know go into the technical file (they may hold
secrets) and are listed — check them, they may be misspelt or no longer
used. Which keys are editorial is listed in
[`util/configSplit.js`](../util/configSplit.js): mainly `languages`,
`ExportProfiles`, `Blog Title For Export`, `Hugo`, `link-attributes`, the
`Transition` rules (`enabled`, `scheduleCron` and `runOnStart` stay
technical), `FirstDraftConfig` except `apiKey`, and the visibility and
welcome settings.

Both files are read only at start: restart OSMBC after a change.

## 5. Running as a service

Example `/etc/systemd/system/osmbc.service`:

```ini
[Unit]
Description=OSMBC
After=network.target postgresql.service

[Service]
User=osmbc
Group=osmbc
WorkingDirectory=/srv/osmbc/app
Environment=NODE_ENV=production
Environment=TZ=Europe/Berlin
# only when the config is not in the app directory:
# Environment=OSMBC_CONFIG_DIR=/etc/osmbc
ExecStart=/usr/bin/node bin/www.js
KillSignal=SIGINT
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now osmbc
journalctl -u osmbc -f
```

Notes:

- Start `bin/www.js` directly. `npm start` always sets
  `NODE_ENV=development`.
- `KillSignal=SIGINT`: OSMBC shuts down cleanly on SIGINT; systemd's default
  SIGTERM ends it without stopping the scheduler first.
- `TZ`: the automatic workflow (`Transition`, e.g. "translate on Thursday
  20:00") runs in the time zone of the process. Set the zone your editors
  plan in; when moving a server, keep the zone of the old one.
- The environment variables `PORT` and `HOSTNAME` override `serverport`
  and `serverhostname`; `ANTHROPIC_API_KEY` is used when the config has no
  key of its own. Don't set them unless you mean to.

At start the log shows `Node: v22.… NPM: …` and
`Server Listening on port:3000`.

## 6. Reverse proxy

Example nginx server block (TLS certificate lines left out):

```nginx
server {
    listen 443 ssl;
    server_name osmbc.example.org;

    # OSMBC accepts JSON bodies up to 10 MB (blog sync API); nginx's default is 1 MB
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set `limitValues.trustProxy: 1` in the config to go with this block.
Without it, OSMBC takes the proxy's address as every user's address (the
rate limit then counts all users together) and `X-Forwarded-Proto` is
ignored, so the session cookie is not marked `Secure`.

## 7. Updating to a new release

```sh
cd /srv/osmbc/app
sudo -u osmbc git fetch --tags
sudo -u osmbc git checkout <new version>
sudo -u osmbc npm ci --omit=dev
sudo systemctl restart osmbc
```

Before the update, check [CHANGELOG.md](../CHANGELOG.md) for config
changes and back up the database. To roll back, check out the previous
tag and repeat the last two steps.

## 8. Backup

| What | Where | Back up? |
|---|---|---|
| Database | PostgreSQL | **yes**, regularly: articles, blogs, users, change history, and the settings edited in the admin pages |
| Editorial config | `editorial_config` file | **yes**, if you split the config |
| Technical config | `config.production.yaml` | **yes**, or keep its source (e.g. the configuration management repository) including the secrets |
| Public profiles | `profile_directory` (default `public/profile/`) | recommended; otherwise they come back only when each user saves their settings |
| Mail log, export log | `maillog_directory`, `exportlog_directory` | optional, for tracing what was sent or exported |
| Cache | `cache_directory` (default `cache/`) | no, rebuilt automatically |
| Code | app directory | no, reinstall the release from git; note which release runs |

Database dump and restore:

```sh
sudo -u postgres pg_dump --format=custom osmbc > osmbc-$(date +%F).dump
# restore into an empty database:
sudo -u postgres pg_restore --no-owner --role=osmbc --dbname=osmbc osmbc-<date>.dump
```

To restore a whole instance, install the same release
([section 2](#2-user-and-checkout)), restore the database, put the config
files and public profiles back, then start the service.

## 9. Several instances on one server

A second instance (e.g. a test version under `/beta`) needs its own
`config.production.yaml` and its own service. It can use its own app
directory, or share the code with the main instance by pointing
`OSMBC_CONFIG_DIR` to a different directory (then both always run the
same release). It also needs:

- its own `serverport`, and `htmlroot: /beta` with the matching `url` and
  `callbackURL` (a second OAuth application in OSM, or a second redirect URL)
- its own `SessionName`
- its own technical config; its `editorial_config` may point to the main
  instance's editorial file, so both use the same languages and export
  settings
- its own database, or, if it shares the database with the main instance,
  `Transition.enabled: false` and no SMTP/webhooks, so automatic actions
  and notifications don't run twice
- a `location /beta/` block in nginx that forwards to its port
