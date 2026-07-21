/**
 * ─── Registro de validadores de ejercicios ───────────────────────────────────
 *
 * Este archivo es el ÚNICO punto donde se registran los ejercicios disponibles.
 * El hook `useExerciseValidator` lee de aquí para resolver qué validador usar
 * según el `exerciseId` que viene de la rutina del paciente.
 *
 * ── Cómo agregar un nuevo ejercicio ──────────────────────────────────────────
 *
 * 1. Crear un archivo nuevo en `validation/validators/` (ej: `squat.ts`).
 *    Usar `toeTouch.ts` como plantilla de referencia.
 *
 * 2. Implementar un `ExerciseValidator` (ver `types.ts`) que exponga:
 *      - `id`: string único, debe coincidir con el `exerciseId` que el back
 *        enviará en la rutina (ej: 'squat', 'arm_raise', etc.).
 *      - `levels`: un `Record<number, ValidatorFn>` con una función por nivel
 *        de dificultad. Mínimo nivel 1.
 *
 * 3. Cada `ValidatorFn` recibe:
 *      - `lms: Landmark[]` → los 33 landmarks que devuelve MediaPipe BlazePose.
 *      - `state: ValidatorState` → estado mutable persistente entre frames
 *        (fase actual, ángulo previo, contador de reps). El validador puede
 *        y debe modificar `state` para llevar la máquina de estados.
 *
 *    Y retorna un `ValidatorResult`:
 *      - `ok`: true si la pose es válida en este frame.
 *      - `feedback`: mensaje en español a mostrar al usuario, o null.
 *      - `repCompleted`: true SOLO en el frame en que se completa una rep.
 *      - `phase`: fase actual de la máquina de estados (opcional).
 *
 * 4. Importar el validador en este archivo y agregarlo al `exerciseRegistry`
 *    usando como clave el mismo `id` que se definió en el paso 2.
 *
 * ── Convenciones que TODOS los validadores deben respetar ────────────────────
 *
 *  - Validar siempre primero la visibilidad de los landmarks clave. Si falta
 *    visibilidad, retornar `ok: false` con feedback explicando que el cuerpo
 *    no se ve completo, y NO avanzar la máquina de estados.
 *
 *  - Los mensajes de feedback van en español, en forma imperativa y breves
 *    (ej: 'Estira los brazos', 'Dobla menos las rodillas'). Sin emojis.
 *
 *  - Usar las constantes de `landmarkIndices.ts` en lugar de números mágicos.
 *    Si necesitan un landmark que no está exportado todavía, agregarlo ahí.
 *
 *  - Usar los helpers de `geometry.ts` (`calcularAngulo`, `distanciaY`) en
 *    lugar de reimplementar trigonometría. Si necesitan un helper nuevo,
 *    agregarlo a `geometry.ts` para que sea reutilizable.
 *
 *  - Solo incrementar `state.repCount` en la transición que cuenta como rep
 *    completa. Ver el patrón en `toeTouch.ts` (transición hold/ascending →
 *    standing).
 *
 *  - Los umbrales (ángulos, tolerancias) van como constantes nombradas al
 *    tope del archivo del validador, no inline en el código.
 */

import { ExerciseValidator } from '../types';
import { toeTouchValidator } from './toeTouch';
import { legRaiseValidator } from './legRaise';
import { shoulderRaisesValidator } from './shoulderRaises';
import { squatValidator } from './squat';

export const exerciseRegistry: Record<string, ExerciseValidator> = {
  toe_touch: toeTouchValidator,
  leg_raise: legRaiseValidator,
  shoulder_raises: shoulderRaisesValidator,
  squat: squatValidator,
  // Agregar nuevos ejercicios aquí. La clave debe ser el `id` del validador.
  // Ejemplos pendientes:
  //   arm_raise: armRaiseValidator,
};
