/**
 * Estabilización temporal compartida por todos los validadores.
 *
 * Reescrito el 2026-09-22 con los logs de la tercera prueba en dispositivo
 * (improvements.md 11.8), que mostraron una sola causa para los tres ejercicios
 * que contaban de menos: **el umbral de "volvió a reposo" era ABSOLUTO y el
 * reposo real de la persona deriva**. Toe touch perdió 11 de 16 flexiones porque
 * su cadera en reposo quedó en 153° y el umbral de vuelta era 155°; la sentadilla
 * contó 5 de 14 con el reposo en 156° contra un umbral de 160°.
 *
 *  - smooth() / stabilizePhase(): ventanas en MILISEGUNDOS, no en frames (EX-47).
 *    A 4.8 fps "3 frames" son 620 ms y a 25 fps serían 120: la misma constante
 *    significaba cosas distintas según el teléfono.
 *  - restBaseline(): reposo estimado POR PERSONA y en vivo (EX-46), como el
 *    percentil sin esfuerzo de los últimos segundos. Absorbe la postura de cada
 *    uno, su deriva durante la sesión y hasta el sesgo de la ropa holgada.
 *  - createStabilizedValidator(): cuenta por **pico + regreso** (EX-45). La rep
 *    se arma cuando la métrica cruza el objetivo del nivel y se cuenta al volver
 *    a la banda de reposo, sin exigir que la fase pase por `hold` confirmado.
 *
 * Las fases (standing/descending/hold/ascending) siguen existiendo, pero ahora
 * solo deciden QUÉ SE LE DICE a la persona; el conteo no depende de ellas.
 */

import { Landmark, ValidatorFn, ValidatorPhase, ValidatorResult, ValidatorState } from "./types";
import { isTrackable } from "./landmarkIndices";

/** Ventana de la que se estima el reposo. Larga a propósito: la deriva es lenta. */
export const REST_WINDOW_MS = 12000;
/** Con menos historia que esto, el reposo todavía es provisorio. */
const REST_WARMUP_MS = 1200;
/** Percentil "sin esfuerzo" dentro de la ventana. */
const REST_PERCENTILE = 0.85;

function pushWindow(state: ValidatorState, key: string, t: number, v: number, spanMs: number) {
  const w = state.windows[key] ?? (state.windows[key] = { t: [], v: [] });
  w.t.push(t);
  w.v.push(v);
  while (w.t.length > 1 && t - w.t[0] > spanMs) {
    w.t.shift();
    w.v.shift();
  }
  return w;
}

/** Promedio móvil sobre los últimos `windowMs`. */
export function smooth(state: ValidatorState, key: string, t: number, value: number, windowMs: number): number {
  const w = pushWindow(state, key, t, value, windowMs);
  let sum = 0;
  for (const v of w.v) sum += v;
  return sum / w.v.length;
}

/**
 * Reposo de ESTA persona (EX-46): el percentil sin esfuerzo de los últimos
 * segundos. `restIs: "high"` (sentadilla, toe touch: de pie el ángulo es grande)
 * mira el extremo alto; `"low"` (brazos, rodillas) el extremo bajo.
 */
