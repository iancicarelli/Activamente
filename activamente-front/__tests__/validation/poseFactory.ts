// Generador de poses sintéticas (33 landmarks normalizados, vista frontal) para
// testear los validadores sin cámara. Cada helper deforma un esqueleto de pie.
import { Landmark } from "../../validation/types";
import * as I from "../../validation/landmarkIndices";

const rad = (deg: number) => (deg * Math.PI) / 180;

export const lm = (x: number, y: number, z = 0, visibility = 0.99): Landmark => ({ x, y, z, visibility });

export function standing(): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => lm(0.5, 0.5, 0, 0.99));
  lms[I.NOSE] = lm(0.5, 0.15);
  lms[I.LEFT_SHOULDER] = lm(0.4, 0.3);
  lms[I.RIGHT_SHOULDER] = lm(0.6, 0.3);
  lms[I.LEFT_ELBOW] = lm(0.37, 0.45);
  lms[I.RIGHT_ELBOW] = lm(0.63, 0.45);
  lms[I.LEFT_WRIST] = lm(0.36, 0.58);
  lms[I.RIGHT_WRIST] = lm(0.64, 0.58);
  lms[I.LEFT_HIP] = lm(0.43, 0.55);
  lms[I.RIGHT_HIP] = lm(0.57, 0.55);
  lms[I.LEFT_KNEE] = lm(0.43, 0.75);
  lms[I.RIGHT_KNEE] = lm(0.57, 0.75);
  lms[I.LEFT_ANKLE] = lm(0.43, 0.95);
  lms[I.RIGHT_ANKLE] = lm(0.57, 0.95);
  return lms;
}

/** Sentadilla con ángulo de rodilla `knee` (180 = de pie). Tronco erguido. */
export function squat(knee: number): Landmark[] {
  const lms = standing();
  const a = rad(180 - knee);
  for (const [hip, kneeIdx, ankle, shoulder, x] of [
    [I.LEFT_HIP, I.LEFT_KNEE, I.LEFT_ANKLE, I.LEFT_SHOULDER, 0.43],
    [I.RIGHT_HIP, I.RIGHT_KNEE, I.RIGHT_ANKLE, I.RIGHT_SHOULDER, 0.57],
  ] as const) {
    lms[ankle] = lm(x, 0.95);
    lms[kneeIdx] = lm(x, 0.75);
    const hx = x + 0.2 * Math.sin(a);
    const hy = 0.75 - 0.2 * Math.cos(a);
    lms[hip] = lm(hx, hy);
    lms[shoulder] = lm(hx - (x - 0.5) * 0.4 + (x - 0.5) * 0.4, hy - 0.25);
  }
  return lms;
}

/** Toe touch con ángulo de tronco `hip` (180 = erguido) y muñecas a `wristY` (o colgando). */
export function toeTouch(hip: number, wristY?: number): Landmark[] {
  const lms = standing();
  const a = rad(180 - hip);
  for (const [hipIdx, shoulder, wrist, elbow, x] of [
    [I.LEFT_HIP, I.LEFT_SHOULDER, I.LEFT_WRIST, I.LEFT_ELBOW, 0.43],
    [I.RIGHT_HIP, I.RIGHT_SHOULDER, I.RIGHT_WRIST, I.RIGHT_ELBOW, 0.57],
  ] as const) {
    const sx = x + 0.25 * Math.sin(a);
    const sy = 0.55 - 0.25 * Math.cos(a);
    lms[shoulder] = lm(sx, sy);
    lms[elbow] = lm(sx, sy + 0.15);
    lms[wrist] = lm(sx, wristY ?? sy + 0.3);
    lms[hipIdx] = lm(x, 0.55);
  }
  lms[I.NOSE] = lm(0.5 + 0.12 * Math.sin(a), lms[I.LEFT_SHOULDER].y - 0.12 * Math.cos(a));
  return lms;
}

