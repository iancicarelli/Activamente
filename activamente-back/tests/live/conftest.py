"""Capa `live`: contra un servidor REAL (Docker en :8420 o donde apunte
LIVE_API_URL). Sin LIVE_API_URL toda la carpeta se salta. Solo operaciones de
lectura y logins con los usuarios del seed: no deja datos."""

import os

import httpx
import pytest

LIVE_API_URL = os.getenv("LIVE_API_URL")


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
def live_login(live):
    def _login(**body) -> dict:
        r = live.post("/api/auth/login", json=body)
        assert r.status_code == 200, f"login real falló: {r.status_code} {r.text}"
        data = r.json()
        data["headers"] = {"Authorization": f"Bearer {data['access_token']}"}
        return data

    return _login