export function restBaseline(state: ValidatorState, key: string, t: number, value: number, restIs: "low" | "high"): number {
  const w = pushWindow(state, key, t, value, REST_WINDOW_MS);
  const sorted = [...w.v].sort((a, b) => a - b);
  const span = w.t[w.t.length - 1] - w.t[0];
  // Todavía sin historia suficiente: el reposo es el extremo visto hasta ahora.
  // Arrancamos de pie (el 3-2-1 termina en reposo), así que el extremo sirve.
  if (span < REST_WARMUP_MS) return restIs === "high" ? sorted[sorted.length - 1] : sorted[0];
  const p = restIs === "high" ? REST_PERCENTILE : 1 - REST_PERCENTILE;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

/**
 * Una fase solo se confirma tras sostenerse `confirmMs`.
 *
 * Mide el tiempo desde el último CAMBIO de la fase cruda, no una ventana de
 * frames: con dt (220 ms a 4.8 fps) mayor que `confirmMs`, una ventana recortada
 * a `confirmMs` se queda siempre con un frame, su span es 0 y la fase no se
 * confirma nunca. Eso congelaba el feedback en "de pie" durante toda la rep.
 */
export function stabilizePhase(state: ValidatorState, t: number, raw: ValidatorPhase, confirmMs: number): ValidatorPhase {
  if (state.rawPhase !== raw) {
    state.rawPhase = raw;
    state.rawSince = t;
  }
  return t - state.rawSince >= confirmMs ? raw : state.phase;
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
  /** Devuelve null si todo se ve; si no, el mensaje de visibilidad. */
  visibility: (lms: Landmark[]) => string | null;
  /** Métrica principal cruda (antes de suavizar). */
  metric: (lms: Landmark[]) => number;
  /** ¿Se alcanzó el objetivo del nivel en este frame? */
  levelReached: (lms: Landmark[], metric: number) => boolean;
  /** En reposo la métrica es alta (ángulos de pie) o baja (elevaciones). */
  restIs: "low" | "high";
  /** Separarse del reposo MÁS que esto = salió de reposo (empieza el ciclo). */
  exitBand: number;
  /** Volver a MENOS que esto del reposo = volvió (cierra el ciclo). < exitBand. */
  returnBand: number;
  smoothMs: number;
  confirmMs: number;
  /**
   * Duración mínima de una repetición, de armarse a contarse. Un ciclo más corto
   * es ruido, no una rep: a 4-5 fps una sentadilla real dura 1.1-1.8 s y un pico
   * de uno o dos frames es glitch (improvements.md 11.6). Sin este piso, un log
   * con la cámara mal puesta (rodilla medida de frente, ±30° de ruido entre
   * frames) generaba reps de 0.2 s.
   */
  minRepMs?: number;
  /** Reglas de forma: mensaje de error o null. Solo fuera de reposo. */
  formRules: (lms: Landmark[], phase: ValidatorPhase, metric: number) => string | null;
  phaseFeedback: Record<ValidatorPhase, string | null>;
  repFeedback?: string;
  metricName?: string;
  extraMetrics?: (lms: Landmark[]) => Record<string, number>;
};

// 600 ms. Se probó 800 el 2026-09-22 para descartar también glitches de 2 frames
// y salió peor: brazos cayó de 5 reps a 2 (una elevación de brazos dura ~0.5 s,
// mucho menos que una sentadilla) y la sentadilla perdió una real. El piso corta
// glitches de UN frame; contra los de dos, la defensa correcta es sanear la
// métrica —como el guard de torso de legElevation—, no alargar el piso (EX-63).
export const DEFAULT_MIN_REP_MS = 600;

export function createStabilizedValidator(cfg: StabilizedConfig): ValidatorFn {
  const key = cfg.metricName ?? "metric";
  const minRepMs = cfg.minRepMs ?? DEFAULT_MIN_REP_MS;
  /** Distancia al reposo en la dirección del esfuerzo (siempre ≥ 0 al esforzarse). */
  const effort = (metric: number, rest: number) => (cfg.restIs === "high" ? rest - metric : metric - rest);

  return (lms: Landmark[], state: ValidatorState, t: number): ValidatorResult => {
    state.frames += 1;

    const invisible = lms.length === 0 ? "Asegúrate de estar completamente visible" : cfg.visibility(lms);
    if (invisible) {
      // No avanzar la máquina ni ensuciar los buffers con datos inválidos.
      return { ok: false, feedback: invisible, repCompleted: false, phase: state.phase };
    }

    const raw = cfg.metric(lms);
    const metric = smooth(state, key, t, raw, cfg.smoothMs);
    const rest = restBaseline(state, "rest", t, metric, cfg.restIs);
    const d = effort(metric, rest);
    const levelReached = cfg.levelReached(lms, metric);

    // ── Conteo por pico + regreso (EX-45) ──────────────────────────────────
    // `armed` se enciende al cruzar el objetivo del nivel y se apaga al volver
    // a la banda de reposo, que es el instante en que la rep se cuenta.
    const wasArmed = state.extra.armed === 1;
    if (levelReached && !wasArmed) state.extra.armedAt = t;
    if (levelReached) state.extra.armed = 1;
    const back = d < cfg.returnBand;
    const longEnough = t - (state.extra.armedAt ?? t) >= minRepMs;
    const repCompleted = back && (wasArmed || levelReached) && longEnough;
    if (back) state.extra.armed = 0;

    // ── Fases, solo para el feedback ───────────────────────────────────────
    let rawPhase: ValidatorPhase;
    if (back) rawPhase = "standing";
    else if (levelReached) rawPhase = "hold";
    else if (state.phase === "hold" || state.phase === "ascending") rawPhase = "ascending";
    else rawPhase = d > cfg.exitBand || state.phase !== "standing" ? "descending" : "standing";
    const phase = repCompleted ? "standing" : stabilizePhase(state, t, rawPhase, cfg.confirmMs);

    const metrics = { [key]: metric, raw, rest, ...(cfg.extraMetrics ? cfg.extraMetrics(lms) : {}) };

    if (phase !== "standing") {
      const error = cfg.formRules(lms, phase, metric);
      if (error) {
        state.prevAngle = metric;
        state.phase = phase;
        return { ok: false, feedback: error, repCompleted: false, phase, metrics };
      }
    }

    state.prevAngle = metric;
    state.phase = phase;
    if (repCompleted) state.repCount += 1;

    if (repCompleted) {
      return { ok: true, feedback: cfg.repFeedback ?? "¡Repetición completada!", repCompleted, phase, metrics };
    }
    return { ok: true, feedback: cfg.phaseFeedback[phase], repCompleted: false, phase, metrics };
  };
}
