"""Unit sin DB: tokens y hashes de `app/core/security.py`."""

from datetime import UTC, datetime, timedelta

from jose import jwt

from app.core import security


def test_hash_roundtrip_and_salt():
    h1 = security.hash_password("Secreta123")
    h2 = security.hash_password("Secreta123")
    assert h1 != h2  # sal distinta
    assert security.verify_password("Secreta123", h1)
    assert not security.verify_password("secreta123", h1)


def test_token_carries_sub_role_and_exp():
    token, expires_in = security.create_access_token("abc", "PATIENT")
    payload = security.decode_token(token)
    assert payload["sub"] == "abc" and payload["role"] == "PATIENT"
    assert expires_in == security.PATIENT_TOKEN_EXPIRE_MINUTES * 60
    remaining = datetime.fromtimestamp(payload["exp"], UTC) - datetime.now(UTC)
    assert (
        timedelta(minutes=security.PATIENT_TOKEN_EXPIRE_MINUTES - 1)
        < remaining
        <= timedelta(minutes=security.PATIENT_TOKEN_EXPIRE_MINUTES)
    )


def test_staff_token_is_shorter_than_patient():
    _, staff = security.create_access_token("a", "SPECIALIST")
    _, patient = security.create_access_token("a", "PATIENT")
    assert staff < patient


def test_decode_rejects_bad_signature_and_garbage():
    token, _ = security.create_access_token("abc", "ADMIN")
    forged = jwt.encode(
        {"sub": "abc", "role": "ADMIN", "exp": datetime.now(UTC) + timedelta(hours=1)}, "otro-secreto", algorithm="HS256"
    )
    assert security.decode_token(forged) == {}
    assert security.decode_token(token[:-3] + "xyz") == {}
    assert security.decode_token("no.es.jwt") == {}
    assert security.decode_token("") == {}


def test_decode_rejects_expired():
    expired = jwt.encode(
        {"sub": "abc", "role": "ADMIN", "exp": datetime.now(UTC) - timedelta(seconds=1)}, security.SECRET_KEY, algorithm="HS256"
    )
    assert security.decode_token(expired) == {}


def test_decode_rejects_token_without_exp():
    """Un token sin vencimiento sería eterno: no debe aceptarse."""
    eternal = jwt.encode({"sub": "abc", "role": "ADMIN"}, security.SECRET_KEY, algorithm="HS256")
    assert security.decode_token(eternal) == {}
