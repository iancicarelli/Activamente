-- ------------------------------------------------------
-- ACTIVAMENTE - Database Init (PostgreSQL)
-- ------------------------------------------------------
-- Cambios de esquema (2026-09-13):
--   * users.is_active es el ÚNICO flag de activo (R-01 opción a). patients.is_active se eliminó.
--   * Se eliminaron las columnas `id UUID UNIQUE` sin uso de patients/specialists/admin (DC-24).
--   * Timestamps con zona horaria (TIMESTAMPTZ) para no depender del TZ del contenedor.
--   * surveys con columnas explícitas pain/fatigue/stress/mood en escala 1-5 (R-02) y
--     UNIQUE (session_id, type) para que el POST sea idempotente.
--   * exercises.max_level: niveles disponibles por ejercicio (EX-32 / HC-11).
--   * sessions.completed_at y is_completed NOT NULL DEFAULT FALSE.
-- 2026-09-17: routines.day_of_week INT → days_of_week INT[] (varios días por rutina).
--   Bases existentes: database/migrations/001_routines_days_of_week.sql.
-- Cambiar este archivo requiere `docker compose down -v` o un script en database/migrations/
-- (no hay herramienta de migraciones).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- ENUMS
-- =====================

CREATE TYPE user_role AS ENUM ('ADMIN', 'SPECIALIST', 'PATIENT');
CREATE TYPE appointment_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE survey_type AS ENUM ('PRE_SESSION', 'POST_SESSION');

-- =====================
-- TABLES
-- =====================

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name    VARCHAR,
    last_name     VARCHAR,
    email         VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    role          user_role NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1:1 with users; user_id is the PK so other tables can FK to it directly
CREATE TABLE specialists (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rut        VARCHAR UNIQUE,
    specialty  VARCHAR,
    phone      VARCHAR
);

CREATE TABLE patients (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rut        VARCHAR UNIQUE,
    age        INT,
    gender     VARCHAR,
    phone      VARCHAR,
    address    TEXT
);

CREATE TABLE admin (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    job_title  VARCHAR,
    phone      VARCHAR
);

-- N:M between specialists and patients
CREATE TABLE specialist_patient (
    specialist_id  UUID REFERENCES specialists(user_id) ON DELETE CASCADE,
    patient_id     UUID REFERENCES patients(user_id) ON DELETE CASCADE,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (specialist_id, patient_id)
);
CREATE INDEX idx_specialist_patient_patient ON specialist_patient (patient_id);

CREATE TABLE appointments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialist_id  UUID REFERENCES specialists(user_id) ON DELETE SET NULL,
    patient_id     UUID REFERENCES patients(user_id) ON DELETE SET NULL,
    date           DATE NOT NULL,
    time_slot      TIME NOT NULL,
    status         appointment_status NOT NULL DEFAULT 'CONFIRMED',
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_appointments_specialist_date ON appointments (specialist_id, date);
CREATE INDEX idx_appointments_patient_date ON appointments (patient_id, date);

-- id is a human-readable slug, e.g. 'squat', 'leg_raise'
CREATE TABLE exercises (
    id              VARCHAR PRIMARY KEY,
    name            VARCHAR NOT NULL,
    description     TEXT,
    instructions    TEXT,
    multimedia_url  VARCHAR,
    max_level       INT NOT NULL DEFAULT 1 CHECK (max_level BETWEEN 1 AND 3)
);

CREATE TABLE routines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialist_id   UUID REFERENCES specialists(user_id) ON DELETE SET NULL,
    patient_id      UUID NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    name            VARCHAR NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    -- Días de la semana en que toca la rutina: 1 (lunes) … 7 (domingo), sin repetir.
    days_of_week    INT[] NOT NULL CHECK (
                        cardinality(days_of_week) BETWEEN 1 AND 7
                        AND days_of_week <@ ARRAY[1,2,3,4,5,6,7]
                    ),
    scheduled_time  TIME,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);
CREATE INDEX idx_routines_patient ON routines (patient_id);

-- N:M between routines and exercises
CREATE TABLE routine_exercises (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id           UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id          VARCHAR NOT NULL REFERENCES exercises(id),
    order_index          INT NOT NULL,
    time_limit_seconds   INT,
    level                INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
    total_series         INT NOT NULL DEFAULT 1 CHECK (total_series >= 1),
    total_reps           INT NOT NULL DEFAULT 10 CHECK (total_reps >= 1),
    rest_time_seconds    INT CHECK (rest_time_seconds IS NULL OR rest_time_seconds >= 0)
);

CREATE TABLE sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       UUID NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    routine_id       UUID REFERENCES routines(id) ON DELETE SET NULL,
    date             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    duration_minutes INT,
    is_completed     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_sessions_patient_date ON sessions (patient_id, date DESC);

-- AI-recorded metrics per exercise within a session
CREATE TABLE session_exercises (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id           UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id          VARCHAR REFERENCES exercises(id),
    routine_exercise_id  UUID REFERENCES routine_exercises(id) ON DELETE SET NULL,
    series_completed     INT NOT NULL DEFAULT 0,
    reps_completed       INT NOT NULL DEFAULT 0,
    accuracy_score       FLOAT,
    feedback             TEXT
);
CREATE INDEX idx_session_exercises_session ON session_exercises (session_id);

-- Encuestas PRE / POST de una sesión. Escala 1-5 en todas las columnas (R-02).
--   PRE_SESSION : pain_level, fatigue_level, stress_level
--   POST_SESSION: mood_level, pain_level (opcional)
CREATE TABLE surveys (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type           survey_type NOT NULL,
    pain_level     INT CHECK (pain_level    IS NULL OR pain_level    BETWEEN 1 AND 5),
    fatigue_level  INT CHECK (fatigue_level IS NULL OR fatigue_level BETWEEN 1 AND 5),
    stress_level   INT CHECK (stress_level  IS NULL OR stress_level  BETWEEN 1 AND 5),
    mood_level     INT CHECK (mood_level    IS NULL OR mood_level    BETWEEN 1 AND 5),
    comments       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, type)
);

-- ── Privacidad (Ley 21.719, 2026-09-25) ────────────────────────────────────
-- Aceptación de los términos de uso y privacidad. Una fila por usuario y versión aceptada;
-- la versión vigente está en app/core/terms.py (TERMS_VERSION). Sin aceptar la vigente, la API
-- responde 403 (app/core/deps.py).
CREATE TABLE terms_acceptances (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version      VARCHAR NOT NULL,
    accepted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, version)
);

-- Solicitudes de eliminación de cuenta de un paciente. user_id SIN FK a propósito: al aprobarse
-- se borra el usuario y la fila queda como constancia de que la solicitud se atendió.
CREATE TABLE deletion_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    status        VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reason        TEXT,
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at   TIMESTAMPTZ,
    resolved_by   UUID
);
-- Una sola solicitud pendiente por usuario.
CREATE UNIQUE INDEX uq_deletion_requests_pending ON deletion_requests (user_id) WHERE status = 'PENDING';

-- Registro de accesos del staff (admin / especialista) a datos de un paciente, incluidos los
-- intentos denegados. Sin FKs a propósito: sobrevive a la eliminación de usuarios.
CREATE TABLE access_log (
    id          BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id    UUID NOT NULL,
    actor_role  user_role NOT NULL,
    patient_id  UUID,
    method      VARCHAR NOT NULL,
    path        VARCHAR NOT NULL,
    allowed     BOOLEAN NOT NULL
);
CREATE INDEX idx_access_log_patient_at ON access_log (patient_id, at DESC);
CREATE INDEX idx_access_log_actor_at ON access_log (actor_id, at DESC);
