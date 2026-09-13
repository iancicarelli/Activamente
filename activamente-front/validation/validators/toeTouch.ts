/**
 * ── Validador de referencia: Toe Touch ───────────────────────────────────────
 *
 * Este archivo sirve de PLANTILLA para los demás validadores. La estructura
 * recomendada es:
 *
 *  1. Importar tipos, helpers (`geometry`) e índices de landmarks.
 *  2. Declarar los landmarks clave del ejercicio en `KEY_INDICES`.
 *  3. Declarar TODOS los umbrales como constantes nombradas al tope (no
 *     dejar números mágicos dentro de la lógica).
 *  4. Definir los objetivos por nivel en un mapa `LEVEL_TARGETS`.
 *  5. Helpers locales: chequeo de visibilidad, máquina de estados.
 *  6. `buildValidator(level)` retorna la `ValidatorFn` para ese nivel:
 *       a. Si faltan landmarks visibles → feedback de visibilidad y salir.
 *       b. Calcular ángulos / métricas relevantes.
 *       c. Calcular la próxima fase con `nextPhase`.
 *       d. Chequear reglas de forma una por una; ante error, usar el helper
 *          `formError` para mantener el estado coherente sin contar la rep.
 *       e. Detectar rep completa SOLO en la transición correcta y
 *          actualizar `state.repCount`.
 *       f. Retornar `ValidatorResult` con feedback informativo si aplica.
 *  7. Exportar un `ExerciseValidator` con `id` único y un validador por nivel.
 *
 * El `id` exportado abajo (`'toe_touch'`) DEBE coincidir con la clave usada
 * en `exerciseRegistry.ts`.
 */

import {
  ExerciseValidator,
  Landmark,
  ValidatorFn,
  ValidatorPhase,
  ValidatorResult,
  ValidatorState,
} from '../types';
import { calcularAngulo, distanciaY } from '../geometry';
import {
  LEFT_ANKLE,
  LEFT_ELBOW,
  LEFT_HIP,
  LEFT_KNEE,
  LEFT_SHOULDER,
  LEFT_WRIST,
  MIN_VISIBILITY,
  NOSE,
  RIGHT_ANKLE,
  RIGHT_ELBOW,
  RIGHT_HIP,
  RIGHT_KNEE,
  RIGHT_SHOULDER,
  RIGHT_WRIST,
} from '../landmarkIndices';

// Log de observabilidad por frame. Dejar en `false` en producción; poner en
// `true` manualmente para inspeccionar ángulos/fases en la consola de Metro.
const DEBUG_LOG = true;

const KEY_INDICES = [
  NOSE,
  LEFT_SHOULDER, RIGHT_SHOULDER,
  LEFT_ELBOW, RIGHT_ELBOW,
  LEFT_WRIST, RIGHT_WRIST,
  LEFT_HIP, RIGHT_HIP,
  LEFT_KNEE, RIGHT_KNEE,
  LEFT_ANKLE, RIGHT_ANKLE,
];

// Umbrales de tronco con HISTÉRESIS: entrar y salir de 'standing' usan valores
// distintos para evitar flickering en el borde. Con un único umbral, un tronco
// que oscila alrededor de 152° (ruido ±5-10°) saltaría standing↔descending en
// frames alternos. Banda muerta de 7°: hay que SUBIR por encima de 155° para
// volver a standing, y BAJAR por debajo de 148° para abandonarlo. Valores
// calibrados con logs reales: de pie MediaPipe reporta hipAngle 153–167°, así
// que un ENTER más bajo hace que más frames de pie califiquen como 'standing'
// y la confirmación de 2 frames se complete antes.
const STANDING_ENTER_HIP_ANGLE = 155;
const STANDING_EXIT_HIP_ANGLE = 148;
const HEAD_CHECK_HIP_ANGLE = 90;
const BACK_ALIGN_TOLERANCE = 0.05;

// ── Estabilización temporal ──────────────────────────────────────────────────
// MediaPipe entrega ~30 fps con landmarks ruidosos (±5-10° en ángulos). Para
// que las reglas no reaccionen a un único frame malo:
//  - SMOOTH_WINDOW: tamaño del promedio móvil de ángulos antes de evaluar.
//  - PHASE_CONFIRM_FRAMES: una transición de fase sólo se confirma si la fase
//    candidata se repite este número de frames consecutivos.
// El pipeline real corre a ~4 fps (detectForVideo ~190ms). Con ventanas grandes
// la confirmación de fase y el suavizado usan frames muy espaciados y la rep se
// siente tarde, así que se redujeron respecto a los valores pensados para 30fps.
const SMOOTH_WINDOW = 3;
const PHASE_CONFIRM_FRAMES = 2;

