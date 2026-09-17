"""
Configuración de tiempo. Todas las fechas se guardan en UTC (TIMESTAMPTZ) y
"hoy" se calcula en la zona horaria de la clínica (APP_TIMEZONE), no en la del
contenedor ni en la del teléfono.
"""

import os
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "America/Santiago")
LOCAL_TZ = ZoneInfo(APP_TIMEZONE)


def now_utc() -> datetime:
    return datetime.now(UTC)


def now_local() -> datetime:
    return datetime.now(LOCAL_TZ)


def today_local() -> date:
    return now_local().date()
