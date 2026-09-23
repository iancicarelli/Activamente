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
  // Fase CRUDA del último frame y desde cuándo se sostiene, en ms. Una fase solo
  // se confirma tras `confirmMs` estable (antes era una lista de N frames, que a
  // 4.8 fps significaba el doble de tiempo que a 25 fps).
  rawPhase: ValidatorPhase;
  rawSince: number;
  frames: number;
  // Estado propio de un validador (banderas, lados, contadores). Se resetea con
  // el resto. Numérico a propósito: `extra` viaja en el mismo objeto plano que
  // el HUD y el log serializan sin ceremonia. Ej.: legElevation guarda qué
  // pierna subió para exigir alternancia.
  extra: Record<string, number>;
  // Ventanas temporales (EX-47): valores con su timestamp, por clave. Reemplazan
  // a los buffers por cantidad de frames, que significaban cosas distintas a
  // 5 fps (620 ms) y a 25 fps (120 ms).
  windows: Record<string, { t: number[]; v: number[] }>;
};

export const createValidatorState = (): ValidatorState => ({
  phase: "standing",
  prevAngle: 180,
  repCount: 0,
  buffers: {},
  rawPhase: "standing",
  rawSince: 0,
  frames: 0,
  extra: {},
  windows: {},
});

// `t` es el instante del frame en ms. Viene del teléfono (Date.now()) o del log
// al reproducirlo, para que el replay sea determinista (scripts/replay-logs.sh).
export type ValidatorFn = (lms: Landmark[], state: ValidatorState, t: number) => ValidatorResult;

export type ExerciseValidator = {
  id: string;
  levels: Record<number, ValidatorFn>;
  maxLevel: number;
  // Landmarks que deben verse antes de empezar (pantalla de encuadre).
  framingIndices: number[];
  // Vista que se le pide al paciente en el encuadre.
  view: "front" | "side";
  // Ejercicio en pruebas: se muestra "Beta" al especialista y al paciente.
  beta?: boolean;
};
