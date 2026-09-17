#!/usr/bin/env bash
# Baja los logs de ejercicio del dispositivo (build debug) a validation/__logs__/.
# Uso: scripts/pull-logs.sh [--clean]   (--clean borra los logs del teléfono después de bajarlos)
set -euo pipefail
PKG=com.activamente.app
DIR=files/exercise-logs
OUT="$(cd "$(dirname "$0")/.." && pwd)/validation/__logs__"
mkdir -p "$OUT"
files=$(adb shell run-as "$PKG" ls "$DIR" 2>/dev/null | tr -d '\r' || true)
if [ -z "$files" ]; then echo "No hay logs en el dispositivo ($DIR)."; exit 0; fi
for f in $files; do
  adb exec-out run-as "$PKG" cat "$DIR/$f" > "$OUT/$f"
  echo "↓ $f ($(du -h "$OUT/$f" | cut -f1))"
done
if [ "${1:-}" = "--clean" ]; then adb shell run-as "$PKG" rm -rf "$DIR"; echo "Logs borrados del dispositivo."; fi
echo "Guardados en $OUT"
