-- 2026-09-22 · Alta de "Elevación de rodillas" (marcha en el lugar), slug `leg_elevation` (EX-59).
-- Reemplaza en la práctica a `leg_raise`, que queda en beta y sin calibrar.
-- Las bases nuevas ya lo traen desde seed.sql; para una base existente:
--   docker exec -i activamente-db psql -U activamente -d activamente_db < database/migrations/002_leg_elevation_exercise.sql
-- Idempotente: se puede correr dos veces sin efecto.
BEGIN;

INSERT INTO exercises (id, name, description, instructions, multimedia_url, max_level) VALUES
  ('leg_elevation', 'Elevación de rodillas',
   'Movilidad de cadera y equilibrio. Marcha en el lugar, como subir una escalera.',
   'Párate erguido de frente a la cámara, con los pies separados al ancho de las caderas. Si lo necesitas, apóyate con una mano en una silla firme. Sube una rodilla hacia el pecho, bájala y apoya el pie en el suelo. Repite con la otra pierna, alternando como si subieras una escalera.',
   NULL, 2)
ON CONFLICT (id) DO NOTHING;

COMMIT;
