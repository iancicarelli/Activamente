"""Humo contra el servidor real: `LIVE_API_URL=... scripts/test.sh live` (ver conftest.py).
Comprueba despliegue + DB + proxy + CORS reales, no la lógica (eso es la suite)."""

import uuid

import pytest

# Lo que el inicio de cada rol pide al abrir la app (solo lectura).
HOME_BY_ROLE = {
    "PATIENT": ("/api/me", "/api/me/terms", "/api/exercises", "/api/appointments/next", "/api/patients/me/sessions"),
    "SPECIALIST": ("/api/me", "/api/me/terms", "/api/specialists/dashboard", "/api/patients/"),
    "ADMIN": ("/api/me", "/api/me/terms", "/api/users?limit=1", "/api/admins/deletion-requests?status=PENDING"),
}


def test_health_hits_real_database(live):
    r = live.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
    assert r.elapsed.total_seconds() < 2.0


def test_docs_match_environment(live):
    """Con APP_ENV=dev Swagger está publicado; en staging/prod (SEC-06) no existe."""
    if "docs" in live.get("/").json():
        assert live.get("/docs").status_code == 200
        assert "/api/auth/login" in live.get("/openapi.json").json()["paths"]
    else:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert live.get(path).status_code == 404, path


def test_real_server_rejects_anonymous_and_bad_tokens(live):
    assert live.get("/api/me").status_code == 401
    assert live.get("/api/me", headers={"Authorization": "Bearer abc.def.ghi"}).status_code == 401
    # Cuenta inventada: 401 sin revelar si existe (suma 1 fallo al límite por IP, muy lejos de 50).
    r = live.post("/api/auth/login", json={"email": f"live-{uuid.uuid4().hex[:8]}@example.cl", "password": "mala"})
    assert r.status_code == 401


def test_real_cors_preflight(live):
    r = live.options("/api/auth/login", headers={"Origin": "http://localhost:8421", "Access-Control-Request-Method": "POST"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
    assert r.headers.get("access-control-allow-credentials") != "true"


def test_https_security_headers(live):
    """Detrás de Caddy (deploy/activamente.caddy, SEC-11). En local por HTTP no aplica."""
    if not str(live.base_url).startswith("https://"):
        pytest.skip("servidor sin HTTPS: las cabeceras las pone Caddy en la VPS")
    h = live.get("/health").headers
    assert "max-age=" in h.get("strict-transport-security", "")
    assert h.get("x-content-type-options") == "nosniff"
    assert not h.get("server", "").lower().startswith("caddy")  # no anunciar el software


def test_account_home_loads(live, live_account):
    for path in HOME_BY_ROLE[live_account["role"]]:
        r = live.get(path, headers=live_account["headers"])
        assert r.status_code == 200, f"{path}: {r.status_code} {r.text}"
        assert r.elapsed.total_seconds() < 2.0, f"{path} tardó {r.elapsed.total_seconds():.2f} s"
