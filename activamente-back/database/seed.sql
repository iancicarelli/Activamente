-- ------------------------------------------------------
-- ACTIVAMENTE - Seed Data (fake data, safe to commit)
-- DO NOT use in production
-- ------------------------------------------------------
-- Solo desarrollo (SEC-13): NO va dentro de la imagen de la DB. En local lo monta
-- docker-compose.override.yml como 03_seed.sql (después de init.sql y catalog.sql).
-- En producción la base nace sin usuarios y el primer admin se crea con
-- scripts/create_admin.py (SEC-14).

-- =====================
-- USERS
-- =====================
-- All users share the same password for dev convenience:
--   admin@activamente.cl            → Admin1234!
--   maria.gonzalez@activamente.cl   → Specialist1234!
--   jorge.ramirez@activamente.cl    → Specialist1234!   (sin pacientes asignados)
--   pedro.soto@test.com             → Patient1234!      (RUT 98765432-5, asignado a María)
--   ana.perez@test.com              → Patient1234!      (RUT 11111111-1, sin asignar)
-- (hashes generated with bcrypt, cost=12)

INSERT INTO users (id, first_name, last_name, email, password_hash, role) VALUES
  -- Admin | password: Admin1234!
  ('e2b1cc5c-ab6f-47de-86d3-f4eba9db6b93',
   'Carlos', 'Mendoza',
   'admin@activamente.cl',
   '$2b$12$deumaN7zMt.r//7SDytC3eSBsvxHdiKU2m/E1PfHM1owar96fywoG',
   'ADMIN'),

  -- Specialist | password: Specialist1234!
  ('ba80b312-b4e8-4800-bf46-8c8d84f5052a',
   'María', 'González',
   'maria.gonzalez@activamente.cl',
   '$2b$12$l2WzsN7pm8YE4JWHWjpWEOqWmzBUr./vOb7xnbJ9uDE28hgJAODUG',
   'SPECIALIST'),

  -- Specialist 2 (sin pacientes) | password: Specialist1234!
  ('5d1f0a7e-3c2b-4e9a-8f6d-1b2c3d4e5f60',
   'Jorge', 'Ramírez',
   'jorge.ramirez@activamente.cl',
   '$2b$12$l2WzsN7pm8YE4JWHWjpWEOqWmzBUr./vOb7xnbJ9uDE28hgJAODUG',
   'SPECIALIST'),

  -- Patient | password: Patient1234!
  ('90bcc710-3984-4f86-8570-772ac433d7cd',
   'Pedro', 'Soto',
   'pedro.soto@test.com',
   '$2b$12$Bsb8aWAEkGxbfgSBEjr9SuTYRH/UWMu5krkqyvy7DfLKoyBxmddu2',
   'PATIENT'),

  -- Patient 2 (sin asignar a ningún especialista) | password: Patient1234!
  ('7c0f3d2a-1b44-4e58-9a31-2f6c8e0a9b12',
   'Ana', 'Pérez',
   'ana.perez@test.com',
   '$2b$12$Bsb8aWAEkGxbfgSBEjr9SuTYRH/UWMu5krkqyvy7DfLKoyBxmddu2',
   'PATIENT');

-- =====================
-- ADMIN
-- =====================

INSERT INTO admin (user_id, job_title) VALUES
  ('e2b1cc5c-ab6f-47de-86d3-f4eba9db6b93', 'Administrador de Plataforma');

-- =====================
-- SPECIALISTS
-- =====================

INSERT INTO specialists (user_id, rut, specialty, phone) VALUES
  ('ba80b312-b4e8-4800-bf46-8c8d84f5052a', '12345678-5', 'Kinesiología', '+56912345678'),
  ('5d1f0a7e-3c2b-4e9a-8f6d-1b2c3d4e5f60', '22222222-2', 'Fisioterapia', '+56922222222');

-- =====================
-- PATIENTS
-- =====================

INSERT INTO patients (user_id, rut, age, gender, phone, address) VALUES
  ('90bcc710-3984-4f86-8570-772ac433d7cd', '98765432-5', 34, 'Masculino', '+56987654321', 'Av. Ficticia 123, Santiago'),
  -- Paciente 2: sin asignar a ningún especialista, para probar el flujo de asignación.
  ('7c0f3d2a-1b44-4e58-9a31-2f6c8e0a9b12', '11111111-1', 28, 'Femenino', '+56911111111', 'Calle Falsa 456, Santiago');

-- =====================
-- ASIGNACIÓN
-- =====================
-- Pedro está asignado a María (sin esto "Mis pacientes" del especialista sale vacío).

