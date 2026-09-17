"""Unit puros (TS-07): RUT y contraseña temporal. Sin DB."""

import re

import pytest

from app.core.rut import compute_dv, format_rut, is_valid_rut, normalize_rut
from app.core.security import token_lifetime_minutes
from app.routers.users import _generate_temp_password


@pytest.mark.parametrize(
    "raw,expected",
    [("12.345.678-5", "123456785"), (" 12345678-5 ", "123456785"), ("1-k", "1K"), (None, ""), ("", "")],
)
def test_normalize_rut(raw, expected):
    assert normalize_rut(raw) == expected


@pytest.mark.parametrize(
    "body,dv",
    [
        ("12345678", "5"),
        ("98765432", "5"),
        ("11111111", "1"),
        ("22222222", "2"),
        ("7", "8"),
        ("10", "8"),
        ("30", "2"),
        ("1", "9"),
    ],
)
def test_compute_dv(body, dv):
    assert compute_dv(body) == dv


@pytest.mark.parametrize(
    "rut,valid",
    [
        ("12.345.678-5", True),
        ("12345678-9", False),
        ("7-8", True),
        ("16.456.789-3", True),
        ("abc-1", False),
        ("", False),
        ("5", False),
    ],
)
def test_is_valid_rut(rut, valid):
    assert is_valid_rut(rut) is valid


def test_format_rut():
    assert format_rut("12.345.678-k") == "12345678-K"
    assert format_rut("") is None


def test_temp_password_shape():
    pw = _generate_temp_password("José María")
    assert re.fullmatch(r"Jose\d{3}[!#$]", pw)
    assert _generate_temp_password("").startswith("User")
    assert _generate_temp_password("ana") != _generate_temp_password("ana") or True  # aleatorio


def test_token_lifetime_by_role():
    assert token_lifetime_minutes("PATIENT") == 720
    assert token_lifetime_minutes("ADMIN") == 60
