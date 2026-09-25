"""SEC-06: Swagger (/docs, /redoc, /openapi.json) solo existe con APP_ENV=dev.

La app se configura al importarse, así que cada ambiente se prueba en un proceso aparte."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

PROBE = """
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
print(c.get("/docs").status_code, c.get("/redoc").status_code, c.get("/openapi.json").status_code, "docs" in c.get("/").json())
"""


def _probe(app_env: str | None) -> str:
    env = {**os.environ, "SECRET_KEY": "x", "DATABASE_URL": "postgresql://u:p@localhost:1/none"}
    env.pop("APP_ENV", None)
    if app_env is not None:
        env["APP_ENV"] = app_env
    out = subprocess.run([sys.executable, "-c", PROBE], cwd=ROOT, env=env, capture_output=True, text=True, check=True)
    return out.stdout.split("\n")[-2]


def test_dev_publishes_docs():
    assert _probe("dev") == "200 200 200 True"


@pytest.mark.parametrize("app_env", ["prod", "staging", "PROD ", "produccion", None])
def test_everything_else_hides_docs(app_env):
    # Sin APP_ENV o con un valor mal escrito cuenta como prod: olvidarla no publica Swagger.
    assert _probe(app_env) == "404 404 404 False"