INSERT INTO specialist_patient (specialist_id, patient_id) VALUES
  ('ba80b312-b4e8-4800-bf46-8c8d84f5052a', '90bcc710-3984-4f86-8570-772ac433d7cd');

-- =====================
-- EXERCISES
-- =====================
-- El catálogo vive en catalog.sql (SEC-13), que corre ANTES que este archivo.

-- =====================
-- ROUTINES
-- =====================
-- Rutina de prueba de Pedro. Todos los días de la semana para que /routines/active
-- la devuelva en cualquier momento (sin depender de la zona horaria de la DB).
--   routine_id  → 12f7ce23-cac4-4987-a338-9b0e1175edd8
--   patient_id  → 90bcc710-3984-4f86-8570-772ac433d7cd (Pedro Soto)

INSERT INTO routines (id, specialist_id, patient_id, name, start_date, end_date, days_of_week, scheduled_time) VALUES
  ('12f7ce23-cac4-4987-a338-9b0e1175edd8',
   'ba80b312-b4e8-4800-bf46-8c8d84f5052a',
   '90bcc710-3984-4f86-8570-772ac433d7cd',
   'Rutina de prueba - sesiones',
   CURRENT_DATE - INTERVAL '7 days',
   CURRENT_DATE + INTERVAL '30 days',
   ARRAY[1,2,3,4,5,6,7],
   '10:00:00');

-- =====================
-- ROUTINE_EXERCISES
-- =====================
-- Ejercicios de la rutina de prueba (12f7ce23...), en orden order_index.
INSERT INTO routine_exercises (id, routine_id, exercise_id, order_index, level, total_series, total_reps, rest_time_seconds, time_limit_seconds) VALUES
  ('1fab546d-7829-478a-98f5-bd42ed045a0d', '12f7ce23-cac4-4987-a338-9b0e1175edd8', 'toe_touch',       0, 1, 1, 10, 30, NULL),
  ('c3dc751c-72d2-421c-a7e5-d10fbe41d440', '12f7ce23-cac4-4987-a338-9b0e1175edd8', 'leg_raise',       1, 1, 1, 10, 30, NULL),
  ('1a582d5c-ee9d-4395-8672-2e8b0ba64a2f', '12f7ce23-cac4-4987-a338-9b0e1175edd8', 'shoulder_raises', 2, 1, 1, 10, 30, NULL),
  ('869202d7-7b9e-4f38-82f6-11b0b959ee5e', '12f7ce23-cac4-4987-a338-9b0e1175edd8', 'squat',           3, 1, 1, 10, 30, NULL);

-- =====================
-- SESSIONS
-- =====================
-- Sesión de prueba (no completada) con id fijo para testear el PUT de progreso.
--   session_id  → 90a1aeee-c904-439f-ba34-1a3c9dfc2a41

INSERT INTO sessions (id, patient_id, routine_id, duration_minutes, is_completed) VALUES
  ('90a1aeee-c904-439f-ba34-1a3c9dfc2a41',
   '90bcc710-3984-4f86-8570-772ac433d7cd',
   '12f7ce23-cac4-4987-a338-9b0e1175edd8',
   NULL,
   FALSE);

-- =====================
-- SESSION_EXERCISES
-- =====================
--   session_exercise_id → 6b75d303-0e53-442b-bd3a-330a30b5e366

INSERT INTO session_exercises (id, session_id, exercise_id, routine_exercise_id, series_completed, reps_completed, accuracy_score, feedback) VALUES
  ('6b75d303-0e53-442b-bd3a-330a30b5e366',
   '90a1aeee-c904-439f-ba34-1a3c9dfc2a41',
   'squat',
   '869202d7-7b9e-4f38-82f6-11b0b959ee5e',
   0,
   0,
   NULL,
   NULL);

-- =====================
-- TERMS_ACCEPTANCES
-- =====================
-- Los usuarios de prueba ya aceptaron los términos vigentes, para que la app y los tests no
-- pasen por la pantalla de términos. La versión debe coincidir con app/core/terms.py
-- (TERMS_VERSION) y tests/seed_data.py; tests/unit/test_terms_seed.py lo verifica.
INSERT INTO terms_acceptances (user_id, version) VALUES
  ('e2b1cc5c-ab6f-47de-86d3-f4eba9db6b93', '2026-09-25'),
  ('ba80b312-b4e8-4800-bf46-8c8d84f5052a', '2026-09-25'),
  ('5d1f0a7e-3c2b-4e9a-8f6d-1b2c3d4e5f60', '2026-09-25'),
  ('90bcc710-3984-4f86-8570-772ac433d7cd', '2026-09-25'),
  ('7c0f3d2a-1b44-4e58-9a31-2f6c8e0a9b12', '2026-09-25');
