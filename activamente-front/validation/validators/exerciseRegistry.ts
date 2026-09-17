/**
 * ─── Registro de validadores de ejercicios ───────────────────────────────────
 *
 * ÚNICO punto donde se registran los ejercicios. `useExerciseValidator` lee de
 * aquí según el `exerciseId` de la rutina (= exercises.id del backend).
 *
 * ── Cómo agregar un ejercicio ──
 *  1. Crear `validation/validators/<nombre>.ts` usando `createStabilizedValidator`
 *     (ver toeTouch.ts como plantilla): visibilidad → métrica → nivel → máquina
 *     de fases con histéresis → reglas de forma → feedback por fase.
 *  2. Exportar un `ExerciseValidator` { id, maxLevel, levels, framingIndices, view, beta? }.
 *  3. Agregarlo acá con la misma clave que `id`.
 *  4. Backend: fila en seed.sql (mismo slug, max_level) · video en assets/videos ·
 *     VIDEO_MAP en InstructionScreen · fixture en validation/__fixtures__.
 *
 * ── Convenciones ──
 *  - Sin visibilidad → ok:false + mensaje, y NO avanzar la máquina.
 *  - Feedback en español, imperativo, breve, sin emojis.
 *  - Constantes de landmarkIndices.ts, helpers de geometry.ts, umbrales
 *    nombrados al tope del archivo.
 *  - Todo estado en ValidatorState (nada en closures) para que el reset sea total.
 */

import { ExerciseValidator } from "../types";
import { toeTouchValidator } from "./toeTouch";
import { legRaiseValidator } from "./legRaise";
import { shoulderRaisesValidator } from "./shoulderRaises";
import { squatValidator } from "./squat";

export const exerciseRegistry: Record<string, ExerciseValidator> = {
  toe_touch: toeTouchValidator,
  leg_raise: legRaiseValidator,
  shoulder_raises: shoulderRaisesValidator,
  squat: squatValidator,
};

export const maxLevelFor = (exerciseId: string): number => exerciseRegistry[exerciseId]?.maxLevel ?? 1;
export const isBetaExercise = (exerciseId: string): boolean => exerciseRegistry[exerciseId]?.beta === true;
