"""Capa `live`: contra un servidor REAL (Docker local, staging o producción). Sin LIVE_API_URL
toda la carpeta se salta. Solo lectura: no crea ni modifica datos.

NO depende del seed (producción no lo tiene):
  - sin credenciales, prueba lo público (health, Swagger según APP_ENV, rechazo de anónimos, CORS
    y, con HTTPS, las cabeceras de seguridad de Caddy);
  - con LIVE_EMAIL (o LIVE_RUT) + LIVE_PASSWORD de una cuenta real que YA aceptó los términos
    (p. ej. la cuenta de prueba del revisor de Google), prueba además el inicio de ese rol.

  LIVE_API_URL=https://api-dev.DOMINIO LIVE_EMAIL=... LIVE_PASSWORD=... scripts/test.sh live
  LIVE_API_URL=http://localhost:8420 LIVE_EMAIL=admin@activamente.cl LIVE_PASSWORD=Admin1234! scripts/test.sh live
"""

import os

import httpx
import pytest

LIVE_API_URL = os.getenv("LIVE_API_URL")
LIVE_EMAIL = os.getenv("LIVE_EMAIL")
LIVE_RUT = os.getenv("LIVE_RUT")
LIVE_PASSWORD = os.getenv("LIVE_PASSWORD")


def pytest_collection_modifyitems(config, items):
    if LIVE_API_URL:
        return
    skip = pytest.mark.skip(reason="sin LIVE_API_URL (ej. LIVE_API_URL=http://localhost:8420)")
    for item in items:
        if "live" in str(item.fspath):
            item.add_marker(skip)


@pytest.fixture(scope="session")
def live():
    with httpx.Client(base_url=LIVE_API_URL, timeout=10.0) as c:
        yield c


@pytest.fixture(scope="session")
def live_account(live) -> dict:
    """Login real con la cuenta de LIVE_EMAIL/LIVE_RUT + LIVE_PASSWORD (una sola vez por corrida,
    para no sumar intentos al límite de login). Sin credenciales, el test se salta."""
    if not LIVE_PASSWORD or not (LIVE_EMAIL or LIVE_RUT):
        pytest.skip("sin LIVE_EMAIL (o LIVE_RUT) + LIVE_PASSWORD: se saltan las pruebas con sesión")
    body = {"email": LIVE_EMAIL} if LIVE_EMAIL else {"rut": LIVE_RUT}
    r = live.post("/api/auth/login", json={**body, "password": LIVE_PASSWORD})
    assert r.status_code == 200, f"login real falló: {r.status_code} {r.text}"
    data = r.json()
    data["headers"] = {"Authorization": f"Bearer {data['access_token']}"}
    me = live.get("/api/me", headers=data["headers"])
    if me.headers.get("X-Terms-Required"):
        pytest.fail("La cuenta de prueba no aceptó los términos vigentes: entra una vez con ella en la app y acéptalos.")
    return data
