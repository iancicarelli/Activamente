/**
 * Hook que resuelve el validador del ejercicio/nivel activo y expone una
 * función `evaluate(landmarks)` para que la pantalla la llame por frame.
 *
 * Detalles importantes:
 *  - El estado del validador vive en un `useRef`, no en `useState`, para no
 *    disparar re-render por frame.
 *  - Al cambiar `exerciseId` o `level` el estado se resetea automáticamente:
 *    nunca se arrastra la fase/contador de un ejercicio anterior.
 *  - Si el `exerciseId` no está registrado en `exerciseRegistry`, `evaluate`
 *    devuelve un NOOP válido (no rompe la pantalla).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Landmark, ValidatorResult, ValidatorState } from './types';
import { exerciseRegistry } from './validators/exerciseRegistry';

const initialState = (): ValidatorState => ({
  phase: 'standing',
  prevAngle: 180,
  repCount: 0,
});

const NOOP_RESULT: ValidatorResult = {
  ok: true,
  feedback: null,
  repCompleted: false,
  phase: 'standing',
};

export function useExerciseValidator(
  exerciseId: string | undefined,
  level: number,
) {
  const stateRef = useRef<ValidatorState>(initialState());

  const validatorFn = useMemo(() => {
    if (!exerciseId) return null;
    const validator = exerciseRegistry[exerciseId];
    if (!validator) return null;
    return validator.levels[level] ?? null;
  }, [exerciseId, level]);

  // Reset al cambiar de ejercicio o nivel: el estado anterior no aplica
  useEffect(() => {
    stateRef.current = initialState();
  }, [exerciseId, level]);

  const evaluate = useCallback(
    (lms: Landmark[]): ValidatorResult => {
      if (!validatorFn) return NOOP_RESULT;
      return validatorFn(lms, stateRef.current);
    },
    [validatorFn],
  );

  return { evaluate };
}
