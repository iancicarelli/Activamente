/**
 * Hook que resuelve el validador del ejercicio/nivel activo y expone
 * `evaluate(landmarks)` para llamarla por frame.
 *
 *  - El estado vive en un `useRef` (no re-render por frame).
 *  - Al cambiar `exerciseId`, `level` o `resetKey` el estado se recrea ENTERO
 *    (fase, contador, buffers de suavizado e historial de fases) (EX-06).
 *  - Si el exerciseId no está registrado, `evaluate` devuelve un NOOP válido.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { createValidatorState, Landmark, ValidatorResult, ValidatorState } from "./types";
import { exerciseRegistry } from "./validators/exerciseRegistry";

const NOOP_RESULT: ValidatorResult = { ok: true, feedback: null, repCompleted: false, phase: "standing" };

export function useExerciseValidator(exerciseId: string | undefined, level: number, resetKey: string | number = 0) {
  const stateRef = useRef<ValidatorState>(createValidatorState());

  const validatorFn = useMemo(() => {
    if (!exerciseId) return null;
    const validator = exerciseRegistry[exerciseId];
    if (!validator) return null;
    const lvl = Math.min(Math.max(1, level), validator.maxLevel);
    return validator.levels[lvl] ?? validator.levels[1] ?? null;
  }, [exerciseId, level]);

  useEffect(() => {
    stateRef.current = createValidatorState();
  }, [exerciseId, level, resetKey]);

  const reset = useCallback(() => {
    stateRef.current = createValidatorState();
  }, []);

  const evaluate = useCallback(
    (lms: Landmark[], t: number = Date.now()): ValidatorResult => {
      if (!validatorFn) return NOOP_RESULT;
      return validatorFn(lms, stateRef.current, t);
    },
    [validatorFn]
  );

  return { evaluate, reset, isRegistered: validatorFn !== null };
}
