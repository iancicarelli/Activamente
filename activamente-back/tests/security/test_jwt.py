"""Seguridad · autenticación: qué tokens acepta la API y cuáles no."""

import base64
import json
from datetime import UTC, datetime, timedelta

import pytest
from jose import jwt

from app.core import security
from tests import seed_data
from tests.conftest import bearer

PEDRO = seed_data.PATIENT_PEDRO_ID


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _b64(obj: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj, separators=(",", ":")).encode()).rstrip(b"=").decode()


def test_no_header_and_wrong_scheme(client):
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers={"Authorization": "Basic YWRtaW46YWRtaW4="}).status_code in (401, 403)
    assert client.get("/api/me", headers={"Authorization": "Bearer"}).status_code in (401, 403)
    assert client.get("/api/me", headers={"Authorization": "Bearer "}).status_code in (401, 403)
    assert client.get("/api/me", headers={"Authorization": "Token abc"}).status_code in (401, 403)


def test_forged_signature_rejected(client):
    forged = jwt.encode(
        {"sub": seed_data.ADMIN_ID, "role": "ADMIN", "exp": datetime.now(UTC) + timedelta(hours=1)},
        "secreto-equivocado",
        algorithm="HS256",
    )
    assert client.get("/api/users", headers=_hdr(forged)).status_code == 401


def test_alg_none_rejected(client):
    """Ataque clásico: header alg=none y sin firma."""
    header = _b64({"alg": "none", "typ": "JWT"})
    payload = _b64({"sub": seed_data.ADMIN_ID, "role": "ADMIN", "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp())})
    for token in (f"{header}.{payload}.", f"{header}.{payload}"):
        assert client.get("/api/users", headers=_hdr(token)).status_code == 401


def test_expired_token_rejected(client):
    expired = jwt.encode(
        {"sub": seed_data.ADMIN_ID, "role": "ADMIN", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        security.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )
    r = client.get("/api/users", headers=_hdr(expired))
    assert r.status_code == 401
    assert "expiró" in r.json()["detail"]


def test_token_without_exp_rejected(client):
    eternal = jwt.encode({"sub": seed_data.ADMIN_ID, "role": "ADMIN"}, security.SECRET_KEY, algorithm=security.ALGORITHM)
    assert client.get("/api/users", headers=_hdr(eternal)).status_code == 401


def test_role_claim_is_not_trusted(client):
    """Un token bien firmado pero con `role` falso: la API usa el rol de la DB."""
    assert client.get("/api/users", headers=bearer(PEDRO, "ADMIN")).status_code == 403
    assert client.get("/api/specialists/dashboard", headers=bearer(PEDRO, "SPECIALIST")).status_code == 403
    me = client.get("/api/me", headers=bearer(PEDRO, "ADMIN")).json()
    assert me["role"] == "PATIENT"


@pytest.mark.parametrize("sub", ["00000000-0000-0000-0000-000000000000", "no-es-uuid", "", None])
def test_unknown_or_malformed_subject(client, sub):
    payload = {"role": "ADMIN", "exp": datetime.now(UTC) + timedelta(hours=1)}
    if sub is not None:
        payload["sub"] = sub
    token = jwt.encode(payload, security.SECRET_KEY, algorithm=security.ALGORITHM)
    assert client.get("/api/me", headers=_hdr(token)).status_code == 401


def test_token_of_deactivated_user_dies_immediately(client, admin_headers):
    token = bearer(seed_data.PATIENT_ANA_ID, "PATIENT")
    assert client.get("/api/me", headers=token).status_code == 200
    client.patch(f"/api/users/{seed_data.PATIENT_ANA_ID}/status", json={"is_active": False}, headers=admin_headers)
    assert client.get("/api/me", headers=token).status_code == 403


def test_login_does_not_leak_whether_user_exists(client):
    """Mismo status y mismo mensaje para email inexistente y contraseña errada."""
    unknown = client.post("/api/auth/login", json={"email": "nadie@nunca.cl", "password": "x"})
    wrong = client.post("/api/auth/login", json={"email": seed_data.ADMIN_EMAIL, "password": "x"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]


def test_login_response_has_no_secrets(client):
    r = client.post("/api/auth/login", json={"email": seed_data.ADMIN_EMAIL, "password": seed_data.ADMIN_PASSWORD})
    body = r.text.lower()
    assert "password" not in body and "hash" not in body
