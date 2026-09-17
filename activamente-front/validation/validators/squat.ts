/**
 * Validador: Sentadilla.
 *
 * Métrica: ángulo de rodilla cadera→rodilla→tobillo del lado visible (o el
 * promedio si se ven ambos). De pie ~170°+. Histéresis 160/152.
 *
 * Niveles (profundidad): 1 → ≤110° (media) · 2 → ≤90° (paralela) · 3 → ≤75° (profunda).
 */

import { ExerciseValidator, Landmark, ValidatorPhase } from "../types";
import { calcularAngulo, distanciaY, promedio } from "../geometry";
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

const STANDING_ENTER_KNEE_ANGLE = 160;
const STANDING_EXIT_KNEE_ANGLE = 152;
const MIN_HIP_ANGLE = 60; // tronco demasiado inclinado
const BACK_ALIGN_TOLERANCE = 0.05;
const SMOOTH_WINDOW = 3;
const PHASE_CONFIRM_FRAMES = 2;

const LEVEL_KNEE_ANGLE: Record<number, number> = { 1: 110, 2: 90, 3: 75 };

type Side = "left" | "right" | "both" | "none";

function visibleSide(lms: Landmark[]): Side {
  const l = LEFT_INDICES.every((i) => lms[i] && lms[i].visibility >= MIN_VISIBILITY);
  const r = RIGHT_INDICES.every((i) => lms[i] && lms[i].visibility >= MIN_VISIBILITY);
  if (l && r) return "both";
  if (l) return "left";
  if (r) return "right";
  return "none";
}

function sided(lms: Landmark[], fn: (s: number, h: number, k: number, a: number) => number): number {
  const side = visibleSide(lms);
  const left = fn(LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE);
  const right = fn(RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE);
  if (side === "right") return right;
  if (side === "both") return promedio(left, right);
  return left;
}

const kneeAngle = (lms: Landmark[]) => sided(lms, (_s, h, k, a) => calcularAngulo(lms[h], lms[k], lms[a]));
const hipAngle = (lms: Landmark[]) => sided(lms, (s, h, k) => calcularAngulo(lms[s], lms[h], lms[k]));

const machine = createPhaseMachine({
  standingEnter: STANDING_ENTER_KNEE_ANGLE,
  standingExit: STANDING_EXIT_KNEE_ANGLE,
  standingIs: "high",
});

const PHASE_FEEDBACK: Record<ValidatorPhase, string> = {
  standing: "Baja flexionando las rodillas",
  descending: "¡Bien! Sigue bajando",
  hold: "¡Buena profundidad!",
  ascending: "Sube despacio",
};

function buildValidator(level: number) {
  const target = LEVEL_KNEE_ANGLE[level] ?? LEVEL_KNEE_ANGLE[1];
  return createStabilizedValidator({
    visibility: (lms) => (visibleSide(lms) === "none" ? "Ponte de perfil, que se vea de los hombros a los tobillos" : null),
    metric: kneeAngle,
    levelReached: (_lms, knee) => knee <= target,
    machine,
    smoothWindow: SMOOTH_WINDOW,
    confirmFrames: PHASE_CONFIRM_FRAMES,
    formRules: (lms) => {
      if (visibleSide(lms) === "both" && distanciaY(lms[LEFT_SHOULDER], lms[RIGHT_SHOULDER]) > BACK_ALIGN_TOLERANCE) {
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
  levels: { 1: buildValidator(1), 2: buildValidator(2), 3: buildValidator(3) },
};
