"""Constantes que reflejan `database/seed.sql`. Si cambia el seed, actualizar acá."""

ADMIN_ID = "e2b1cc5c-ab6f-47de-86d3-f4eba9db6b93"
ADMIN_EMAIL = "admin@activamente.cl"
ADMIN_PASSWORD = "Admin1234!"

SPECIALIST_ID = "ba80b312-b4e8-4800-bf46-8c8d84f5052a"
SPECIALIST_EMAIL = "maria.gonzalez@activamente.cl"
SPECIALIST_PASSWORD = "Specialist1234!"
SPECIALIST_RUT = "12345678-5"

SPECIALIST2_ID = "5d1f0a7e-3c2b-4e9a-8f6d-1b2c3d4e5f60"
SPECIALIST2_EMAIL = "jorge.ramirez@activamente.cl"

# Pedro Soto: paciente CON rutina/sesión de prueba, asignado a María.
PATIENT_EMAIL = "pedro.soto@test.com"
PATIENT_PASSWORD = "Patient1234!"
PATIENT_PEDRO_ID = "90bcc710-3984-4f86-8570-772ac433d7cd"
PATIENT_PEDRO_RUT = "98765432-5"

# Ana Pérez: paciente SIN asignar a ningún especialista.
PATIENT_ANA_EMAIL = "ana.perez@test.com"
PATIENT_ANA_PASSWORD = "Patient1234!"
PATIENT_ANA_ID = "7c0f3d2a-1b44-4e58-9a31-2f6c8e0a9b12"
PATIENT_ANA_RUT = "11111111-1"

# Rutina de prueba de Pedro (4 routine_exercises), vigente hoy.
ROUTINE_ID = "12f7ce23-cac4-4987-a338-9b0e1175edd8"
ROUTINE_EXERCISE_SQUAT_ID = "869202d7-7b9e-4f38-82f6-11b0b959ee5e"

# Sesión de prueba (no completada) de Pedro con un session_exercise.
SESSION_ID = "90a1aeee-c904-439f-ba34-1a3c9dfc2a41"
SESSION_EXERCISE_ID = "6b75d303-0e53-442b-bd3a-330a30b5e366"

EXERCISE_SLUGS = {"squat", "toe_touch", "leg_raise", "shoulder_raises"}
