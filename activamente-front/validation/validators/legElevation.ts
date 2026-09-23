/**
 * Validador: Elevación de rodillas / marcha en el lugar (EX-59).
 *
 * De FRENTE: la rodilla sube en el plano de la imagen, que es el movimiento que
 * este pipeline detecta mejor a 4-5 fps (EX-48).
 *
 * Es el único validador que no usa `createStabilizedValidator`, porque mide
 * **cada pierna por separado**. La primera versión tomaba `max(izq, der)` contra
 * un umbral global y en la prueba del 2026-09-22 (improvements.md 11.8) eso costó
 * 30 s sin contar: la rodilla izquierda quedó apoyada más alta a mitad de sesión
 * (reposo −0.81 → −0.66) y tapó el regreso a reposo de la derecha, que estaba
 * haciendo ciclos limpios. Cada rodilla se compara ahora contra SU propia línea
 * base, estimada en vivo (EX-46), así que la postura de una pierna no contamina
 * a la otra.
 *
 * Elevación de una pierna, normalizada por el largo del torso:
 *
 *     elevación = (cadera.y − rodilla.y) / (caderaMedia.y − hombroMedia.y)
 *
 * y crece hacia abajo, así que de pie la rodilla está BAJO la cadera y la
 * elevación es negativa (~−0.8); al subir crece hacia 0 (rodilla a la cadera).
 * Se normaliza por el TORSO y no por el muslo a propósito: al levantar la rodilla
 * hacia la cámara el muslo se acorta en la proyección 2D y el cociente mentiría.
 *
 * El ESFUERZO de una pierna es su elevación por encima de su propio reposo. En
 * los logs reales los picos van de 0.70 a 1.13 de esfuerzo.
 * Niveles (2): 1 → ≥ 0.30 (rodilla claramente arriba) · 2 → ≥ 0.80 (a la cadera).
 *
 * UNA REPETICIÓN = UNA RODILLA, y se exige ALTERNAR: dos subidas seguidas de la
 * misma pierna cuentan una sola (la segunda pide cambiar). Así, con `total_reps`
 * = 8 el paciente hace 4 por pierna y el lado débil no queda sin trabajar.
 */

import { ExerciseValidator, Landmark, ValidatorFn, ValidatorPhase, ValidatorResult, ValidatorState } from "../types";
import { distanciaX, promedio } from "../geometry";
import {
  LEFT_HIP,
  LEFT_KNEE,
  LEFT_SHOULDER,
  LOWER_BODY_INDICES,
  RIGHT_HIP,
  RIGHT_KNEE,
  RIGHT_SHOULDER,
} from "../landmarkIndices";
import { allVisible, restBaseline, smooth, stabilizePhase } from "../stabilize";

// Solo lo que la métrica USA. Los tobillos quedan fuera a propósito: exigir
// landmarks que no se miran fue lo que hizo perder reps en toe touch (11.6).
const KEY_INDICES = [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE];

// Bandas de esfuerzo sobre el reposo PROPIO de cada pierna.
const EXIT_BAND = 0.25; // salió de reposo (solo para el feedback)
/**
 * Esfuerzo mínimo para considerar que una pierna SE MOVIÓ, aunque no llegue al
 * objetivo del nivel. La alternancia se mide contra esto y no contra la última
 * rep contada: el 2026-09-22 una subida corta (esfuerzo 0.21) no contó —
 * correcto— pero además dejó `lastCountedSide` en la pierna anterior, así que la
 * siguiente subida buena de la otra pierna parecía "la misma dos veces" y se
 * rechazaba. Una rep corta castigaba dos veces y encadenaba 4 pérdidas seguidas.
 */
