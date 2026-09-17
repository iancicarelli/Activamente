"""Unit sin DB: zona horaria de la clínica."""

from datetime import UTC

from app.core import config


def test_local_tz_is_santiago_by_default():
    assert str(config.LOCAL_TZ) == config.APP_TIMEZONE
    assert config.now_utc().tzinfo == UTC
    assert config.now_local().tzinfo is config.LOCAL_TZ


def test_today_local_matches_now_local():
    assert config.today_local() == config.now_local().date()
