/**
 * Validador: Shoulder Raises (elevación lateral de brazos).
 *
 * Métrica: ángulo cadera→hombro→codo promedio de ambos brazos. En reposo
 * ~20–40°; en reposo la métrica es BAJA (restIs: 'low'). Bandas 30/20 sobre el reposo.
 *
 * Niveles: 1 → ≥ 85° (hombro) · 2 → ≥ 110° · 3 → ≥ 140° (sobre la cabeza).
 */

import { ExerciseValidator, ValidatorPhase } from "../types";
import { calcularAngulo, promedio } from "../geometry";
import {
  LEFT_ELBOW,
  LEFT_HIP,
  LEFT_SHOULDER,
  LEFT_WRIST,
  RIGHT_ELBOW,
  RIGHT_HIP,
  RIGHT_SHOULDER,
  RIGHT_WRIST,
  UPPER_BODY_INDICES,
} from "../landmarkIndices";
import { allVisible, createStabilizedValidator } from "../stabilize";

const KEY_INDICES = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW, LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP];

// Bandas RELATIVAS al reposo (EX-46). Antes 45/55 absolutos.
const EXIT_BAND = 30; // 55 − 25 (reposo típico, brazos colgando)
const RETURN_BAND = 20; // 45 − 25
// Ventanas en ms (EX-47): a 4.8 fps "3 frames" eran 620 ms y a 25 fps 120.
const SMOOTH_MS = 400;
const CONFIRM_MS = 200;

const ELBOW_STRAIGHT_ANGLE = 150;
const ARM_SYMMETRY_TOLERANCE = 25;

const LEVEL_MIN_ANGLE: Record<number, number> = { 1: 85, 2: 110, 3: 140 };

const PHASE_FEEDBACK: Record<ValidatorPhase, string> = {
  standing: "Levanta los brazos",
  descending: "¡Bien! Sigue subiendo",
  hold: "¡Mantén la posición!",
  ascending: "Baja los brazos lentamente",
};

function buildValidator(level: number) {
  const minAngle = LEVEL_MIN_ANGLE[level] ?? LEVEL_MIN_ANGLE[1];
  return createStabilizedValidator({
    visibility: (lms) => (allVisible(lms, KEY_INDICES) ? null : "Acércate: se deben ver tus brazos y tu cadera"),
    metric: (lms) =>
      promedio(
        calcularAngulo(lms[LEFT_HIP], lms[LEFT_SHOULDER], lms[LEFT_ELBOW]),
        calcularAngulo(lms[RIGHT_HIP], lms[RIGHT_SHOULDER], lms[RIGHT_ELBOW])
      ),
    levelReached: (_lms, arm) => arm >= minAngle,
    restIs: "low",
    exitBand: EXIT_BAND,
    returnBand: RETURN_BAND,
    smoothMs: SMOOTH_MS,
    confirmMs: CONFIRM_MS,
    formRules: (lms) => {
      const elbowL = calcularAngulo(lms[LEFT_SHOULDER], lms[LEFT_ELBOW], lms[LEFT_WRIST]);
      const elbowR = calcularAngulo(lms[RIGHT_SHOULDER], lms[RIGHT_ELBOW], lms[RIGHT_WRIST]);
      if (elbowL <= ELBOW_STRAIGHT_ANGLE || elbowR <= ELBOW_STRAIGHT_ANGLE) return "Estira los codos";
      const armL = calcularAngulo(lms[LEFT_HIP], lms[LEFT_SHOULDER], lms[LEFT_ELBOW]);
      const armR = calcularAngulo(lms[RIGHT_HIP], lms[RIGHT_SHOULDER], lms[RIGHT_ELBOW]);
      if (Math.abs(armL - armR) > ARM_SYMMETRY_TOLERANCE) return "Sube los dos brazos a la misma altura";
      return null;
    },
    phaseFeedback: PHASE_FEEDBACK,
    metricName: "armAngle",
  });
}

export const shoulderRaisesValidator: ExerciseValidator = {
  id: "shoulder_raises",
  maxLevel: 3,
  framingIndices: UPPER_BODY_INDICES,
  view: "front",
  levels: { 1: buildValidator(1), 2: buildValidator(2), 3: buildValidator(3) },
};
