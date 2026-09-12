#!/bin/bash

# Decision helper: "can I restart the OSMBC server right now?"
#
# Shows three things:
#   1. Editors currently online (session lastAccess in the last 10 minutes)
#   2. What Postgres is doing *right now* for the osmbc DB (pg_stat_activity) -
#      this is where a running API call shows up: a Hugo / blogPreviewDownload
#      export, a closedSince bulk export, or a blogSync read/apply batch all
#      appear here as an active backend with a long-running SELECT/UPDATE.
#   3. Write activity in the changes-log in the last 10 minutes, grouped by
#      user - flags an in-progress editor edit or an automated batch
#      (wp-backport / apikey:* / a data-admin name). Read-only exports do NOT
#      show here, so section 2 is the one that matters for Hugo pulls.
#
# DB connection is read from the postgres: block of a config file
# (override with $1 or $OSMBC_CONFIG; otherwise config.production.yaml if
# present - the production/beta server case - else config.development.yaml
# for local dev).

set -e
cd "$(dirname "$0")"

if [ -n "${1:-}" ]; then
  CONFIG="$1"
elif [ -n "${OSMBC_CONFIG:-}" ]; then
  CONFIG="$OSMBC_CONFIG"
elif [ -f config.production.yaml ]; then
  CONFIG="config.production.yaml"
else
  CONFIG="config.development.yaml"
fi
[ -f "$CONFIG" ] || { echo "config not found: $CONFIG" >&2; exit 1; }

# Parse the top-level postgres: block (2-space-indented key: value pairs).
yaml_pg() { sed -n '/^postgres:/,/^[^[:space:]]/p' "$CONFIG" | sed -n "s/^  $1: *//p" | tr -d "\"'" | head -1; }
export PGHOST="$(yaml_pg server)"
export PGPORT="$(yaml_pg port)"
export PGUSER="$(yaml_pg username)"
export PGPASSWORD="$(yaml_pg password)"
DB="$(yaml_pg database)"
PSQL=(psql -d "$DB")

echo "config: $CONFIG   db: $DB @ $PGHOST:$PGPORT"

echo "=============================================================="
echo " 1) Editors online (lastAccess < 10 min)"
echo "=============================================================="
"${PSQL[@]}" -c "
  select data->>'OSMUser' as \"user\",
         (data->>'lastAccess')::timestamptz as lastaccess
  from usert
  where (data->>'lastAccess')::timestamptz > current_timestamp - interval '10 minutes'
  order by lastaccess desc;"

echo "=============================================================="
echo " 2) Postgres activity right now (osmbc DB)"
echo "    active backend + long query_age = an API call / export is"
echo "    in flight; wait before restarting."
echo "=============================================================="
"${PSQL[@]}" -c "
  select pid,
         state,
         coalesce(date_trunc('second', now() - query_start), interval '0') as query_age,
         coalesce(date_trunc('second', now() - xact_start),  interval '0') as xact_age,
         wait_event_type,
         left(regexp_replace(query, '\s+', ' ', 'g'), 100) as query
  from pg_stat_activity
  where datname = '$DB'
    and pid <> pg_backend_pid()
    and state is distinct from 'idle'
  order by query_start;"

echo "--- idle-in-transaction backends (half-finished write, also risky) ---"
"${PSQL[@]}" -tc "
  select count(*)
  from pg_stat_activity
  where datname = '$DB'
    and state = 'idle in transaction';"

echo "=============================================================="
echo " 3) changes-log writes in the last 10 min (by user)"
echo "=============================================================="
# Compare as text against an ISO/UTC cutoff so the changes_timestamp_idx
# (btree on data->>'timestamp', a text expression) is used - the changes
# table is large and a ::timestamptz cast in the WHERE would full-scan it.
CUTOFF=$(date -u -v-10M +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S)
"${PSQL[@]}" -c "
  select data->>'user' as \"user\",
         data->>'table' as \"table\",
         count(*) as changes,
         max(data->>'timestamp') as last_write
  from changes
  where data->>'timestamp' > '$CUTOFF'
  group by 1, 2
  order by last_write desc;"
