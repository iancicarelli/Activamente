#!/usr/bin/env bash
# Stack de pruebas del backend. Uso: scripts/test.sh <capa> [args extra de pytest]
#
#   smoke        humo (~2 s): arranca, responde, cada rol entra
#   unit         sin DB: core, schemas, helpers
#   integration  endpoint por endpoint contra Postgres (tests/test_*.py)
#   e2e          flujos completos por rol con login real
#   security     JWT, IDOR, inyección, mass assignment, hardening
#   live         contra un servidor real: LIVE_API_URL=http://localhost:8420 scripts/test.sh live
#   audit        bandit (código) + pip-audit (dependencias Python) + npm audit (frontend, prod)
#   all          smoke → unit → integration → e2e → security, con cobertura
#   lint         ruff check + ruff format --check
#
# Requiere `docker compose up -d db` (Postgres en 55432) salvo unit/audit/lint.
set -euo pipefail
cd "$(dirname "$0")/.."
layer="${1:-all}"; shift || true

case "$layer" in
  smoke|unit|integration|e2e|security) exec python3 -m pytest -m "$layer" "$@" ;;
  live)
    : "${LIVE_API_URL:?define LIVE_API_URL, ej. http://localhost:8420}"
    exec python3 -m pytest -m live tests/live "$@" ;;
  audit)
    echo "== bandit (código) =="; bandit -q -r app -f txt || true
    echo "== pip-audit (requirements.txt) =="; pip-audit -r requirements.txt --disable-pip --no-deps --desc off || true
    echo "== npm audit (frontend, solo prod) =="; (cd ../activamente-front && npm audit --omit=dev || true) ;;
  all)
    python3 -m pytest -m "smoke" -q "$@"
    python3 -m pytest -m "unit" -q "$@"
    python3 -m pytest -m "integration" -q "$@"
    python3 -m pytest -m "e2e" -q "$@"
    python3 -m pytest -m "security" -q "$@"
    echo "== cobertura (todo junto) =="; python3 -m pytest -q --cov=app --cov-report=term-missing:skip-covered "$@" | tail -25 ;;
  lint) ruff check app tests && ruff format --check app tests ;;
  *) echo "capa desconocida: $layer (smoke|unit|integration|e2e|security|live|audit|all|lint)"; exit 2 ;;
esac
