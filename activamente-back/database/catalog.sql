-- ------------------------------------------------------
-- ACTIVAMENTE - Catálogo de ejercicios (va a TODOS los ambientes, producción incluida)
-- ------------------------------------------------------
-- Separado de seed.sql (SEC-13): el seed trae usuarios falsos y NO va a producción; sin este
-- catálogo, en cambio, no hay ejercicios que asignar. Dockerfile.db lo copia como 02_catalog.sql.
-- exercises.id es VARCHAR (slug) y coincide con las claves de exerciseRegistry.ts del frontend
-- (squat, toe_touch, leg_raise, leg_elevation, shoulder_raises); no cambiarlos.
-- max_level: niveles implementados en validation/validators/*.ts (1 = más fácil).
-- Idempotente (ON CONFLICT DO NOTHING): se puede correr sobre una base existente. Cambios de
-- texto sobre bases ya creadas van como migración en database/migrations/.

INSERT INTO exercises (id, name, description, instructions, multimedia_url, max_level) VALUES
  ('squat', 'Sentadilla',
   'Ejercicio de fuerza para piernas y glúteos.',
   'Párate con los pies separados al ancho de los hombros. Baja flexionando rodillas y caderas como si fueras a sentarte, manteniendo la espalda recta. Desciende hasta que los muslos queden paralelos al suelo y vuelve a subir de forma controlada.',
   NULL, 3),
  ('toe_touch', 'Toque de punta de pies',
   'Estiramiento de espalda baja e isquiotibiales.',
   'Párate erguido con los pies juntos y las piernas estiradas. Inclínate hacia adelante desde la cadera bajando las manos hacia las rodillas (nivel 1) o hacia los tobillos (nivel 2). Mantén la espalda lo más recta posible y vuelve lentamente a la posición inicial.',
   NULL, 2),
  ('leg_raise', 'Elevación de piernas acostado',
   'Fortalece el abdomen y los flexores de cadera. Se hace acostado boca arriba. En pruebas (beta): la cámara aún no lo valida bien.',
   'Acuéstate boca arriba sobre una colchoneta, con las piernas estiradas y los brazos a los costados. Apoya el teléfono a un costado, cerca del suelo, de modo que se vea tu cuerpo entero de perfil. Sube las dos piernas estiradas hasta donde puedas, manteniendo la espalda apoyada, y bájalas despacio sin dejarlas caer.',
   NULL, 3),
  ('leg_elevation', 'Elevación de rodillas',
   'Movilidad de cadera y equilibrio. Marcha en el lugar, como subir una escalera.',
   'Párate erguido de frente a la cámara, con los pies separados al ancho de las caderas. Si lo necesitas, apóyate con una mano en una silla firme. Sube una rodilla hacia el pecho, bájala y apoya el pie en el suelo. Repite con la otra pierna, alternando como si subieras una escalera.',
   NULL, 2),
  ('shoulder_raises', 'Elevación de brazos',
   'Movilidad y fuerza de hombros.',
   'Párate erguido con los brazos a los costados del cuerpo. Eleva ambos brazos estirados hacia los lados hasta la altura de los hombros. Mantén un instante y baja los brazos lentamente a la posición inicial.',
   NULL, 3)
ON CONFLICT (id) DO NOTHING;
