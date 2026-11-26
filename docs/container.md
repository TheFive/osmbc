# Running OSMBC in containers

OSMBC ships a `Containerfile`. This guide runs it rootless with Podman
and systemd ([Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)),
with its own PostgreSQL container and a daily database dump. The example
units are in [`container/`](container/); copy and adapt them. For an
installation without containers see [install.md](install.md); the
configuration keys are the same ([config.md](config.md)).

  1. [Overview](#1-overview)
  2. [Requirements](#2-requirements)
  3. [Building the image](#3-building-the-image)
  4. [Folders](#4-folders)
  5. [Configuration](#5-configuration)
  6. [Starting](#6-starting)
  7. [New database or restoring a dump](#7-new-database-or-restoring-a-dump)
  8. [Backup](#8-backup)
  9. [Updating](#9-updating)
  10. [Admin tools](#10-admin-tools)

## 1. Overview

```text
reverse proxy (host, TLS) ──> 127.0.0.1:3000 ──> osmbc ──┐   network "osmbc"
                                                         └──> osmbc-db (PostgreSQL)
osmbc-backup.timer (daily) ──> osmbc-backup ──> pg_dump ──> backup/
```

| Unit (file in [`container/`](container/)) | What it is |
|---|---|
| `osmbc.network` | private network; the database is reachable only from it |
| `osmbc-db.container` | PostgreSQL, data in `db/`, no published port |
| `osmbc.container` | OSMBC, published on `127.0.0.1` only |
| `osmbc-backup.container` | one-off job: `pg_dump` into `backup/` |
| `osmbc-backup.timer` | starts the backup job daily (a plain systemd timer) |

Logs go to stdout/stderr, so to the journal: `journalctl --user -u osmbc`.
OSMBC has no health endpoint; `GET /login` answers 200 without a session.

## 2. Requirements

| Software | Version |
|---|---|
| Podman | **5.0 or newer** (`Notify=healthy` in `osmbc-db.container`), tested with 6.2.1 (Fedora CoreOS, SELinux enforcing) |
| PostgreSQL image | `postgres:18`, tested with 18.7 |
| Node.js | comes with the image (`node:22-bookworm-slim`) |
| Reverse proxy with TLS | on the host, as in [install.md](install.md#6-reverse-proxy), forwarding to `127.0.0.1:3000` |

The units run as an ordinary user (rootless). So they keep running
without a login session and start at boot:

```sh
sudo loginctl enable-linger <user>
```

Rootless Quadlet needs cgroup v2 (default on current distributions).

## 3. Building the image

Build from a release tag; the image needs no registry:

```sh
git clone https://github.com/TheFive/osmbc.git && cd osmbc
git checkout <version>
podman build -t localhost/osmbc:<version> .
```

On a machine with another CPU architecture than the server (e.g. Apple
Silicon), add `--platform linux/amd64`. Instead of building by hand,
Podman can build it itself with a `.build` unit (`ImageTag=`,
`SetWorkingDirectory=`); then `Image=osmbc.build` in `osmbc.container`.

What is in the image: the app in `/app` (owned by root, read-only for the
service), only the runtime packages (`npm ci --omit=dev`), `git` (only
used by the optional [wiki](wiki.md)). No `config.*` file is copied into
it (`.dockerignore`). It runs as user `node` (uid 1000) with
`NODE_ENV=production` and `OSMBC_CONFIG_DIR=/config`. A stop signal
(SIGTERM or SIGINT) stops the scheduler and the server cleanly.

## 4. Folders

All data lives below one folder of the service user, in the examples
`~/osmbc` (`%h/osmbc` in the units). Create them before the first start:

```sh
mkdir -p ~/osmbc/config ~/osmbc/data ~/osmbc/db ~/osmbc/backup
```

| Folder | Mounted at | Content | Back up? |
|---|---|---|---|
| `config/` | `/config` (read-only) | `config.production.yaml`, optional editorial file | **yes** (holds secrets, keep it private) |
| `data/` | `/data` | `cache/` (rebuilt automatically), `profile/` (public profile pages), `log/` (mail and export log) | `profile/` optional (rebuilt when users save their settings), rest no |
| `db/` | `/var/lib/postgresql` in `osmbc-db` | PostgreSQL's files | **no**: copying them while the database runs gives a broken copy; back up the dumps instead |
| `backup/` | `/backup` in `osmbc-backup` | daily dumps | **yes** |

So a server backup only needs `config/` and `backup/`. OSMBC creates the
subfolders of `data/` itself at start.

Ownership: `osmbc.container` and `osmbc-backup.container` map the service
user to the image's user (`UserNS=keep-id:uid=…`), so files in `data/` and
`backup/` belong to the service user. `db/` is handed to the database
container with `:U`; PostgreSQL's files inside belong to a sub-uid, look
into them with `podman unshare ls -R ~/osmbc/db`.

SELinux: the units label the folders (`z` for `config/` and `data/`,
shared with the one-off admin containers; `Z` for `db/` and `backup/`,
private to one container). Without these, PostgreSQL fails with
`mkdir: cannot create directory '/var/lib/postgresql/18': Permission
denied`. On systems without SELinux (e.g. Debian with AppArmor) the
options do nothing.

## 5. Configuration

`config/config.production.yaml` is a normal OSMBC config
([install.md](install.md#4-configuration), [config.md](config.md)); an
editorial file can sit next to it (`editorial_config:
config.editorial.yaml`, relative to `/config`). Inside the container
these keys differ from an installation on the host:

```yaml
serverport: 3000
# all interfaces *inside* the container; the unit publishes the port on
# 127.0.0.1 of the host only. 127.0.0.1 here would make OSMBC unreachable.
serverhostname: 0.0.0.0

postgres:
  server: osmbc-db        # container name on the network
  port: "5432"
  database: osmbc
  username: osmbc
  # no password: it comes from the secret as POSTGRES_PASSWORD

cache_directory: /data/cache
profile_directory: /data/profile
maillog_directory: /data/log
exportlog_directory: /data/log
```

Leave out `serverkey`/`servercert` (TLS is done by the reverse proxy).
Behind one reverse proxy set `limitValues.trustProxy: 1`
([install.md](install.md#6-reverse-proxy)).

The time zone of the automatic workflow (`Transition`, e.g. "translate on
Thursday 20:00") is the process's: `Environment=TZ=…` in
`osmbc.container`. When moving from another server, keep its zone.

The database password is a Podman secret, used by `osmbc-db` (to set it),
`osmbc` and `osmbc-backup`:

```sh
openssl rand -base64 24 | tr -d '\n' | podman secret create osmbc-db-password -
```

`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER` and `POSTGRES_PASSWORD`
override the matching `postgres` keys; `OSMBC_HOSTNAME` and `PORT`
override `serverhostname` and `serverport`.

## 6. Starting

```sh
cp docs/container/*.network docs/container/*.container ~/.config/containers/systemd/
mkdir -p ~/.config/systemd/user
cp docs/container/osmbc-backup.timer ~/.config/systemd/user/
# adjust Image=, TZ=, PublishPort= and paths, then:
systemctl --user daemon-reload
systemctl --user start osmbc-db       # first start initialises the database
```

Quadlet generates the services from the files; they can't be enabled
with `systemctl enable`, `[Install] WantedBy=default.target` in each file
starts them at boot. After the database is set up (next section):

```sh
systemctl --user start osmbc
systemctl --user enable --now osmbc-backup.timer
journalctl --user -u osmbc -f
```

The log shows `Reading Config from: /config/config.production.yaml`,
`Node: v22.…` and `Server Listening on port:3000 hostname: 0.0.0.0`.
`osmbc` starts only once the database answers (`Notify=healthy`), also at
boot.

Check that the port is published on the loopback address only:
`ss -ltn | grep 3000` must show `127.0.0.1:3000`, not `*:3000`. (Inside a
`podman machine` VM on macOS or Windows it shows `*:3000`, because Podman
binds all addresses there to forward the port to the host.)

## 7. New database or restoring a dump

On its first start with an empty `db/` folder, `osmbc-db` creates the user
and an empty database `osmbc`. OSMBC does not create its tables at start.

The admin commands below run OSMBC's tools in a one-off container with
the same network, config and secret as the service:

```sh
osmbc-tool() {
  podman run --rm --network osmbc --userns keep-id:uid=1000,gid=1000 \
    --secret osmbc-db-password,type=env,target=POSTGRES_PASSWORD \
    -v ~/osmbc/config:/config:ro,z localhost/osmbc:<version> "$@"
}
```

**New instance.** Create the tables and the first user with full access
(your OSM user name; that user can give access to others in the web UI):

```sh
osmbc-tool node import/createdb.js --createTables --createIndex --addUser <OSM user name>
```

**Restore a dump** (moving from another server, or from `backup/`). Stop
OSMBC, keep the database running, and replace the database:

```sh
systemctl --user stop osmbc
podman exec osmbc-db dropdb -U osmbc osmbc
podman exec osmbc-db createdb -U osmbc osmbc

# custom format (-Fc, the files in backup/):
podman exec -i osmbc-db pg_restore -U osmbc -d osmbc --no-owner --role=osmbc < osmbc-<date>.dump
# or a plain SQL dump (.sql / .sql.gz):
gunzip -c osmbc.sql.gz | podman exec -i osmbc-db psql -q -U osmbc -d osmbc
```

`--no-owner --role=osmbc` gives the tables to `osmbc` even if the dump
names another owner. A plain SQL dump can't skip the owner: its `ALTER
TABLE … OWNER TO <old user>` lines fail with `role "…" does not exist`
and the tables stay with `osmbc`, which is what you want. With a dump
from an older PostgreSQL, `SET transaction_timeout` or similar errors are
harmless too.

Then compare the database with what this OSMBC version expects, and let
it add what's missing (databases from old versions can lack a primary key
or a table that came later):

```sh
osmbc-tool node import/createdb.js --verbose       # lists missing parts
osmbc-tool node import/createdb.js --updateIndex   # adds them, keeps the rest
systemctl --user start osmbc
```

Users stay logged in across a move when `SessionName` and `SessionSecret`
are the old server's (sessions are in the database). The public profile
pages are files: copy `public/profile` of the old installation (or its
`profile_directory`) into `data/profile`.

A test instance on a copy of production data must stay passive: set
`Transition.enabled: false` and leave `SMTP`, `slack` and `slacktool`
empty, else it translates and closes blogs and sends mails a second time.

Tested with a production dump (plain SQL from PostgreSQL 16, pg_dump 17)
restored into `postgres:18`, with Docker and with these units under
Podman 6.2.1.

## 8. Backup

`osmbc-backup.timer` starts `osmbc-backup.service` daily at 02:30
(`Persistent=true` catches up after downtime). The job connects to
`osmbc-db` over the network and writes
`backup/osmbc-<YYYY-MM-DD_HHMM>.dump` (`pg_dump -Fc`, compressed; the time
in the zone of `TZ=` in the unit), first
under a `.part` name, so a failed dump never looks like a good one. Dumps
older than 14 days are deleted. It uses the same PostgreSQL image as the
database, because `pg_dump` must not be older than the server.

```sh
systemctl --user start osmbc-backup     # run once now
journalctl --user -u osmbc-backup
pg_restore --list ~/osmbc/backup/<file>.dump | head   # check a dump
```

The dump contains everything in the database, including the sessions
table and the users' settings; keep `backup/` as private as `config/`.
To restore one, see [section 7](#7-new-database-or-restoring-a-dump).

## 9. Updating

**OSMBC.** Build the new tag (section 3), change the tag in `Image=` of
`osmbc.container`, then:

```sh
systemctl --user daemon-reload
systemctl --user restart osmbc
osmbc-tool node import/createdb.js --verbose   # if the release notes mention new indexes
```

The old image stays until removed (`podman image rm`), so going back is
changing `Image=` again — as long as the new version didn't change data.

**PostgreSQL minor versions** (18.x): pull the image again and restart
`osmbc-db` (`podman pull docker.io/library/postgres:18`).

**A new PostgreSQL major version** can't read the old data folder. Dump
with the old version, start the new one with an empty folder, restore:

1. `systemctl --user stop osmbc`, run the backup job once.
2. `systemctl --user stop osmbc-db`, move `db/` aside (e.g. `db-18/`),
   create an empty `db/`.
3. Change the image tag in `osmbc-db.container` **and**
   `osmbc-backup.container`, `daemon-reload`, start `osmbc-db`.
4. Restore the dump (section 7), start `osmbc`, check, then delete the
   old folder.

## 10. Admin tools

The tools in `import/` and `tools/` run with `osmbc-tool` from section 7,
or inside the running container:

```sh
podman exec osmbc node import/createdb.js --verbose
podman exec -it osmbc-db psql -U osmbc osmbc
```