type LevelTarget = {
  reached: (lms: Landmark[]) => boolean;
};

// Solo existe el nivel 1: las muñecas deben alcanzar la altura de las rodillas
// (Y crece hacia abajo en MediaPipe, por eso wristY >= kneeY).
const LEVEL_TARGETS: Record<number, LevelTarget> = {
  1: {
    reached: (lms) => {
      const wristY = (lms[LEFT_WRIST].y + lms[RIGHT_WRIST].y) / 2;
      const kneeY = (lms[LEFT_KNEE].y + lms[RIGHT_KNEE].y) / 2;
      return wristY >= kneeY;
    },
  },
};

function allKeyLandmarksVisible(lms: Landmark[]): boolean {
  for (const idx of KEY_INDICES) {
    const lm = lms[idx];
    if (!lm || lm.visibility < MIN_VISIBILITY) return false;
  }
  return true;
}

/**
 * Fase "cruda" (sin estabilizar) a partir del ángulo de tronco suavizado.
 * Aplica histéresis sobre el borde de 'standing' usando la fase previa
 * confirmada: si ya estábamos de pie, hace falta caer por debajo de
 * STANDING_EXIT para salir; si no, hace falta superar STANDING_ENTER para
 * volver a entrar. El resultado todavía pasa por la estabilización de N frames.
 */
function rawPhase(
  prev: ValidatorPhase,
  hipAngle: number,
  levelReached: boolean,
): ValidatorPhase {
  if (prev === 'standing') {
    // Para SALIR de standing el tronco debe inclinarse por debajo de EXIT.
    if (hipAngle >= STANDING_EXIT_HIP_ANGLE) return 'standing';
    return levelReached ? 'hold' : 'descending';
  }
  // Para ENTRAR a standing el tronco debe enderezarse por encima de ENTER.
  if (hipAngle > STANDING_ENTER_HIP_ANGLE) return 'standing';
  if (levelReached) return 'hold';
  if (prev === 'hold' || prev === 'ascending') return 'ascending';
  return 'descending';
}

