/**
 * Validador: Elevación de pierna (al frente), con máquina de estados (EX-31).
 *
 * Métrica: ángulo hombro→cadera→rodilla de la pierna que se levanta. De pie
 * (pierna abajo) ~170–180°; al elevar la pierna al frente el ángulo BAJA.
 * Histéresis 165/158. Se toma la pierna con menor ángulo (la que sube) cuando
 * se ven ambas; si se ve un solo lado, ese.
 *
 * Niveles (elevación): 1 → ≤150° (30°) · 2 → ≤135° (45°) · 3 → ≤120° (60°).
 */

import { ExerciseValidator, Landmark, ValidatorPhase } from "../types";
import { calcularAngulo, distanciaX } from "../geometry";
import {
  LEFT_ANKLE,
  LEFT_HIP,
  LEFT_KNEE,
  LEFT_SHOULDER,
  MIN_VISIBILITY,
  RIGHT_ANKLE,
  RIGHT_HIP,
  RIGHT_KNEE,
  RIGHT_SHOULDER,
} from "../landmarkIndices";
import { createPhaseMachine, createStabilizedValidator } from "../stabilize";

const LEFT_INDICES = [LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE];
const RIGHT_INDICES = [RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE];

const STANDING_ENTER_HIP_ANGLE = 165;
const STANDING_EXIT_HIP_ANGLE = 158;
const KNEE_STRAIGHT_ANGLE = 150;
const TRUNK_LEAN_TOLERANCE = 0.14; // |hombro.x − cadera.x| normalizado
const SMOOTH_WINDOW = 3;
const PHASE_CONFIRM_FRAMES = 2;

const LEVEL_HIP_ANGLE: Record<number, number> = { 1: 150, 2: 135, 3: 120 };

type Leg = { shoulder: number; hip: number; knee: number; ankle: number };
const LEFT: Leg = { shoulder: LEFT_SHOULDER, hip: LEFT_HIP, knee: LEFT_KNEE, ankle: LEFT_ANKLE };
const RIGHT: Leg = { shoulder: RIGHT_SHOULDER, hip: RIGHT_HIP, knee: RIGHT_KNEE, ankle: RIGHT_ANKLE };

const legVisible = (lms: Landmark[], idx: number[]) => idx.every((i) => lms[i] && lms[i].visibility >= MIN_VISIBILITY);

const hipAngleOf = (lms: Landmark[], leg: Leg) => calcularAngulo(lms[leg.shoulder], lms[leg.hip], lms[leg.knee]);

// Pierna activa: la que está más elevada (menor ángulo de cadera) entre las visibles.
function activeLeg(lms: Landmark[]): Leg | null {
  const l = legVisible(lms, LEFT_INDICES);
  const r = legVisible(lms, RIGHT_INDICES);
  if (l && r) return hipAngleOf(lms, LEFT) <= hipAngleOf(lms, RIGHT) ? LEFT : RIGHT;
  if (l) return LEFT;
  if (r) return RIGHT;
  return null;
}

const machine = createPhaseMachine({
  standingEnter: STANDING_ENTER_HIP_ANGLE,
  standingExit: STANDING_EXIT_HIP_ANGLE,
  standingIs: "high",
});

const PHASE_FEEDBACK: Record<ValidatorPhase, string> = {
  standing: "Eleva una pierna estirada al frente",
  descending: "¡Bien! Sigue subiendo la pierna",
  hold: "¡Mantén la posición!",
  ascending: "Baja la pierna despacio",
};

function buildValidator(level: number) {
  const target = LEVEL_HIP_ANGLE[level] ?? LEVEL_HIP_ANGLE[1];
  return createStabilizedValidator({
    visibility: (lms) => (activeLeg(lms) ? null : "Ponte de perfil, que se vea de los hombros a los tobillos"),
    metric: (lms) => hipAngleOf(lms, activeLeg(lms) ?? LEFT),
    levelReached: (_lms, hip) => hip <= target,
    machine,
    smoothWindow: SMOOTH_WINDOW,
    confirmFrames: PHASE_CONFIRM_FRAMES,
    formRules: (lms) => {
      const leg = activeLeg(lms) ?? LEFT;
      const knee = calcularAngulo(lms[leg.hip], lms[leg.knee], lms[leg.ankle]);
      if (knee < KNEE_STRAIGHT_ANGLE) return "Mantén la pierna estirada";
      if (distanciaX(lms[leg.shoulder], lms[leg.hip]) > TRUNK_LEAN_TOLERANCE) return "No inclines el tronco";
      return null;
    },
    phaseFeedback: PHASE_FEEDBACK,
    metricName: "hipAngle",
  });
}

export const legRaiseValidator: ExerciseValidator = {
  id: "leg_raise",
  maxLevel: 3,
  levels: { 1: buildValidator(1), 2: buildValidator(2), 3: buildValidator(3) },
};
