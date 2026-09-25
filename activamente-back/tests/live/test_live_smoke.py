"""Humo contra el servidor real: `LIVE_API_URL=http://localhost:8420 pytest -m live`.
Comprueba despliegue + DB + seed + CORS reales, no la lógica (eso es la suite)."""

from tests import seed_data


def test_health_hits_real_database(live):
    r = live.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_docs_match_environment(live):
    """Con APP_ENV=dev Swagger está publicado; en staging/prod (SEC-06) no existe."""
    if "docs" in live.get("/").json():
        assert live.get("/docs").status_code == 200
        assert "/api/auth/login" in live.get("/openapi.json").json()["paths"]
    else:
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert live.get(path).status_code == 404, path


def test_seed_users_can_login_and_load_home(live, live_login):
    admin = live_login(email=seed_data.ADMIN_EMAIL, password=seed_data.ADMIN_PASSWORD)
    assert live.get("/api/users?limit=1", headers=admin["headers"]).status_code == 200

    spec = live_login(email=seed_data.SPECIALIST_EMAIL, password=seed_data.SPECIALIST_PASSWORD)
    dash = live.get("/api/specialists/dashboard", headers=spec["headers"])
    assert dash.status_code == 200 and "stats" in dash.json()
    assert live.get("/api/patients/", headers=spec["headers"]).status_code == 200

    pat = live_login(rut=seed_data.PATIENT_PEDRO_RUT, password=seed_data.PATIENT_PASSWORD)
    assert pat["expires_in"] == 12 * 3600
    for path in ("/api/me", "/api/exercises", "/api/appointments/next", "/api/patients/me/sessions"):
        r = live.get(path, headers=pat["headers"])
        assert r.status_code == 200, f"{path}: {r.status_code} {r.text}"


def test_real_server_rejects_anonymous_and_bad_tokens(live):
    assert live.get("/api/me").status_code == 401
    assert live.get("/api/me", headers={"Authorization": "Bearer abc.def.ghi"}).status_code == 401
    assert live.post("/api/auth/login", json={"email": seed_data.ADMIN_EMAIL, "password": "mal"}).status_code == 401


def test_real_cors_preflight(live):
    r = live.options("/api/auth/login", headers={"Origin": "http://localhost:8421", "Access-Control-Request-Method": "POST"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
    assert r.headers.get("access-control-allow-credentials") != "true"


def test_real_server_latency_is_reasonable(live, live_login):
    """Presupuesto generoso (2 s) para detectar una DB caída o un N+1 grave, no para medir rendimiento."""
    spec = live_login(email=seed_data.SPECIALIST_EMAIL, password=seed_data.SPECIALIST_PASSWORD)
    r = live.get("/api/specialists/dashboard", headers=spec["headers"])
    assert r.elapsed.total_seconds() < 2.0
