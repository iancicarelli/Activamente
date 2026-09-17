/**
 * Validador: Toe Touch (toque de punta de pies).
 *
 * Métrica: ángulo de tronco hombro→cadera→rodilla (promedio de ambos lados).
 * De pie ~153–167°; al inclinarse baja. Histéresis: sale de standing bajo 148°
 * y vuelve sobre 155°.
 *
 * Niveles (qué tan abajo llegan las muñecas; Y crece hacia abajo):
 *   1 → altura de las rodillas
 *   2 → mitad de la canilla
 *   3 → altura de los tobillos
 */

import { ExerciseValidator, Landmark, ValidatorPhase } from "../types";
import { calcularAngulo, distanciaY, promedio } from "../geometry";
import {
  BODY_INDICES,
  LEFT_ANKLE,
  LEFT_HIP,
  LEFT_KNEE,
  LEFT_SHOULDER,
  LEFT_WRIST,
  NOSE,
  RIGHT_ANKLE,
  RIGHT_HIP,
  RIGHT_KNEE,
  RIGHT_SHOULDER,
  RIGHT_WRIST,
} from "../landmarkIndices";
import { allVisible, createPhaseMachine, createStabilizedValidator } from "../stabilize";

const STANDING_ENTER_HIP_ANGLE = 155;
const STANDING_EXIT_HIP_ANGLE = 148;
const HEAD_CHECK_HIP_ANGLE = 90;
const BACK_ALIGN_TOLERANCE = 0.05;

// El pipeline real corre a ~5-8 fps: ventanas cortas para que la rep no llegue tarde.
const SMOOTH_WINDOW = 3;
const PHASE_CONFIRM_FRAMES = 2;

// Fracción del tramo rodilla→tobillo que deben alcanzar las muñecas por nivel.
const LEVEL_DEPTH: Record<number, number> = { 1: 0, 2: 0.5, 3: 0.9 };

const wristY = (lms: Landmark[]) => promedio(lms[LEFT_WRIST].y, lms[RIGHT_WRIST].y);
const kneeY = (lms: Landmark[]) => promedio(lms[LEFT_KNEE].y, lms[RIGHT_KNEE].y);
const ankleY = (lms: Landmark[]) => promedio(lms[LEFT_ANKLE].y, lms[RIGHT_ANKLE].y);

const machine = createPhaseMachine({
  standingEnter: STANDING_ENTER_HIP_ANGLE,
  standingExit: STANDING_EXIT_HIP_ANGLE,
  standingIs: "high",
});

const PHASE_FEEDBACK: Record<ValidatorPhase, string> = {
  standing: "Inclínate hacia adelante",
  descending: "¡Bien! Sigue bajando",
  hold: "¡Mantén la posición!",
  ascending: "Vuelve arriba lentamente",
};

function buildValidator(level: number) {
  const depth = LEVEL_DEPTH[level] ?? LEVEL_DEPTH[1];
  return createStabilizedValidator({
    visibility: (lms) => (allVisible(lms, BODY_INDICES) ? null : "Aléjate hasta que se vea todo tu cuerpo"),
    metric: (lms) =>
      promedio(
        calcularAngulo(lms[LEFT_SHOULDER], lms[LEFT_HIP], lms[LEFT_KNEE]),
        calcularAngulo(lms[RIGHT_SHOULDER], lms[RIGHT_HIP], lms[RIGHT_KNEE])
      ),
    levelReached: (lms) => {
      const target = kneeY(lms) + depth * Math.max(0, ankleY(lms) - kneeY(lms));
      return wristY(lms) >= target;
    },
    machine,
    smoothWindow: SMOOTH_WINDOW,
    confirmFrames: PHASE_CONFIRM_FRAMES,
    formRules: (lms, _phase, hipAngle) => {
      if (distanciaY(lms[LEFT_SHOULDER], lms[RIGHT_SHOULDER]) > BACK_ALIGN_TOLERANCE) return "Mantén la espalda alineada";
      if (hipAngle < HEAD_CHECK_HIP_ANGLE) {
        const shoulderY = promedio(lms[LEFT_SHOULDER].y, lms[RIGHT_SHOULDER].y);
        if (lms[NOSE].y < shoulderY) return "No levantes la cabeza";
      }
      return null;
    },
    phaseFeedback: PHASE_FEEDBACK,
    metricName: "hipAngle",
    extraMetrics: (lms) => ({ wristY: wristY(lms), kneeY: kneeY(lms) }),
  });
}

export const toeTouchValidator: ExerciseValidator = {
  id: "toe_touch",
  maxLevel: 3,
  levels: { 1: buildValidator(1), 2: buildValidator(2), 3: buildValidator(3) },
};
