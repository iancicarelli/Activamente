"""SEC-05: límite de intentos fallidos de login por IP + cuenta y por IP."""

import pytest

from app.core import rate_limit
from app.core.rate_limit import LoginRateLimiter
from tests import seed_data

BAD = "clave-incorrecta"


def _fail(client, n, **body):
    for _ in range(n):
        assert client.post("/api/auth/login", json={**body, "password": BAD}).status_code == 401


def test_sixth_attempt_is_blocked_even_with_the_right_password(client):
    _fail(client, 5, email=seed_data.PATIENT_EMAIL)
    r = client.post("/api/auth/login", json={"email": seed_data.PATIENT_EMAIL, "password": seed_data.PATIENT_PASSWORD})
    assert r.status_code == 429
    assert 0 < int(r.headers["Retry-After"]) <= 900
    assert "Demasiados intentos" in r.json()["detail"]


def test_account_key_is_normalized(client):
    # Mayúsculas/espacios en el email y puntos/guion en el RUT no reinician el contador.
    _fail(client, 3, email=seed_data.PATIENT_EMAIL.upper())
    _fail(client, 2, email=f"  {seed_data.PATIENT_EMAIL}  ")
    assert client.post("/api/auth/login", json={"email": seed_data.PATIENT_EMAIL, "password": BAD}).status_code == 429

    _fail(client, 3, rut="98.765.432-5")
    _fail(client, 2, rut="987654325")
    assert client.post("/api/auth/login", json={"rut": "98765432-5", "password": BAD}).status_code == 429


def test_blocking_one_account_does_not_block_others_from_the_same_ip(client):
    _fail(client, 5, email=seed_data.PATIENT_EMAIL)
    r = client.post("/api/auth/login", json={"email": seed_data.SPECIALIST_EMAIL, "password": seed_data.SPECIALIST_PASSWORD})
    assert r.status_code == 200


def test_successful_login_resets_the_counter(client):
    _fail(client, 4, email=seed_data.PATIENT_EMAIL)
    ok = client.post("/api/auth/login", json={"email": seed_data.PATIENT_EMAIL, "password": seed_data.PATIENT_PASSWORD})
    assert ok.status_code == 200
    _fail(client, 4, email=seed_data.PATIENT_EMAIL)  # 4 más sin bloquear: el contador volvió a 0


def test_unknown_accounts_count_too(client):
    _fail(client, 5, email="no-existe@test.com")
    assert client.post("/api/auth/login", json={"email": "no-existe@test.com", "password": BAD}).status_code == 429


def test_per_ip_limit_stops_spraying_many_accounts(client, monkeypatch):
    monkeypatch.setattr(rate_limit.login_limiter, "max_failures_per_ip", 6)
    for i in range(6):
        _fail(client, 1, email=f"cuenta{i}@test.com")
    r = client.post("/api/auth/login", json={"email": seed_data.SPECIALIST_EMAIL, "password": seed_data.SPECIALIST_PASSWORD})
    assert r.status_code == 429


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture
def limiter():
    clock = FakeClock()
    return LoginRateLimiter(max_failures=5, max_failures_per_ip=50, window_seconds=900, clock=clock), clock


def test_window_expires(limiter):
    lim, clock = limiter
    for _ in range(5):
        lim.record_failure("1.1.1.1", "email:a")
        clock.now += 10
    assert lim.retry_after("1.1.1.1", "email:a") > 0
    # Se libera cuando vence el PRIMER fallo (t=1000 + 900), no 15 min después del último.
    clock.now = 1000 + 900 + 1
    assert lim.retry_after("1.1.1.1", "email:a") == 0


def test_other_ip_is_independent(limiter):
    lim, _ = limiter
    for _ in range(5):
        lim.record_failure("1.1.1.1", "email:a")
    assert lim.retry_after("1.1.1.1", "email:a") > 0
    assert lim.retry_after("2.2.2.2", "email:a") == 0


def test_expired_keys_are_forgotten(limiter):
    lim, clock = limiter
    lim.record_failure("1.1.1.1", "email:a")
    clock.now += 901
    assert lim.retry_after("1.1.1.1", "email:a") == 0
    assert lim._failures == {}
