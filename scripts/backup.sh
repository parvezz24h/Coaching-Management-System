#!/usr/bin/env bash
# Usage: scripts/backup.sh [DATABASE_URL]   (defaults to $DATABASE_URL / .env)
# Writes a compressed, restorable dump to backups/. Needs pg_dump >= server version.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
URL="${1:-${DATABASE_URL:?Set DATABASE_URL}}"
URL="${URL%%\?*}" # libpq rejects Prisma's ?schema= parameter

mkdir -p backups
FILE="backups/cms-$(date -u +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$URL"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"
