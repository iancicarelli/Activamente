"""SEC-13: la imagen de la DB (Dockerfile.db) lleva esquema + catálogo y NUNCA el seed de
usuarios falsos; el seed solo entra en local por docker-compose.override.yml."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_db_image_has_schema_and_catalog_but_not_seed():
    copies = [line for line in (ROOT / "Dockerfile.db").read_text().splitlines() if line.startswith("COPY")]
    assert any("init.sql" in c for c in copies)
    assert any("catalog.sql" in c for c in copies)
    assert not any("seed.sql" in c for c in copies)


def test_catalog_has_no_users_and_seed_has_no_catalog():
    catalog = (ROOT / "database" / "catalog.sql").read_text()
    seed = (ROOT / "database" / "seed.sql").read_text()
    assert "INSERT INTO users" not in catalog
    assert "INSERT INTO exercises" not in seed
