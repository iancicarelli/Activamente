# Fixtures de landmarks

Secuencias de landmarks reales para testear los validadores (TS-11 / EX-34).

- **Cómo grabar una:** en un build de desarrollo, en la pantalla de ejercicio
  activo, toca el botón ● (arriba a la derecha) para empezar a grabar y ■ para
  terminar. Se abre el diálogo de compartir con un JSON
  `{ exerciseId, level, fps, frames: [{ t, lms: [[x,y,z,visibility], …33] }] }`.
  Guárdalo acá como `<exerciseId>_<descripción>.json` (p.ej. `squat_10reps.json`).
- **Cómo usarla en un test:** `loadFixture("squat_10reps.json")` en
  `__tests__/validation/fixtures.ts` la convierte a `Landmark[][]`. Ver
  `__tests__/validation/validators.test.ts`.

Mientras no haya grabaciones reales, los tests usan secuencias sintéticas
generadas por `__tests__/validation/poseFactory.ts`. Al agregar un JSON real,
`validators.test.ts` lo detecta automáticamente y agrega un caso.