/** Elevación lateral de brazos con ángulo cadera→hombro→codo `arm` (0 = colgando). Codos rectos. */
export function shoulderRaise(arm: number, asymmetry = 0): Landmark[] {
  const lms = standing();
  const place = (shoulder: number, elbow: number, wrist: number, dir: -1 | 1, deg: number) => {
    const s = lms[shoulder];
    const a = rad(deg);
    const ex = s.x + dir * 0.15 * Math.sin(a);
    const ey = s.y + 0.15 * Math.cos(a);
    lms[elbow] = lm(ex, ey);
    lms[wrist] = lm(ex + dir * 0.15 * Math.sin(a), ey + 0.15 * Math.cos(a));
  };
  place(I.LEFT_SHOULDER, I.LEFT_ELBOW, I.LEFT_WRIST, -1, arm);
  place(I.RIGHT_SHOULDER, I.RIGHT_ELBOW, I.RIGHT_WRIST, 1, arm + asymmetry);
  return lms;
}

/** Elevación de la pierna izquierda: ángulo hombro→cadera→rodilla `hip` (180 = abajo). */
export function legRaise(hip: number, kneeBend = 0): Landmark[] {
  const lms = standing();
  const a = rad(180 - hip);
  const h = lms[I.LEFT_HIP];
  const kx = h.x + 0.2 * Math.sin(a);
  const ky = h.y + 0.2 * Math.cos(a);
  lms[I.LEFT_KNEE] = lm(kx, ky);
  const b = rad(180 - hip + kneeBend);
  lms[I.LEFT_ANKLE] = lm(kx + 0.2 * Math.sin(b), ky + 0.2 * Math.cos(b));
  return lms;
}

/**
 * Marcha en el lugar: sube la rodilla `side` a `elevation`, la métrica de
 * legElevation ((cadera.y − rodilla.y) / torso). En `standing()` el torso mide
 * 0.25 (cadera 0.55 − hombro 0.30) y la rodilla está en −0.8.
 */
export function kneeRaise(side: "left" | "right", elevation: number): Landmark[] {
  const lms = standing();
  const torso = 0.25;
  const [hipIdx, kneeIdx, ankleIdx] =
    side === "left" ? [I.LEFT_HIP, I.LEFT_KNEE, I.LEFT_ANKLE] : [I.RIGHT_HIP, I.RIGHT_KNEE, I.RIGHT_ANKLE];
  const hip = lms[hipIdx];
  const kneeY = hip.y - elevation * torso;
  lms[kneeIdx] = lm(hip.x, kneeY);
  lms[ankleIdx] = lm(hip.x, kneeY + 0.2);
  return lms;
}

/**
 * Marcha alternando piernas: `reps` subidas, empezando por `first`. Una rep de
 * legElevation es UNA rodilla, así que cada elevación usa su propia secuencia.
 */
export function marchSequence(reps: number, elevation: number, first: "left" | "right" = "left"): Landmark[][] {
  const out: Landmark[][] = [];
  for (let r = 0; r < reps; r++) {
    const side = r % 2 === 0 ? first : first === "left" ? "right" : "left";
    out.push(...repSequence(1, (t) => kneeRaise(side, lerp(-0.8, elevation, t))));
  }
  return out;
}

/** Ruido determinista ±amp en x/y sobre cada landmark. */
export function jitter(lms: Landmark[], amp: number, seed: number): Landmark[] {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280 - 0.5;
  };
  return lms.map((l) => ({ ...l, x: l.x + rnd() * 2 * amp, y: l.y + rnd() * 2 * amp }));
}

export function invisible(lms: Landmark[], indices: number[], visibility = 0.2): Landmark[] {
  return lms.map((l, i) => (indices.includes(i) ? { ...l, visibility } : l));
}

/**
 * Secuencia de `reps` repeticiones: standing → bajada → hold → subida → standing.
 * `frame(t)` recibe t ∈ [0,1] (0 = de pie, 1 = objetivo).
 */
export function repSequence(reps: number, frame: (t: number) => Landmark[], opts = { hold: 5, steps: 6, rest: 6 }): Landmark[][] {
  const out: Landmark[][] = [];
  const push = (t: number, n = 1) => {
    for (let i = 0; i < n; i++) out.push(frame(t));
  };
  push(0, opts.rest);
  for (let r = 0; r < reps; r++) {
    for (let i = 1; i <= opts.steps; i++) push(i / opts.steps);
    push(1, opts.hold);
    for (let i = opts.steps - 1; i >= 0; i--) push(i / opts.steps);
    push(0, opts.rest);
  }
  return out;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
