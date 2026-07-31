#!/usr/bin/env bash
# Refreshes osmbcbeta's content tables (blog, article, changes) from osmbc,
# then applies the wp-reconcile backport (backport.sql) to osmbcbeta.
#
# Intended to run on the production server, by a human, repeatedly (each run
# starts from a clean slate: osmbcbeta's blog/article/changes are fully wiped
# and reloaded from the current osmbc). Never touches osmbc itself except to
# read from it (pg_dump). Does NOT require CREATEDB/superuser - only DML
# rights on the existing osmbcbeta tables (verified: role "pm2" owns them).
#
# NOT run automatically by this tool - review before executing.
#
# Usage:
#   PGHOST=localhost PGUSER=pm2 SOURCE_DB=osmbc TARGET_DB=osmbcbeta ./migrate-to-beta.sh
#
# Env vars (all optional, defaults shown):
#   PGHOST     (default: localhost)
#   PGPORT     (default: 5432)
#   PGUSER     (default: pm2)
#   SOURCE_DB  (default: osmbc)
#   TARGET_DB  (default: osmbcbeta)
#   BACKPORT_SQL (default: ./output/backport.sql, relative to this script)

set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-pm2}"
SOURCE_DB="${SOURCE_DB:-osmbc}"
TARGET_DB="${TARGET_DB:-osmbcbeta}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKPORT_SQL="${BACKPORT_SQL:-$SCRIPT_DIR/output/backport.sql}"

PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1)

echo "=== wp-reconcile: refresh $TARGET_DB from $SOURCE_DB, then apply backport ==="
echo "Host: $PGHOST:$PGPORT  User: $PGUSER"
echo "Source: $SOURCE_DB  Target: $TARGET_DB"
echo "Backport script: $BACKPORT_SQL"
echo

if [ ! -f "$BACKPORT_SQL" ]; then
  echo "ERROR: backport SQL not found at $BACKPORT_SQL (run generateBackport.js first)" >&2
  exit 1
fi

read -r -p "This will PERMANENTLY WIPE blog/article/changes in '$TARGET_DB' and reload them from '$SOURCE_DB'. Continue? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 1
fi

echo
echo "--- Step 1/2: refreshing $TARGET_DB content tables from $SOURCE_DB ---"
"${PSQL[@]}" -d "$TARGET_DB" -c "TRUNCATE blog, article, changes RESTART IDENTITY;"
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$SOURCE_DB" \
  --data-only --table=blog --table=article --table=changes \
  | "${PSQL[@]}" -d "$TARGET_DB"

echo
echo "--- Step 2/2: applying backport to $TARGET_DB ---"
"${PSQL[@]}" -d "$TARGET_DB" -f "$BACKPORT_SQL"

echo
echo "Done. $TARGET_DB now mirrors $SOURCE_DB with the backport changes applied."
echo "Generate the migration log with: node wp-reconcile/backport/generateMigrationLog.js"
