"""
Configuración de tiempo. Todas las fechas se guardan en UTC (TIMESTAMPTZ) y
"hoy" se calcula en la zona horaria de la clínica (APP_TIMEZONE), no en la del
contenedor ni en la del teléfono.
"""

import os
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "America/Santiago")

# Ambiente (SEC-06): dev | staging | prod. Sin definir o con un valor desconocido cuenta como
# prod, que es lo seguro: olvidar la variable en la VPS no debe dejar Swagger público.
APP_ENV = os.getenv("APP_ENV", "prod").strip().lower()
# /docs, /redoc y /openapi.json solo en desarrollo local. Staging también es público en internet
# y corre el mismo código que prod, así que tampoco los expone.
DOCS_ENABLED = APP_ENV == "dev"
LOCAL_TZ = ZoneInfo(APP_TIMEZONE)


def now_utc() -> datetime:
    return datetime.now(UTC)


def now_local() -> datetime:
    return datetime.now(LOCAL_TZ)


def today_local() -> date:
    return now_local().date()
