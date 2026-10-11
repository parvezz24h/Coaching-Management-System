#!/usr/bin/env bash
# Usage: scripts/restore.sh <backup.dump> <TARGET_DATABASE_URL> [--force]
# Restores a dump made by backup.sh. Refuses to overwrite a database that
# already has data unless --force is given.
set -euo pipefail
FILE="${1:?Usage: restore.sh <backup.dump> <TARGET_DATABASE_URL> [--force]}"
URL="${2:?Usage: restore.sh <backup.dump> <TARGET_DATABASE_URL> [--force]}"
URL="${URL%%\?*}"
[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }

HAS_DATA=$(psql "$URL" -tAc "SELECT to_regclass('public.\"Student\"') IS NOT NULL AND EXISTS (SELECT 1 FROM \"Student\")" 2>/dev/null || echo f)
if [ "$HAS_DATA" = "t" ] && [ "${3:-}" != "--force" ]; then
  echo "Target database already contains students. Re-run with --force to replace it." >&2
  exit 1
fi
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname="$URL" "$FILE"
echo "Restored $FILE"
