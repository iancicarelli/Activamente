/**
 * Estabilización temporal compartida por todos los validadores (EX-30).
 *
 *  - smooth(): promedio móvil por métrica (buffer en ValidatorState).
 *  - createPhaseMachine(): máquina standing/descending/hold/ascending con
 *    HISTÉRESIS en el borde de standing (entrar y salir usan umbrales distintos)
 *    para que el ruido de ±5-10° no haga parpadear la fase.
 *  - stabilizePhase(): una fase solo se confirma si se repite N frames seguidos.
 *  - createStabilizedValidator(): arma un ValidatorFn completo a partir de una
 *    configuración declarativa. Los 4 validadores usan esto.
 */

import {
  Landmark,
  ValidatorFn,
  ValidatorPhase,
  ValidatorResult,
  ValidatorState,
} from "./types";
import { isTrackable } from "./landmarkIndices";

export function smooth(state: ValidatorState, key: string, value: number, window: number): number {
  const buf = state.buffers[key] ?? (state.buffers[key] = []);
  buf.push(value);
  if (buf.length > window) buf.shift();
  let sum = 0;
  for (const v of buf) sum += v;
  return sum / buf.length;
}

export function stabilizePhase(state: ValidatorState, raw: ValidatorPhase, confirmFrames: number): ValidatorPhase {
  const history = state.phaseHistory;
  history.push(raw);
  if (history.length > confirmFrames) history.shift();
  if (history.length < confirmFrames) return state.phase;
  const candidate = history[0];
  for (const p of history) if (p !== candidate) return state.phase;
  return candidate;
}

export type PhaseMachineConfig = {
  // Umbral para ENTRAR a standing y para SALIR de standing (histéresis).
  standingEnter: number;
  standingExit: number;
  // 'high': de pie la métrica es ALTA (ángulo de rodilla/tronco ~180).
  // 'low':  de pie la métrica es BAJA (elevación de brazos ~30).
  standingIs: "high" | "low";
};

export type PhaseMachine = (prev: ValidatorPhase, metric: number, levelReached: boolean) => ValidatorPhase;

export function createPhaseMachine({ standingEnter, standingExit, standingIs }: PhaseMachineConfig): PhaseMachine {
  const beyondExit = (m: number) => (standingIs === "high" ? m >= standingExit : m <= standingExit);
  const beyondEnter = (m: number) => (standingIs === "high" ? m > standingEnter : m < standingEnter);
  return (prev, metric, levelReached) => {
    if (prev === "standing") {
      if (beyondExit(metric)) return "standing";
      return levelReached ? "hold" : "descending";
    }
    if (beyondEnter(metric)) return "standing";
    if (levelReached) return "hold";
    if (prev === "hold" || prev === "ascending") return "ascending";
    return "descending";
  };
}

// Visibilidad DURANTE el ejercicio (isTrackable, con histéresis respecto al encuadre).
export function allVisible(lms: Landmark[], indices: number[]): boolean {
  for (const idx of indices) if (!isTrackable(lms[idx], idx)) return false;
  return true;
}

export type Side = "left" | "right" | "both" | "none";

// Qué lado(s) del cuerpo se pueden usar. De perfil, el lado lejano casi nunca
// pasa el umbral; de frente, un giro leve o el brazo tapando la pierna pueden
// ocultar un lado. Los validadores miden con el lado visible o promedian ambos.
export function visibleSide(lms: Landmark[], left: number[], right: number[]): Side {
  const l = allVisible(lms, left);
  const r = allVisible(lms, right);
  if (l && r) return "both";
  if (l) return "left";
  if (r) return "right";
  return "none";
}

// Evalúa `fn` con el lado visible; con ambos, promedia. Con "none" usa el izquierdo
// (los validadores ya devolvieron el mensaje de visibilidad antes de llegar aquí).
export function sidedValue(side: Side, fn: (side: "left" | "right") => number): number {
  if (side === "right") return fn("right");
  if (side === "both") return (fn("left") + fn("right")) / 2;
  return fn("left");
}

export type StabilizedConfig = {
  // Devuelve null si todo se ve; si no, el mensaje de visibilidad.
  visibility: (lms: Landmark[]) => string | null;
  // Métrica principal cruda (antes de suavizar).
  metric: (lms: Landmark[]) => number;
  // ¿Se alcanzó el objetivo del nivel en este frame?
  levelReached: (lms: Landmark[], metric: number) => boolean;
  machine: PhaseMachine;
  smoothWindow: number;
  confirmFrames: number;
  // Reglas de forma: mensaje de error o null. Solo se evalúan fuera de standing
  // y con el buffer de fases lleno.
  formRules: (lms: Landmark[], phase: ValidatorPhase, metric: number) => string | null;
  phaseFeedback: Record<ValidatorPhase, string | null>;
  repFeedback?: string;
  metricName?: string;
  extraMetrics?: (lms: Landmark[]) => Record<string, number>;
};

export function createStabilizedValidator(cfg: StabilizedConfig): ValidatorFn {
  const key = cfg.metricName ?? "metric";
  return (lms: Landmark[], state: ValidatorState): ValidatorResult => {
    state.frames += 1;

    const invisible = lms.length === 0 ? "Asegúrate de estar completamente visible" : cfg.visibility(lms);
    if (invisible) {
      // No avanzar la máquina ni ensuciar los buffers con datos inválidos.
      return { ok: false, feedback: invisible, repCompleted: false, phase: state.phase };
    }

    const raw = cfg.metric(lms);
    const metric = smooth(state, key, raw, cfg.smoothWindow);
    const levelReached = cfg.levelReached(lms, metric);
    const rawPhase = cfg.machine(state.phase, metric, levelReached);
    const phase = stabilizePhase(state, rawPhase, cfg.confirmFrames);
    const metrics = { [key]: metric, raw, ...(cfg.extraMetrics ? cfg.extraMetrics(lms) : {}) };

    if (phase !== "standing" && state.phaseHistory.length >= cfg.confirmFrames) {
      const error = cfg.formRules(lms, phase, metric);
      if (error) {
        state.prevAngle = metric;
        state.phase = phase;
        return { ok: false, feedback: error, repCompleted: false, phase, metrics };
      }
    }

    const repCompleted = phase === "standing" && (state.phase === "hold" || state.phase === "ascending");
    state.prevAngle = metric;
    state.phase = phase;
    if (repCompleted) state.repCount += 1;

    if (repCompleted) {
      return { ok: true, feedback: cfg.repFeedback ?? "¡Repetición completada!", repCompleted, phase, metrics };
    }
    return { ok: true, feedback: cfg.phaseFeedback[phase], repCompleted: false, phase, metrics };
  };
}
