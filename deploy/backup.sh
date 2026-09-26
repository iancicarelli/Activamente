#!/usr/bin/env bash
# Backup de la base de ActivaMente (DEP-05). Pensado para cron en la VPS, uno por ambiente:
#   0 3 * * *  /srv/activamente/prod/deploy/backup.sh >> /var/log/activamente-backup.log 2>&1
#
# 1. pg_dump (formato custom) desde el contenedor `db` del ambiente de esta carpeta.
# 2. RESTAURACIÓN DE PRUEBA en cada corrida: restaura el dump en una base temporal dentro del
#    mismo Postgres, cuenta filas y la borra. Un backup que no se probó no es un backup.
# 3. Cifra con la clave PÚBLICA gpg de BACKUP_GPG_RECIPIENT (son datos de salud): en la VPS solo
#    está la pública, así que quien robe el archivo no puede leerlo. La privada la guarda el dueño.
# 4. Copia fuera de la VPS con rclone si BACKUP_RCLONE_REMOTE está definido.
# 5. Borra los backups locales con más de BACKUP_KEEP_DAYS días.
#
# Variables (en el .env de la raíz o en el entorno):
#   BACKUP_GPG_RECIPIENT  id/email de la clave pública gpg (obligatoria con APP_ENV=prod)
#   BACKUP_RCLONE_REMOTE  destino rclone, p. ej. "b2:activamente-backups/prod" (opcional)
#   BACKUP_DIR            carpeta local (default: <repo>/backups)
#   BACKUP_KEEP_DAYS      retención local (default: 14)
#   COMPOSE               comando compose (default: "docker compose -f docker-compose.yml";
#                         en local sin la red proxy: COMPOSE="docker compose")
set -euo pipefail
umask 077  # los dumps sin cifrar nunca quedan legibles para otros usuarios de la VPS

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Lee KEY del entorno o, si no está, del .env (sin `source`: las claves pueden tener `$`).
envval() {
  local v="${!1:-}"
  if [ -z "$v" ] && [ -f .env ]; then
    v="$(grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^"(.*)"$/\1/')"
  fi
  printf '%s' "$v"
}
log() { echo "[$(date '+%F %T')] $*"; }

read -r -a COMPOSE_CMD <<< "${COMPOSE:-docker compose -f docker-compose.yml}"
APP_ENV="$(envval APP_ENV)"; APP_ENV="${APP_ENV:-prod}"
PROJECT="$(envval COMPOSE_PROJECT_NAME)"; PROJECT="${PROJECT:-$(basename "$ROOT" | tr '[:upper:]' '[:lower:]')}"
RECIPIENT="$(envval BACKUP_GPG_RECIPIENT)"
REMOTE="$(envval BACKUP_RCLONE_REMOTE)"
DIR="$(envval BACKUP_DIR)"; DIR="${DIR:-$ROOT/backups}"
KEEP_DAYS="$(envval BACKUP_KEEP_DAYS)"; KEEP_DAYS="${KEEP_DAYS:-14}"

if [ "$APP_ENV" = "prod" ] && [ -z "$RECIPIENT" ]; then
  log "ERROR: APP_ENV=prod sin BACKUP_GPG_RECIPIENT. No se guardan datos de salud sin cifrar."
  exit 1
fi

mkdir -p "$DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="$DIR/${PROJECT}_${STAMP}.dump"
trap 'rm -f "$DUMP"' EXIT  # si algo falla, no queda un dump a medias ni un plano sin cifrar

db() { "${COMPOSE_CMD[@]}" exec -T db "$@"; }

log "pg_dump ($PROJECT)"
db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DUMP"
[ -s "$DUMP" ] || { log "ERROR: dump vacío"; exit 1; }

log "restauración de prueba"
CHECK_DB="restore_check_${STAMP//-/_}"
db sh -c "psql -q -U \"\$POSTGRES_USER\" -d postgres -c 'CREATE DATABASE $CHECK_DB'"
if ! db sh -c "pg_restore -U \"\$POSTGRES_USER\" -d $CHECK_DB --no-owner --exit-on-error" < "$DUMP"; then
  db sh -c "psql -q -U \"\$POSTGRES_USER\" -d postgres -c 'DROP DATABASE IF EXISTS $CHECK_DB'"
  log "ERROR: el dump no se pudo restaurar"
  exit 1
fi
COUNTS="$(db sh -c "psql -At -U \"\$POSTGRES_USER\" -d $CHECK_DB -c \"SELECT 'usuarios=' || (SELECT count(*) FROM users) || ' ejercicios=' || (SELECT count(*) FROM exercises) || ' sesiones=' || (SELECT count(*) FROM sessions)\"")"
db sh -c "psql -q -U \"\$POSTGRES_USER\" -d postgres -c 'DROP DATABASE $CHECK_DB'"
case "$COUNTS" in *"ejercicios=0"*|"") log "ERROR: restauración sin catálogo ($COUNTS)"; exit 1 ;; esac
log "restauración OK: $COUNTS"

OUT="$DUMP"
if [ -n "$RECIPIENT" ]; then
  gpg --batch --yes --trust-model always --recipient "$RECIPIENT" --output "$DUMP.gpg" --encrypt "$DUMP"
  rm -f "$DUMP"
  OUT="$DUMP.gpg"
  log "cifrado para $RECIPIENT"
else
  log "AVISO: sin BACKUP_GPG_RECIPIENT el backup queda SIN cifrar (solo aceptable en local)"
fi
trap - EXIT

if [ -n "$REMOTE" ]; then
  rclone copy "$OUT" "$REMOTE" --no-traverse
  log "copiado a $REMOTE"
else
  log "AVISO: sin BACKUP_RCLONE_REMOTE la copia es solo local: no protege si se pierde la VPS"
fi

find "$DIR" -maxdepth 1 -name "${PROJECT}_*.dump*" -type f -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/  borrado por antigüedad: /'
log "listo: $OUT ($(du -h "$OUT" | cut -f1))"