const MOVE_BAND = 0.2;
const RETURN_BAND = 0.15; // volvió: cierra el ciclo y cuenta
const TRUNK_LEAN_TOLERANCE = 0.14; // |hombroMedio.x − caderaMedia.x| normalizado
// Largo de torso mínimo creíble (normalizado sobre el alto del cuadro). De frente
// y entero en cuadro da ~0.25. Por debajo de esto los landmarks no sirven: el
// 2026-09-22 el torso llegó a medir **negativo** (caderas por encima de hombros)
// durante los 3 primeros segundos, y con el viejo tope de 1e-3 la división daba
// elevaciones de −134, que superaban el umbral del nivel y contaban reps
// inventadas; además envenenaban la ventana del reposo por 12 s.
const MIN_TORSO = 0.08;

// Ventanas en ms (EX-47): a 4.8 fps "3 frames" eran 620 ms y a 25 fps 120.
const SMOOTH_MS = 400;
const CONFIRM_MS = 200;

// Nivel 1 relajado de 0.40 a 0.30 el 2026-09-22 (EX-50), mismo criterio que la
// sentadilla: una marcha suave de adulto mayor no levanta la rodilla 40 % del
// torso. En los logs reales los picos van de 0.21 a 1.19.
const LEVEL_MIN_EFFORT: Record<number, number> = { 1: 0.3, 2: 0.8 };

// Lados como números: `extra` es Record<string, number>.
const SIDE_NONE = 0;
const SIDE_LEFT = 1;
const SIDE_RIGHT = 2;

const PHASE_FEEDBACK: Record<ValidatorPhase, string> = {
  standing: "Sube una rodilla",
  descending: "¡Bien! Sigue subiendo la rodilla",
  // Sin "mantén la posición": en marcha el hold frena el ritmo y la persona se
  // queda arriba esperando (EX-58, medido en brazos: holds de 4-5 s por rep).
  hold: "¡Arriba! Ahora baja el pie",
  ascending: "Apoya el pie",
};

const REP_FEEDBACK = "¡Muy bien! Ahora la otra rodilla";
const ALTERNATE_FEEDBACK = "Ahora sube la otra rodilla";

/** Puede dar negativo si los landmarks están mal; quien llame debe validarlo. */
const torsoLength = (lms: Landmark[]): number =>
  promedio(lms[LEFT_HIP].y, lms[RIGHT_HIP].y) - promedio(lms[LEFT_SHOULDER].y, lms[RIGHT_SHOULDER].y);

const elevationOf = (lms: Landmark[], hip: number, knee: number, torso: number): number => (lms[hip].y - lms[knee].y) / torso;

function trunkLean(lms: Landmark[]): string | null {
  const shoulderX = promedio(lms[LEFT_SHOULDER].x, lms[RIGHT_SHOULDER].x);
  const hipX = promedio(lms[LEFT_HIP].x, lms[RIGHT_HIP].x);
  return distanciaX({ x: shoulderX }, { x: hipX }) > TRUNK_LEAN_TOLERANCE ? "No inclines el tronco" : null;
}