function buildValidator(level: number): ValidatorFn {
  const target = LEVEL_TARGETS[level] ?? LEVEL_TARGETS[1];

  // ── Estado extra del validador, persistente entre frames ───────────────────
  // Vive en el closure (buildValidator se instancia una vez por nivel y
  // persiste), no en ValidatorState, para no romper el contrato de tipos.

  // Buffers circulares para el promedio móvil de cada métrica angular.
  const angleBuffers: Record<string, number[]> = {};
  const smooth = (key: string, value: number): number => {
    const buf = angleBuffers[key] ?? (angleBuffers[key] = []);
    buf.push(value);
    if (buf.length > SMOOTH_WINDOW) buf.shift();
    return buf.reduce((sum, v) => sum + v, 0) / buf.length;
  };

  // Buffer circular de fases crudas para estabilizar las transiciones: sólo se
  // confirma una fase cuando los últimos PHASE_CONFIRM_FRAMES frames coinciden.
  // Un frame ruidoso aislado rompe la racha y no llega a transicionar.
  const phaseHistory: ValidatorPhase[] = [];
  const stabilizePhase = (raw: ValidatorPhase, committed: ValidatorPhase): ValidatorPhase => {
    phaseHistory.push(raw);
    if (phaseHistory.length > PHASE_CONFIRM_FRAMES) phaseHistory.shift();
    if (phaseHistory.length < PHASE_CONFIRM_FRAMES) return committed;
    const candidate = phaseHistory[0];
    for (const p of phaseHistory) {
      if (p !== candidate) return committed; // racha rota ⇒ mantener fase actual
    }
    return candidate; // N frames consecutivos de acuerdo ⇒ confirmar
  };

  return (lms: Landmark[], state: ValidatorState): ValidatorResult => {
    if (lms.length === 0 || !allKeyLandmarksVisible(lms)) {
      return {
        ok: false,
        feedback: 'Asegúrate de estar completamente visible',
        repCompleted: false,
        phase: state.phase,
      };
    }

    // Ángulos de tronco: hombro→cadera→rodilla (promedio de ambos lados),
    // suavizado con promedio móvil antes de evaluar fase y reglas de forma.
    const hipAngleL = calcularAngulo(lms[LEFT_SHOULDER], lms[LEFT_HIP], lms[LEFT_KNEE]);
    const hipAngleR = calcularAngulo(lms[RIGHT_SHOULDER], lms[RIGHT_HIP], lms[RIGHT_KNEE]);
    const hipAngle = smooth('hip', (hipAngleL + hipAngleR) / 2);

    const levelReached = target.reached(lms);

    // Fase cruda (con histéresis) → estabilizada por N frames consecutivos.
    const raw = rawPhase(state.phase, hipAngle, levelReached);
    const phase = stabilizePhase(raw, state.phase);

    // Log de observabilidad: hipAngle suavizado, fase confirmada vs cruda, nivel
    // y las coordenadas Y de muñecas/rodillas para diagnosticar levelReached
    // (recordar: Y crece hacia abajo, levelReached requiere wristY >= kneeY).
    if (DEBUG_LOG) {
      const wristY = (lms[LEFT_WRIST].y + lms[RIGHT_WRIST].y) / 2;
      const kneeY = (lms[LEFT_KNEE].y + lms[RIGHT_KNEE].y) / 2;
      console.log('[toeTouch]', {
        hipAngle: hipAngle.toFixed(1),
        wristY: wristY.toFixed(3),
        kneeY: kneeY.toFixed(3),
        phase,
        raw,
        levelReached,
      });
    }

    // Helper para early-returns por errores de forma: mantiene state coherente
    // sin contar la rep, y avanza phase normalmente.
    const formError = (feedback: string): ValidatorResult => {
      state.prevAngle = hipAngle;
      state.phase = phase;
      return { ok: false, feedback, repCompleted: false, phase };
    };

    // ── Reglas de forma ────────────────────────────────────────────────────────
    // NINGUNA regla de forma se evalúa en 'standing': de pie el único feedback
    // válido es 'Inclínate hacia adelante'. Además, no evaluamos forma hasta que
    // el buffer de estabilización está LLENO (phaseHistory.length >=
    // PHASE_CONFIRM_FRAMES): en los primeros frames la fase aún no es fiable
    // (puede reportar 'descending' con el usuario de pie) y el promedio móvil de
    // los ángulos todavía no refleja la posición real.
    //
    // NOTA: las reglas de "brazos extendidos" y "rodillas rectas" fueron
    // ELIMINADAS por mediciones reales. Brazos: en posición natural el ángulo es
    // ~115–125° y solo supera 150° si se estiran activamente; en un toque de
    // punta de pies cuelgan libres. Rodillas: de perfil MediaPipe distorsiona el
    // ángulo (kneeAngleL 97–115° con rodillas visualmente rectas), así que el
    // umbral de 130° bloqueaba la bajada con falsos 'Dobla menos las rodillas'.
    if (phase !== 'standing' && phaseHistory.length >= PHASE_CONFIRM_FRAMES) {
      // Regla 2: espalda alineada (hombros a la misma altura, tolerancia normalizada)
      if (distanciaY(lms[LEFT_SHOULDER], lms[RIGHT_SHOULDER]) > BACK_ALIGN_TOLERANCE) {
        return formError('Mantén la espalda alineada');
      }

      // Regla 3: cabeza alineada (sólo durante la bajada profunda, hipAngle < 90)
      if (hipAngle < HEAD_CHECK_HIP_ANGLE) {
        const shoulderY = (lms[LEFT_SHOULDER].y + lms[RIGHT_SHOULDER].y) / 2;
        // Y crece hacia abajo: nariz "por encima" de hombros ⇒ nose.y < shoulder.y
        if (lms[NOSE].y < shoulderY) {
          return formError('No levantes la cabeza');
        }
      }
    }

    // Rep completa: transición CONFIRMADA a 'standing' desde hold/ascending.
    // Como `phase` ya está estabilizada por N frames, la rep no se cuenta por un
    // frame suelto que pareció enderezar el tronco.
    const repCompleted =
      phase === 'standing' &&
      (state.phase === 'hold' || state.phase === 'ascending');

    state.prevAngle = hipAngle;
    state.phase = phase;
    if (repCompleted) state.repCount += 1;

    if (repCompleted) {
      return { ok: true, feedback: '¡Repetición completada!', repCompleted, phase };
    }

    switch (phase) {
      case 'standing':
        return { ok: true, feedback: 'Inclínate hacia adelante', repCompleted, phase };
      case 'descending':
        return { ok: true, feedback: '¡Bien! Sigue bajando', repCompleted, phase };
      case 'hold':
        return { ok: true, feedback: '¡Mantén la posición!', repCompleted, phase };
      case 'ascending':
        return { ok: true, feedback: 'Vuelve arriba lentamente', repCompleted, phase };
      default:
        return { ok: true, feedback: null, repCompleted, phase };
    }
  };
}

export const toeTouchValidator: ExerciseValidator = {
  id: 'toe_touch',
  levels: {
    1: buildValidator(1),
  },
};
