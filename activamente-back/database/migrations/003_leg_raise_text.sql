-- 2026-09-22 · Corrige el nombre, la descripción y las instrucciones de `leg_raise` (EX-61).
-- El texto describía un ejercicio DE PIE ("Párate erguido... eleva una pierna estirada hacia el
-- frente"), pero el ejercicio —y su video— son ACOSTADO boca arriba. El paciente leía una cosa y
-- el video mostraba otra. Solo texto: el validador sigue en beta y sin calibrar.
--   (desde la raíz del repo; en la VPS agregar -f docker-compose.yml)
--   docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < activamente-back/database/migrations/003_leg_raise_text.sql
-- Idempotente: se puede correr dos veces sin efecto.
BEGIN;

UPDATE exercises SET
  name = 'Elevación de piernas acostado',
  description = 'Fortalece el abdomen y los flexores de cadera. Se hace acostado boca arriba. En pruebas (beta): la cámara aún no lo valida bien.',
  instructions = 'Acuéstate boca arriba sobre una colchoneta, con las piernas estiradas y los brazos a los costados. Apoya el teléfono a un costado, cerca del suelo, de modo que se vea tu cuerpo entero de perfil. Sube las dos piernas estiradas hasta donde puedas, manteniendo la espalda apoyada, y bájalas despacio sin dejarlas caer.'
WHERE id = 'leg_raise';

COMMIT;