export function buildValidator(level: number): ValidatorFn {
  const target = LEVEL_MIN_EFFORT[level] ?? LEVEL_MIN_EFFORT[1];

  return (lms: Landmark[], state: ValidatorState, t: number): ValidatorResult => {
    state.frames += 1;

    // Un torso inverosímil es un problema de landmarks, no un dato: se trata como
    // falta de visibilidad para que NO entre a las ventanas ni mueva las fases.
    const torso = lms.length >= 33 ? torsoLength(lms) : 0;
    if (lms.length === 0 || !allVisible(lms, KEY_INDICES) || torso < MIN_TORSO) {
      const msg = lms.length === 0 ? "Asegúrate de estar completamente visible" : "Ponte de frente, que se vean tus hombros, caderas y rodillas";
      return { ok: false, feedback: msg, repCompleted: false, phase: state.phase };
    }

    // Cada rodilla contra su propia línea base.
    const elevL = smooth(state, "elevL", t, elevationOf(lms, LEFT_HIP, LEFT_KNEE, torso), SMOOTH_MS);
    const elevR = smooth(state, "elevR", t, elevationOf(lms, RIGHT_HIP, RIGHT_KNEE, torso), SMOOTH_MS);
    const restL = restBaseline(state, "restL", t, elevL, "low");
    const restR = restBaseline(state, "restR", t, elevR, "low");
    const effortL = elevL - restL;
    const effortR = elevR - restR;

    const leadSide = effortL >= effortR ? SIDE_LEFT : SIDE_RIGHT;
    const leadEffort = Math.max(effortL, effortR);
    const effortOf = (side: number) => (side === SIDE_LEFT ? effortL : effortR);

    // ── Pico + regreso (EX-45), por pierna ────────────────────────────────
    // `moved` sigue a la pierna que salió de reposo aunque quede corta; `armed`
    // solo se enciende si además llega al objetivo del nivel.
    let moved = state.extra.movedSide ?? SIDE_NONE;
    let armed = state.extra.armedSide ?? SIDE_NONE;
    if (moved === SIDE_NONE && leadEffort >= MOVE_BAND) moved = leadSide;
    if (armed === SIDE_NONE && leadEffort >= target) armed = leadSide;

    let repCompleted = false;
    let alternateHint = false;
    if (moved !== SIDE_NONE && effortOf(moved) < RETURN_BAND) {
      if (armed === moved) {
        // Llegó al nivel: cuenta, salvo que sea la misma pierna que la anterior.
        if (moved === (state.extra.lastSide ?? SIDE_NONE)) alternateHint = true;
        else repCompleted = true;
      }
      // La pierna se movió: cuente o no, es la última que trabajó. Así una subida
      // corta no hace que la siguiente de la otra pierna parezca repetida.
      state.extra.lastSide = moved;
      moved = SIDE_NONE;
      armed = SIDE_NONE;
    }
    state.extra.movedSide = moved;
    state.extra.armedSide = armed;

    // ── Fases, solo para el feedback ──────────────────────────────────────
    let rawPhase: ValidatorPhase;
    if (leadEffort < RETURN_BAND) rawPhase = "standing";
    else if (leadEffort >= target) rawPhase = "hold";
    else if (state.phase === "hold" || state.phase === "ascending") rawPhase = "ascending";
    else rawPhase = leadEffort > EXIT_BAND || state.phase !== "standing" ? "descending" : "standing";
    const phase = repCompleted ? "standing" : stabilizePhase(state, t, rawPhase, CONFIRM_MS);

    const metrics = {
      kneeElevation: Math.max(elevL, elevR),
      effort: leadEffort,
      leftKnee: elevL,
      rightKnee: elevR,
      restL,
      restR,
    };

    const lean = phase !== "standing" ? trunkLean(lms) : null;
    state.prevAngle = leadEffort;
    state.phase = phase;
    if (repCompleted) state.repCount += 1;

    if (repCompleted) return { ok: true, feedback: REP_FEEDBACK, repCompleted: true, phase, metrics };
    if (alternateHint) return { ok: true, feedback: ALTERNATE_FEEDBACK, repCompleted: false, phase, metrics };
    if (lean) return { ok: false, feedback: lean, repCompleted: false, phase, metrics };
    return { ok: true, feedback: PHASE_FEEDBACK[phase], repCompleted: false, phase, metrics };
  };
}

export const legElevationValidator: ExerciseValidator = {
  id: "leg_elevation",
  maxLevel: 2,
  // Para EMPEZAR sí se exige el cuerpo entero (encuadre con `isUsable`); durante
  // el ejercicio basta KEY_INDICES con `isTrackable` (histéresis de EX-49).
  framingIndices: [LEFT_SHOULDER, RIGHT_SHOULDER, ...LOWER_BODY_INDICES],
  view: "front",
  levels: { 1: buildValidator(1), 2: buildValidator(2) },
};
