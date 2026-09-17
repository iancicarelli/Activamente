/**
 * Validador: Shoulder Raises (elevación lateral de brazos).
 *
 * Métrica: ángulo cadera→hombro→codo promedio de ambos brazos. En reposo
 * ~20–40°; de pie la métrica es BAJA (standingIs: 'low'). Histéresis 45/55.
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
} from "../landmarkIndices";
import { allVisible, createPhaseMachine, createStabilizedValidator } from "../stabilize";

const KEY_INDICES = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW, LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP];

const STANDING_ENTER_ARM_ANGLE = 45;
const STANDING_EXIT_ARM_ANGLE = 55;
const ELBOW_STRAIGHT_ANGLE = 150;
const ARM_SYMMETRY_TOLERANCE = 25;
const SMOOTH_WINDOW = 3;
const PHASE_CONFIRM_FRAMES = 2;

const LEVEL_MIN_ANGLE: Record<number, number> = { 1: 85, 2: 110, 3: 140 };

const machine = createPhaseMachine({
  standingEnter: STANDING_ENTER_ARM_ANGLE,
  standingExit: STANDING_EXIT_ARM_ANGLE,
  standingIs: "low",
});

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
    machine,
    smoothWindow: SMOOTH_WINDOW,
    confirmFrames: PHASE_CONFIRM_FRAMES,
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
  levels: { 1: buildValidator(1), 2: buildValidator(2), 3: buildValidator(3) },
};
