"""Si se sube TERMS_VERSION sin actualizar el seed, todos los usuarios de prueba quedarían
bloqueados por la pantalla de términos: que falle aquí y no en 300 tests a la vez."""

import re
from pathlib import Path

from app.core.terms import TERMS_VERSION, terms_for_role
from tests import seed_data

SEED = Path(__file__).resolve().parents[2] / "database" / "seed.sql"


def test_seed_accepts_the_current_terms_version():
    block = SEED.read_text().split("INSERT INTO terms_acceptances", 1)[1]
    versions = set(re.findall(r"'(\d{4}-\d{2}-\d{2})'\)", block))
    assert versions == {TERMS_VERSION} == {seed_data.TERMS_VERSION}


def test_staff_sees_confidentiality_and_patients_see_voluntary_participation():
    patient = {s["title"] for s in terms_for_role("PATIENT")}
    specialist = {s["title"] for s in terms_for_role("SPECIALIST")}
    assert "Participación voluntaria" in patient and "Confidencialidad del equipo" not in patient
    assert "Confidencialidad del equipo" in specialist and "Participación voluntaria" not in specialist
    assert "Uso de la cámara" in patient and "Uso de la cámara" in specialist
