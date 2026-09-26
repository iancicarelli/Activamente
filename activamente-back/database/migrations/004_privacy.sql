-- 2026-09-25 · Privacidad (Ley 21.719): términos aceptados, solicitudes de eliminación y registro
-- de accesos del staff. Crea las tablas nuevas de init.sql en una base existente.
--   (desde la raíz del repo; en la VPS agregar -f docker-compose.yml)
--   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < activamente-back/database/migrations/004_privacy.sql
-- Idempotente: se puede correr dos veces sin efecto.
BEGIN;

-- ── Privacidad (Ley 21.719, 2026-09-25) ────────────────────────────────────
-- Aceptación de los términos de uso y privacidad. Una fila por usuario y versión aceptada;
-- la versión vigente está en app/core/terms.py (TERMS_VERSION). Sin aceptar la vigente, la API
-- responde 403 (app/core/deps.py).
CREATE TABLE IF NOT EXISTS terms_acceptances (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version      VARCHAR NOT NULL,
    accepted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, version)
);

-- Solicitudes de eliminación de cuenta de un paciente. user_id SIN FK a propósito: al aprobarse
-- se borra el usuario y la fila queda como constancia de que la solicitud se atendió.
CREATE TABLE IF NOT EXISTS deletion_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    status        VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reason        TEXT,
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at   TIMESTAMPTZ,
    resolved_by   UUID
);
-- Una sola solicitud pendiente por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deletion_requests_pending ON deletion_requests (user_id) WHERE status = 'PENDING';

-- Registro de accesos del staff (admin / especialista) a datos de un paciente, incluidos los
-- intentos denegados. Sin FKs a propósito: sobrevive a la eliminación de usuarios.
CREATE TABLE IF NOT EXISTS access_log (
    id          BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id    UUID NOT NULL,
    actor_role  user_role NOT NULL,
    patient_id  UUID,
    method      VARCHAR NOT NULL,
    path        VARCHAR NOT NULL,
    allowed     BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_access_log_patient_at ON access_log (patient_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_actor_at ON access_log (actor_id, at DESC);
COMMIT;
