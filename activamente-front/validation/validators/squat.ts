/**
 * Validador: Sentadilla.
 *
 * Métrica: ángulo de rodilla cadera→rodilla→tobillo del lado visible (o el
 * promedio si se ven ambos). De pie ~170°+. Histéresis 160/152.
 *
 * Niveles (profundidad): 1 → ≤125° (cuarto) · 2 → ≤90° (paralela) · 3 → ≤75° (profunda).
 */

import { ExerciseValidator, Landmark, ValidatorPhase } from "../types";
import { calcularAngulo, distanciaY } from "../geometry";
import {
  LEFT_ANKLE,
  LEFT_HIP,
  LEFT_KNEE,
  LEFT_SHOULDER,
  RIGHT_ANKLE,
  RIGHT_HIP,
  RIGHT_KNEE,
  RIGHT_SHOULDER,
  LOWER_BODY_INDICES,
} from "../landmarkIndices";
import { createStabilizedValidator, sidedValue, visibleSide } from "../stabilize";

const LEFT_INDICES = [LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE];
const RIGHT_INDICES = [RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE];

// Bandas RELATIVAS al reposo de la persona (EX-46). Antes eran 160/152 absolutos,
// y con el reposo real en 156° (1er intento del 2026-09-22) contaba 5 de 14 reps.
const EXIT_BAND = 19; // 171 (reposo típico) − 152
const RETURN_BAND = 11; // 171 − 160
// Ventanas en ms (EX-47): a 4.8 fps "3 frames" eran 620 ms y a 25 fps 120.
const SMOOTH_MS = 400;
const CONFIRM_MS = 200;

const MIN_HIP_ANGLE = 60; // tronco demasiado inclinado
const BACK_ALIGN_TOLERANCE = 0.05;

// Nivel 1 relajado de 110° a 125° el 2026-09-22 (EX-50): con 110 el validador
// contaba 5 de 9 sentadillas reales porque las de 115-130° —cuartos de sentadilla,
// lo típico de un adulto mayor en rehabilitación— quedaban afuera. Con 125 cuenta
// 8 de 9, que es lo que contó la persona. Los niveles 2 y 3 no se tocan: ahí vive
// la progresión.
const LEVEL_KNEE_ANGLE: Record<number, number> = { 1: 125, 2: 90, 3: 75 };

const side = (lms: Landmark[]) => visibleSide(lms, LEFT_INDICES, RIGHT_INDICES);

function sided(lms: Landmark[], fn: (s: number, h: number, k: number, a: number) => number): number {
  return sidedValue(side(lms), (which) =>
    which === "left" ? fn(LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE) : fn(RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE)
  );
}

const kneeAngle = (lms: Landmark[]) => sided(lms, (_s, h, k, a) => calcularAngulo(lms[h], lms[k], lms[a]));
const hipAngle = (lms: Landmark[]) => sided(lms, (s, h, k) => calcularAngulo(lms[s], lms[h], lms[k]));

const PHASE_FEEDBACK: Record<ValidatorPhase, string> = {
  standing: "Baja flexionando las rodillas",
  descending: "¡Bien! Sigue bajando",
  hold: "¡Buena profundidad!",
  ascending: "Sube despacio",
};

function buildValidator(level: number) {
  const target = LEVEL_KNEE_ANGLE[level] ?? LEVEL_KNEE_ANGLE[1];
  return createStabilizedValidator({
    visibility: (lms) => (side(lms) === "none" ? "Ponte de perfil, que se vea de los hombros a los tobillos" : null),
    metric: kneeAngle,
    levelReached: (_lms, knee) => knee <= target,
    restIs: "high",
    exitBand: EXIT_BAND,
    returnBand: RETURN_BAND,
    smoothMs: SMOOTH_MS,
    confirmMs: CONFIRM_MS,
    formRules: (lms) => {
      if (side(lms) === "both" && distanciaY(lms[LEFT_SHOULDER], lms[RIGHT_SHOULDER]) > BACK_ALIGN_TOLERANCE) {
        return "Mantén los hombros alineados";
      }
      if (hipAngle(lms) < MIN_HIP_ANGLE) return "Mantén la espalda más recta al bajar";
      return null;
    },
    phaseFeedback: PHASE_FEEDBACK,
    metricName: "kneeAngle",
    extraMetrics: (lms) => ({ hipAngle: hipAngle(lms) }),
  });
}

export const squatValidator: ExerciseValidator = {
  id: "squat",
  maxLevel: 3,
  framingIndices: [LEFT_SHOULDER, RIGHT_SHOULDER, ...LOWER_BODY_INDICES],
  view: "side",
  levels: { 1: buildValidator(1), 2: buildValidator(2), 3: buildValidator(3) },
};
