"""
Términos de uso y privacidad (Ley 21.719, 2026-09-25).

El texto vive aquí (no en la app) para que la versión que se muestra y la que se registra como
aceptada sean siempre la misma, y para poder corregirlo sin publicar una versión nueva en Play.

**Cambiar el texto de forma sustantiva = subir TERMS_VERSION**: todos los usuarios tendrán que
volver a aceptar al entrar. Al subirla, actualizar también las aceptaciones de `seed.sql` y
`tests/seed_data.py::TERMS_VERSION`. Una corrección de erratas no necesita versión nueva.

Los datos del responsable salen del entorno. Con APP_ENV=prod son obligatorios y la app no
arranca sin ellos: los términos no pueden publicarse con datos de relleno.

BORRADOR: redactado a partir del uso previsto (investigación académica, no comercial, pruebas con
adultos mayores). Debe revisarlo el profesor guía y, si corresponde, el comité de ética y un
abogado antes de usarlo con participantes reales.
"""

import os

from app.core.config import APP_ENV

TERMS_VERSION = "2026-09-25"

_CONTACT_VARS = ("TERMS_RESPONSIBLE", "TERMS_INSTITUTION", "TERMS_CONTACT_EMAIL")
_missing = [v for v in _CONTACT_VARS if not os.getenv(v)]
if APP_ENV == "prod" and _missing:
    raise RuntimeError(
        f"Faltan {', '.join(_missing)} en el entorno: los términos de uso necesitan los datos reales del responsable."
    )

RESPONSIBLE = os.getenv("TERMS_RESPONSIBLE", "[nombre del responsable]")
INSTITUTION = os.getenv("TERMS_INSTITUTION", "[universidad]")
CONTACT_EMAIL = os.getenv("TERMS_CONTACT_EMAIL", "[correo de contacto]")

ALL = ("PATIENT", "SPECIALIST", "ADMIN")
STAFF = ("SPECIALIST", "ADMIN")

# (título, cuerpo, roles que ven la sección)
SECTIONS: list[tuple[str, str, tuple[str, ...]]] = [
    (
        "Qué es ActivaMente",
        "ActivaMente es una aplicación de ejercicios de rehabilitación guiados por la cámara del "
        f"teléfono, desarrollada por {RESPONSIBLE} como parte de un trabajo de investigación académica "
        f"en {INSTITUTION}. No tiene fines comerciales. No reemplaza la atención de un profesional de "
        "la salud: si sientes dolor o malestar durante un ejercicio, detente y avisa a tu especialista.",
        ALL,
    ),
    (
        "Participación voluntaria",
        "Usar ActivaMente es voluntario. Puedes dejar de usarla cuando quieras, sin dar explicaciones "
        "y sin ninguna consecuencia para ti.",
        ("PATIENT",),
    ),
    (
        "Qué datos se guardan",
        "Tus datos de identificación y contacto (nombre, RUT, correo, teléfono, dirección, edad y "
        "género), las rutinas que te asigna tu especialista, los resultados de cada sesión (series, "
        "repeticiones y precisión), tus respuestas a las encuestas antes y después de cada sesión "
        "(dolor, cansancio, estrés y ánimo) y tus citas. Las respuestas sobre dolor y ánimo son datos "
        "de salud y se tratan con protección reforzada.",
        ALL,
    ),
    (
        "Uso de la cámara",
        "La cámara se enciende solo mientras haces un ejercicio y se apaga en los descansos. La imagen "
        "se analiza dentro de tu teléfono para contar las repeticiones. Ninguna foto ni video se graba, "
        "se guarda ni se envía: al servidor solo llega el número de repeticiones y la precisión.",
        ALL,
    ),
    (
        "Para qué se usan tus datos",
        "Para que tu especialista siga tu avance y ajuste tus ejercicios, y para la investigación. En "
        "cualquier presentación o publicación los resultados se muestran de forma agrupada y sin "
        "datos que permitan identificarte.",
        ALL,
    ),
    (
        "Quién puede ver tus datos",
        "Solo tu especialista asignado y el administrador de la aplicación. Cada vez que uno de ellos "
        "revisa tus datos queda registrado. Tus datos no se venden ni se comparten con otras personas "
        "o empresas.",
        ALL,
    ),
    (
        "Cómo se protegen",
        "La información viaja cifrada entre tu teléfono y el servidor, el acceso requiere contraseña y "
        "las copias de respaldo se guardan cifradas.",
        ALL,
    ),
    (
        "Tus derechos",
        "Puedes pedir ver, corregir o eliminar tus datos. Para eliminar tu cuenta usa el botón "
        '"Solicitar eliminación de mi cuenta" en tu perfil, o escribe a '
        f"{CONTACT_EMAIL}. Si se aprueba, se borran tu cuenta y todos tus datos (sesiones, encuestas, "
        "rutinas y citas) y no se pueden recuperar. Para cualquier otra consulta escribe al mismo correo.",
        ALL,
    ),
    (
        "Confidencialidad del equipo",
        "Como especialista o administrador tienes acceso a datos de salud de otras personas. Te "
        "comprometes a usarlos solo para su atención y para la investigación, a no copiarlos ni "
        "compartirlos fuera de la aplicación y a no prestar tu cuenta. Tus accesos a los datos de "
        "cada paciente quedan registrados.",
        STAFF,
    ),
    (
        "Responsable y contacto",
        f"{RESPONSIBLE}, {INSTITUTION}. Correo: {CONTACT_EMAIL}.",
        ALL,
    ),
]


def terms_for_role(role: str) -> list[dict]:
    return [{"title": t, "body": b} for t, b, roles in SECTIONS if role in roles]
