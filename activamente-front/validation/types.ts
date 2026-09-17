/**
 * Tipos compartidos por todo el módulo de validación.
 */

/** Un landmark de MediaPipe BlazePose (x, y ∈ [0,1], y crece hacia abajo). */
export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

/**
 * Fases de una repetición: standing → descending → hold → ascending → standing.
 * La rep se cuenta en la transición confirmada (hold | ascending) → standing.
 */
export type ValidatorPhase = "standing" | "descending" | "hold" | "ascending";

export type ValidatorResult = {
  ok: boolean;
  feedback: string | null;
  repCompleted: boolean;
  phase: ValidatorPhase;
  // Métricas crudas para el HUD de rendimiento (EX-03). Opcional.
  metrics?: Record<string, number>;
};

/**
 * Estado persistente entre frames. TODO el estado vive acá (no en closures),
 * así `useExerciseValidator` lo resetea completo al cambiar de ejercicio,
 * nivel o sesión (EX-06): buffers de suavizado e historial de fases incluidos.
 */
export type ValidatorState = {
  phase: ValidatorPhase;
  prevAngle: number;
  repCount: number;
  buffers: Record<string, number[]>;
  phaseHistory: ValidatorPhase[];
  frames: number;
};

export const createValidatorState = (): ValidatorState => ({
  phase: "standing",
  prevAngle: 180,
  repCount: 0,
  buffers: {},
  phaseHistory: [],
  frames: 0,
});

export type ValidatorFn = (lms: Landmark[], state: ValidatorState) => ValidatorResult;

export type ExerciseValidator = {
  id: string;
  levels: Record<number, ValidatorFn>;
  maxLevel: number;
};
