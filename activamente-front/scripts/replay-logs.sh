#!/usr/bin/env bash
# Reproduce los logs de validation/__logs__ con los validadores ACTUALES y muestra
# cuántas reps cuenta cada uno, cuándo y hasta dónde llegó la métrica (ver
# __tests__/validation/replayLogs.test.ts).
#
# Uso: scripts/replay-logs.sh                       # todos los logs
#      scripts/replay-logs.sh <archivo> <t0> <t1>   # además, traza frame a frame esa ventana (ms)
cd "$(dirname "$0")/.." || exit 1
if [ -n "${1:-}" ]; then export REPLAY_TRACE="$1,${2:-0},${3:-999999999}"; fi
REPLAY_LOGS=1 npx jest __tests__/validation/replayLogs.test.ts --silent=false 2>&1 \
  | grep -vE "^\s*at |console\.log|^\s*$|PASS|Test Suites|Snapshots|Time:|Ran all" | sed 's/^      //'
