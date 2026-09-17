-- 2026-09-17 · routines.day_of_week (INT) → days_of_week (INT[]): varios días por rutina.
-- Para bases creadas antes de este cambio (las nuevas ya salen de init.sql):
--   docker exec -i activamente-db psql -U activamente -d activamente_db < database/migrations/001_routines_days_of_week.sql
BEGIN;

ALTER TABLE routines ADD COLUMN days_of_week INT[];
UPDATE routines SET days_of_week = ARRAY[day_of_week];
ALTER TABLE routines ALTER COLUMN days_of_week SET NOT NULL;
ALTER TABLE routines ADD CONSTRAINT routines_days_of_week_check CHECK (
    cardinality(days_of_week) BETWEEN 1 AND 7
    AND days_of_week <@ ARRAY[1,2,3,4,5,6,7]
);
ALTER TABLE routines DROP COLUMN day_of_week;

COMMIT;
