-- ------------------------------------------------------
-- ACTIVAMENTE - Database Init (PostgreSQL)
-- ------------------------------------------------------

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
    created_at    TIMESTAMP DEFAULT NOW()
);

-- 1:1 with users; user_id is the PK so other tables can FK to it directly
CREATE TABLE specialists (
    id         UUID UNIQUE DEFAULT gen_random_uuid(),
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rut        VARCHAR UNIQUE,
    specialty  VARCHAR,
    phone      VARCHAR
);

CREATE TABLE patients (
    id         UUID UNIQUE DEFAULT gen_random_uuid(),
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rut        VARCHAR UNIQUE,
    age        INT,
    gender     VARCHAR,
    phone      VARCHAR,
    address    TEXT,
    is_active  BOOLEAN DEFAULT TRUE
);

CREATE TABLE admin (
    id         UUID UNIQUE DEFAULT gen_random_uuid(),
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    job_title  VARCHAR,
    phone      VARCHAR
);

-- N:M between specialists and patients
CREATE TABLE specialist_patient (
    specialist_id  UUID REFERENCES specialists(user_id) ON DELETE CASCADE,
    patient_id     UUID REFERENCES patients(user_id) ON DELETE CASCADE,
    assigned_at    TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (specialist_id, patient_id)
);

CREATE TABLE appointments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialist_id  UUID REFERENCES specialists(user_id),
    patient_id     UUID REFERENCES patients(user_id),
    date           DATE,
    time_slot      TIME,
    status         appointment_status,
    notes          TEXT
);

-- id is a human-readable slug, e.g. 'squat', 'leg_raise'
CREATE TABLE exercises (
    id              VARCHAR PRIMARY KEY,
    name            VARCHAR,
    description     TEXT,
    instructions    TEXT,
    multimedia_url  VARCHAR
);

CREATE TABLE routines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialist_id   UUID REFERENCES specialists(user_id),
    patient_id      UUID REFERENCES patients(user_id),
    name            VARCHAR,
    start_date      DATE,
    end_date        DATE,
    day_of_week     INT,  -- 1 (Monday) to 7 (Sunday)
    scheduled_time  TIME,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- N:M between routines and exercises
CREATE TABLE routine_exercises (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id           UUID REFERENCES routines(id) ON DELETE CASCADE,
    exercise_id          VARCHAR REFERENCES exercises(id),
    order_index          INT NOT NULL,
    time_limit_seconds   INT,
    level                INT,
    total_series         INT,
    total_reps           INT,
    rest_time_seconds    INT
);

CREATE TABLE sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       UUID REFERENCES patients(user_id),
    routine_id       UUID REFERENCES routines(id) ON DELETE SET NULL,
    date             TIMESTAMP DEFAULT NOW(),
    duration_minutes INT,
    is_completed     BOOLEAN
);

-- AI-recorded metrics per exercise within a session
CREATE TABLE session_exercises (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id           UUID REFERENCES sessions(id) ON DELETE CASCADE,
    exercise_id          VARCHAR REFERENCES exercises(id),
    routine_exercise_id  UUID REFERENCES routine_exercises(id) ON DELETE SET NULL,
    series_completed     INT,
    reps_completed       INT,
    accuracy_score       FLOAT,
    feedback             TEXT
);


CREATE TABLE surveys (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID REFERENCES sessions(id) ON DELETE CASCADE,
    type           survey_type,
    pain_level     INT,    -- scale 1–10
    fatigue_level  INT,    -- scale 1–10
    comments       TEXT
);
