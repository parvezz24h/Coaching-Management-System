#!/usr/bin/env bash
# Usage: scripts/verify-backup.sh <backup.dump> [DATABASE_URL]
# Proves a backup is restorable: restores it into a throwaway database and
# compares row counts for every table against the source database.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
FILE="${1:?Usage: verify-backup.sh <backup.dump> [DATABASE_URL]}"
SRC="${2:-${DATABASE_URL:?Set DATABASE_URL}}"
SRC="${SRC%%\?*}"
TMP_DB="cms_restore_check_$(date +%s)"
ADMIN="${SRC%/*}/postgres"
TMP_URL="${SRC%/*}/$TMP_DB"

psql "$ADMIN" -qc "CREATE DATABASE \"$TMP_DB\""
trap 'psql "$ADMIN" -qc "DROP DATABASE IF EXISTS \"$TMP_DB\""' EXIT
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$TMP_URL" "$FILE"

COUNT_SQL="SELECT string_agg(format('%s=%s', table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text), ' ' ORDER BY table_name) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
A=$(psql "$SRC" -tAc "$COUNT_SQL")
B=$(psql "$TMP_URL" -tAc "$COUNT_SQL")
if [ "$A" = "$B" ]; then
  echo "OK: backup restores cleanly and every table's row count matches."
  echo "$B" | tr ' ' '\n' | sed 's/^/  /'
else
  echo "MISMATCH between source and restored copy:" >&2
  diff <(echo "$A" | tr ' ' '\n') <(echo "$B" | tr ' ' '\n') >&2 || true
  exit 1
fi
