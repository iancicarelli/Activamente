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

## Logs automáticos (2026-09-17)

En dev, cada ejercicio genera solo un log completo por sí mismo (`validation/exerciseLog.ts`) con el mismo
`frames[].lms` que un fixture, más tiempos nativos, resultado del validador por frame y eventos.
Bajarlos con `scripts/pull-logs.sh` a `validation/__logs__/` (no versionado). Para convertir uno en
fixture: copiar acá solo `{ exerciseId, level, expectedReps, frames: [{t, lms}] }` con el número de
reps que realmente hizo la persona.

`scripts/replay-logs.sh` reproduce todos los logs de `validation/__logs__/` con los validadores actuales
antes de decidir qué convertir en fixture.

## Fixtures reales (2026-09-17, Samsung A32, teléfono en la mesa, nivel 1)

| Archivo | Frames activos | expectedReps | Nota |
| --- | --- | --- | --- |
| `shoulder_raises_2026-09-17_mesa.json` | 190 | 4 | de frente; contó 4 en el teléfono |
| `squat_2026-09-17_perfil_mesa.json` | 220 | 7 | de perfil; tobillo cercano en el borde inferior. El teléfono contó 4 (persona estimó 5-6; el replay muestra 7 bajadas a < 90°) |
| `toe_touch_2026-09-17_frente_mesa.json` | 180 | 6 | de frente, algo girado (lado izquierdo poco visible). El teléfono contó 4 (persona estimó ~7) |
