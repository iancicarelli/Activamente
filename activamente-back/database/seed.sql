-- ------------------------------------------------------
-- ACTIVAMENTE - Seed Data (fake data, safe to commit)
-- DO NOT use in production
-- ------------------------------------------------------

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
-- exercises.id es VARCHAR (slug), coincide con el exerciseId del frontend.
-- Los ids coinciden con las claves de exerciseRegistry.ts del frontend
-- (toe_touch, leg_raise, shoulder_raises, squat); no cambiarlos.
-- max_level: niveles implementados en validation/validators/*.ts (1 = más fácil).

INSERT INTO exercises (id, name, description, instructions, multimedia_url, max_level) VALUES
  ('squat', 'Sentadilla',
   'Ejercicio de fuerza para piernas y glúteos.',
   'Párate con los pies separados al ancho de los hombros. Baja flexionando rodillas y caderas como si fueras a sentarte, manteniendo la espalda recta. Desciende hasta que los muslos queden paralelos al suelo y vuelve a subir de forma controlada.',
   NULL, 3),
  ('toe_touch', 'Toque de punta de pies',
   'Estiramiento de espalda baja e isquiotibiales.',
   'Párate erguido con los pies juntos y las piernas estiradas. Inclínate hacia adelante desde la cadera bajando las manos hacia las puntas de los pies. Mantén la espalda lo más recta posible y vuelve lentamente a la posición inicial.',
   NULL, 3),
  ('leg_raise', 'Elevación de pierna',
   'Fortalece la cadera y el equilibrio.',
   'Párate erguido y apóyate en una superficie estable si lo necesitas. Eleva una pierna estirada hacia el frente manteniendo el tronco firme. Sube hasta donde puedas sin doblar la rodilla y baja la pierna de forma controlada.',
   NULL, 3),
  ('shoulder_raises', 'Elevación de brazos',
   'Movilidad y fuerza de hombros.',
   'Párate erguido con los brazos a los costados del cuerpo. Eleva ambos brazos estirados hacia los lados hasta la altura de los hombros. Mantén un instante y baja los brazos lentamente a la posición inicial.',
   NULL, 3);

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
