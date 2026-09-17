"""
Utilidades de RUT chileno. Puro Python, sin DB (testeable en unit).

- normalize_rut("12.345.678-K") -> "12345678K"  (para comparar / guardar)
- format_rut("12345678K")        -> "12345678-K" (forma canónica guardada)
- is_valid_rut("12345678-5")     -> True         (módulo 11)
"""

from sqlalchemy import func


def normalize_rut(rut: str | None) -> str:
    return (rut or "").replace(".", "").replace(" ", "").replace("-", "").upper()


def format_rut(rut: str | None) -> str | None:
    """Forma canónica: cuerpo + '-' + dígito verificador, sin puntos."""
    clean = normalize_rut(rut)
    if len(clean) < 2:
        return None
    return f"{clean[:-1]}-{clean[-1]}"


def compute_dv(body: str) -> str:
    total = 0
    multiplier = 2
    for digit in reversed(body):
        total += int(digit) * multiplier
        multiplier = 2 if multiplier == 7 else multiplier + 1
    remainder = 11 - (total % 11)
    if remainder == 11:
        return "0"
    if remainder == 10:
        return "K"
    return str(remainder)


def is_valid_rut(rut: str | None) -> bool:
    clean = normalize_rut(rut)
    if len(clean) < 2 or not clean[:-1].isdigit():
        return False
    return compute_dv(clean[:-1]) == clean[-1]


def rut_column_normalized(column):
    """Misma normalización que normalize_rut() pero en SQL, para que la
    comparación no dependa del formato guardado."""
    return func.upper(func.replace(func.replace(func.replace(column, ".", ""), " ", ""), "-", ""))
