#!/usr/bin/env bash
# Restaura un backup de deploy/backup.sh sobre la base del ambiente de esta carpeta (DEP-05).
# DESTRUCTIVO: reemplaza la base actual. Antes guarda un dump de seguridad de lo que había.
#
#   deploy/restore.sh <archivo.dump | archivo.dump.gpg> --borrar-base-actual
#
# Un .gpg necesita la clave PRIVADA en el keyring de quien lo corre (normalmente no está en la
# VPS: importarla solo para restaurar, o descifrar en el PC con `gpg -d` y subir el .dump).
# Mismas variables COMPOSE / BACKUP_DIR / BACKUP_GPG_RECIPIENT que backup.sh (con recipient, el
# dump de seguridad también se guarda cifrado).
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
log() { echo "[$(date '+%F %T')] $*"; }
envval() {  # igual que en backup.sh
  local v="${!1:-}"
  if [ -z "$v" ] && [ -f .env ]; then
    v="$(grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^"(.*)"$/\1/')"
  fi
  printf '%s' "$v"
}

FILE="${1:-}"
if [ -z "$FILE" ] || [ "${2:-}" != "--borrar-base-actual" ]; then
  echo "Uso: $0 <archivo.dump|archivo.dump.gpg> --borrar-base-actual" >&2
  exit 2
fi
[ -f "$FILE" ] || { echo "No existe: $FILE" >&2; exit 2; }
FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"

read -r -a COMPOSE_CMD <<< "${COMPOSE:-docker compose -f docker-compose.yml}"
BACKUP_DIR="$(envval BACKUP_DIR)"; BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
RECIPIENT="$(envval BACKUP_GPG_RECIPIENT)"
db() { "${COMPOSE_CMD[@]}" exec -T db "$@"; }

PLAIN="$FILE"
if [[ "$FILE" == *.gpg ]]; then
  PLAIN="$(mktemp --suffix=.dump)"
  trap 'rm -f "$PLAIN"' EXIT
  gpg --batch --yes --output "$PLAIN" --decrypt "$FILE"
fi

mkdir -p "$BACKUP_DIR"
SAFETY="$BACKUP_DIR/antes-de-restaurar_$(date +%Y%m%d-%H%M%S).dump"
db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$SAFETY"
if [ -n "$RECIPIENT" ]; then
  gpg --batch --yes --trust-model always --recipient "$RECIPIENT" --output "$SAFETY.gpg" --encrypt "$SAFETY"
  rm -f "$SAFETY"
  SAFETY="$SAFETY.gpg"
fi
log "dump de seguridad de la base actual → $SAFETY"

log "deteniendo backend"
"${COMPOSE_CMD[@]}" stop backend

log "recreando la base y restaurando $(basename "$FILE")"
db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE \"$POSTGRES_DB\" WITH (FORCE)" -c "CREATE DATABASE \"$POSTGRES_DB\""'
db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < "$PLAIN"

log "levantando backend"
"${COMPOSE_CMD[@]}" start backend
log "listo: $(db sh -c "psql -At -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"SELECT 'usuarios=' || count(*) FROM users\"")"
