/**
 * Validador: Toe Touch (toque de punta de pies).
 *
 * Métrica: ángulo de tronco hombro→cadera→rodilla del lado visible (o el
 * promedio si se ven ambos). De pie ~153–167°; al inclinarse baja. Histéresis:
 * sale de standing bajo 148° y vuelve sobre 155°.
 *
 * Visibilidad por lado (calibrado con logs reales, 2026-09-17): de frente, un
 * giro leve deja el lado lejano en visibilidad 0.1-0.4 mientras el cercano se ve
 * entero; exigir los 13 puntos perdía flexiones completas. Se chequean solo los
 * puntos que se usan (hombro, cadera, rodilla, muñeca; tobillo en nivel 2).
 *
 * Niveles (qué tan abajo llegan las muñecas; Y crece hacia abajo). Pensado para
 * mayores de 60 (2026-09-17): solo dos niveles.
 *   1 → altura de las rodillas
 *   2 → altura de los tobillos
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
  isTrackable,
} from "../landmarkIndices";
import { createStabilizedValidator, Side, sidedValue, visibleSide } from "../stabilize";

// Bandas RELATIVAS al reposo (EX-46). Antes 155/148 absolutos: con el reposo real
// en 153° (2026-09-22) perdía 11 de 16 flexiones por no "volver a estar de pie".
const EXIT_BAND = 17; // 165 (reposo típico) − 148
const RETURN_BAND = 10; // 165 − 155
// Ventanas en ms (EX-47): a 4.8 fps "3 frames" eran 620 ms y a 25 fps 120.
const SMOOTH_MS = 400;
const CONFIRM_MS = 200;

const HEAD_CHECK_HIP_ANGLE = 90;
const BACK_ALIGN_TOLERANCE = 0.05;

// Fracción del tramo rodilla→tobillo que deben alcanzar las muñecas por nivel.
const LEVEL_DEPTH: Record<number, number> = { 1: 0, 2: 0.85 };
// Tolerancia (en Y normalizado, ~5 % del alto del cuadro) por encima del objetivo:
// en los logs reales una flexión a 78° de cadera dejó las manos 0.03 sobre la
// rodilla y no contaba.
const WRIST_TOLERANCE = 0.05;

type Pts = { shoulder: number; hip: number; knee: number; wrist: number; ankle: number };
const LEFT: Pts = { shoulder: LEFT_SHOULDER, hip: LEFT_HIP, knee: LEFT_KNEE, wrist: LEFT_WRIST, ankle: LEFT_ANKLE };
const RIGHT: Pts = { shoulder: RIGHT_SHOULDER, hip: RIGHT_HIP, knee: RIGHT_KNEE, wrist: RIGHT_WRIST, ankle: RIGHT_ANKLE };
const pts = (which: "left" | "right") => (which === "left" ? LEFT : RIGHT);

// Índices requeridos por lado; el tobillo solo cuando el nivel lo usa (depth > 0).
function requiredIndices(p: Pts, depth: number): number[] {
  const base = [p.shoulder, p.hip, p.knee, p.wrist];
  return depth > 0 ? [...base, p.ankle] : base;
}

const hipAngleOf = (lms: Landmark[], p: Pts) => calcularAngulo(lms[p.shoulder], lms[p.hip], lms[p.knee]);
const depthReachedOn = (lms: Landmark[], p: Pts, depth: number) => {
  const knee = lms[p.knee].y;
  const target = knee + depth * Math.max(0, lms[p.ankle].y - knee);
  return lms[p.wrist].y >= target - WRIST_TOLERANCE;
};

const PHASE_FEEDBACK: Record<ValidatorPhase, string> = {
  standing: "Inclínate hacia adelante",
  descending: "¡Bien! Sigue bajando",
  hold: "¡Mantén la posición!",
  ascending: "Vuelve arriba lentamente",
};

function buildValidator(level: number) {
  const depth = LEVEL_DEPTH[level] ?? LEVEL_DEPTH[1];
  const leftIdx = requiredIndices(LEFT, depth);
  const rightIdx = requiredIndices(RIGHT, depth);
  const side = (lms: Landmark[]): Side => visibleSide(lms, leftIdx, rightIdx);
  return createStabilizedValidator({
    visibility: (lms) => (side(lms) === "none" ? "Aléjate hasta que se vea todo tu cuerpo" : null),
    metric: (lms) => sidedValue(side(lms), (which) => hipAngleOf(lms, pts(which))),
    levelReached: (lms) => {
      const s = side(lms);
      // Con ambos lados, basta que uno llegue: las manos suelen ir juntas.
      if (s === "both") return depthReachedOn(lms, LEFT, depth) || depthReachedOn(lms, RIGHT, depth);
      return depthReachedOn(lms, pts(s === "right" ? "right" : "left"), depth);
    },
    restIs: "high",
    exitBand: EXIT_BAND,
    returnBand: RETURN_BAND,
    smoothMs: SMOOTH_MS,
    confirmMs: CONFIRM_MS,
    formRules: (lms, _phase, hipAngle) => {
      const s = side(lms);
      if (s === "both" && distanciaY(lms[LEFT_SHOULDER], lms[RIGHT_SHOULDER]) > BACK_ALIGN_TOLERANCE) return "Mantén la espalda alineada";
      if (hipAngle < HEAD_CHECK_HIP_ANGLE && isTrackable(lms[NOSE], NOSE)) {
        const shoulderY =
          s === "both" ? promedio(lms[LEFT_SHOULDER].y, lms[RIGHT_SHOULDER].y) : lms[pts(s === "right" ? "right" : "left").shoulder].y;
        if (lms[NOSE].y < shoulderY) return "No levantes la cabeza";
      }
      return null;
    },
    phaseFeedback: PHASE_FEEDBACK,
    metricName: "hipAngle",
    extraMetrics: (lms) => {
      const s = side(lms);
      return {
        wristY: sidedValue(s, (which) => lms[pts(which).wrist].y),
        kneeY: sidedValue(s, (which) => lms[pts(which).knee].y),
      };
    },
  });
}

export const toeTouchValidator: ExerciseValidator = {
  id: "toe_touch",
  maxLevel: 2,
  framingIndices: BODY_INDICES,
  view: "front",
  levels: { 1: buildValidator(1), 2: buildValidator(2) },
};
