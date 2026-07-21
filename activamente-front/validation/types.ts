/**
 * Tipos compartidos por todo el módulo de validación.
 * Todo validador nuevo (ver `validators/exerciseRegistry.ts`) debe respetar
 * estos contratos.
 */

/**
 * Un landmark de MediaPipe BlazePose.
 * Coordenadas normalizadas: x, y ∈ [0, 1] respecto al frame.
 * `visibility` ∈ [0, 1]; usar `MIN_VISIBILITY` como umbral mínimo.
 */
export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

/**
 * Fases de la máquina de estados de una repetición.
 *  - standing:   posición inicial / final de la rep.
 *  - descending: bajando hacia el objetivo.
 *  - hold:       objetivo alcanzado, manteniendo la pose.
 *  - ascending:  subiendo de vuelta a standing.
 *
 * Una rep se cuenta en la transición (hold | ascending) → standing.
 * Si un ejercicio necesita más fases, ampliar esta unión.
 */
export type ValidatorPhase = 'standing' | 'descending' | 'hold' | 'ascending';

/**
 * Lo que retorna el validador en cada frame.
 *  - ok:           pose válida en este frame.
 *  - feedback:     mensaje en español para el usuario (o null si no hay).
 *  - repCompleted: true SOLO en el frame que cierra una rep.
 *  - phase:        fase resultante tras procesar este frame.
 */
export type ValidatorResult = {
  ok: boolean;
  feedback: string | null;
  repCompleted: boolean;
  phase?: ValidatorPhase;
};

/**
 * Estado persistente entre frames. El hook `useExerciseValidator` lo guarda
 * en un ref y lo pasa por referencia al validador, que puede mutarlo.
 * Se resetea automáticamente al cambiar de ejercicio o nivel.
 */
export type ValidatorState = {
  phase: ValidatorPhase;
  prevAngle: number;
  repCount: number;
};

/** Firma de la función de validación que recibe un frame. */
export type ValidatorFn = (lms: Landmark[], state: ValidatorState) => ValidatorResult;

/**
 * Contrato de un ejercicio registrable.
 *  - id:     identificador único; debe coincidir con la clave en el registry
 *            y con el `exerciseId` que envíe el back.
 *  - levels: una función validadora por nivel de dificultad (mínimo nivel 1).
 */
export type ExerciseValidator = {
  id: string;
  levels: Record<number, ValidatorFn>;
};
