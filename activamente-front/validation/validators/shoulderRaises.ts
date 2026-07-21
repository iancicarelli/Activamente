/**
 * Validador: Shoulder Raises (elevación lateral de brazos)
 *
 * Métrica principal: ángulo cadera→hombro→codo en cada lado.
 * Mide cuánto se ha elevado el brazo respecto al tronco.
 *
 *  - En reposo (brazos a los costados): ~20–40°
 *  - Nivel 1 — a la altura del hombro:  >= 85°
 *
 * Máquina de estados (misma lógica que toeTouch):
 *  standing → descending → hold → ascending → standing
 *  La rep se cuenta en la transición (hold | ascending) → standing.
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
  LEFT_ELBOW,
  LEFT_HIP,
  LEFT_SHOULDER,
  LEFT_WRIST,
  MIN_VISIBILITY,
  RIGHT_ELBOW,
  RIGHT_HIP,
  RIGHT_SHOULDER,
  RIGHT_WRIST,
} from '../landmarkIndices';

const KEY_INDICES = [
  LEFT_SHOULDER, RIGHT_SHOULDER,
  LEFT_ELBOW,    RIGHT_ELBOW,
  LEFT_WRIST,    RIGHT_WRIST,
  LEFT_HIP,      RIGHT_HIP,
];

// Por debajo de este ángulo (cadera→hombro→codo) los brazos están en reposo
const STANDING_ARM_ANGLE = 50;

// Los codos deben estar casi rectos durante la elevación
const ELBOW_STRAIGHT_ANGLE = 150;

// Diferencia máxima permitida entre el ángulo del brazo izquierdo y derecho
const ARM_SYMMETRY_TOLERANCE = 25;

// Diferencia vertical máxima entre hombros (detecta inclinación lateral del tronco)
const SHOULDER_ALIGN_TOLERANCE = 0.05;

type LevelTarget = {
  minAngle: number;
  successMsg: string;
};

const LEVEL_TARGETS: Record<number, LevelTarget> = {
  1: {
    minAngle: 85,
    successMsg: '¡Nivel 1 alcanzado!',
  },
};

function allKeyLandmarksVisible(lms: Landmark[]): boolean {
  for (const idx of KEY_INDICES) {
    const lm = lms[idx];
    if (!lm || lm.visibility < MIN_VISIBILITY) return false;
  }
  return true;
}

function nextPhase(
  prev: ValidatorPhase,
  avgArmAngle: number,
  levelReached: boolean,
): ValidatorPhase {
  if (avgArmAngle < STANDING_ARM_ANGLE) return 'standing';
  if (levelReached) return 'hold';
  if (prev === 'hold' || prev === 'ascending') return 'ascending';
  return 'descending';
}

function buildValidator(level: number): ValidatorFn {
  const target = LEVEL_TARGETS[level] ?? LEVEL_TARGETS[1];

  return (lms: Landmark[], state: ValidatorState): ValidatorResult => {
    if (lms.length === 0 || !allKeyLandmarksVisible(lms)) {
      return {
        ok: false,
        feedback: 'Asegúrate de estar completamente visible',
        repCompleted: false,
        phase: state.phase,
      };
    }

    // Ángulo principal: cadera→hombro→codo (qué tan elevado está cada brazo)
    const armAngleL = calcularAngulo(lms[LEFT_HIP],  lms[LEFT_SHOULDER],  lms[LEFT_ELBOW]);
    const armAngleR = calcularAngulo(lms[RIGHT_HIP], lms[RIGHT_SHOULDER], lms[RIGHT_ELBOW]);
    const avgArmAngle = (armAngleL + armAngleR) / 2;

    const levelReached = avgArmAngle >= target.minAngle;
    const phase = nextPhase(state.phase, avgArmAngle, levelReached);

    const formError = (feedback: string): ValidatorResult => {
      state.prevAngle = avgArmAngle;
      state.phase = phase;
      return { ok: false, feedback, repCompleted: false, phase };
    };

    // Las reglas de forma solo aplican cuando el brazo está en movimiento;
    // en reposo (standing) los ángulos naturales del codo pueden ser menores a
    // 150° y dispararían falsos positivos que además bloquean el conteo de reps.
    if (phase !== 'standing') {
      // Regla 1: codos extendidos (hombro→codo→muñeca > 150°)
      const elbowAngleL = calcularAngulo(lms[LEFT_SHOULDER],  lms[LEFT_ELBOW],  lms[LEFT_WRIST]);
      const elbowAngleR = calcularAngulo(lms[RIGHT_SHOULDER], lms[RIGHT_ELBOW], lms[RIGHT_WRIST]);
      if (elbowAngleL <= ELBOW_STRAIGHT_ANGLE || elbowAngleR <= ELBOW_STRAIGHT_ANGLE) {
        return formError('Estira los codos');
      }

      // Regla 2: ambos brazos suben a la misma altura
      if (Math.abs(armAngleL - armAngleR) > ARM_SYMMETRY_TOLERANCE) {
        return formError('Sube los dos brazos a la misma altura');
      }
    }

    // Rep completa: transición a 'standing' desde hold/ascending
    const repCompleted =
      phase === 'standing' &&
      (state.phase === 'hold' || state.phase === 'ascending');

    state.prevAngle = avgArmAngle;
    state.phase = phase;
    if (repCompleted) state.repCount += 1;

    if (repCompleted) {
      return { ok: true, feedback: '¡Repetición completada!', repCompleted, phase };
    }

    switch (phase) {
      case 'standing':
        return { ok: true, feedback: 'Levanta tus brazos', repCompleted, phase };
      case 'descending':
        return { ok: true, feedback: '¡Bien! Sigue subiendo', repCompleted, phase };
      case 'hold':
        return { ok: true, feedback: '¡Mantén la posición!', repCompleted, phase };
      case 'ascending':
        return { ok: true, feedback: 'Baja los brazos lentamente', repCompleted, phase };
    }
  };
}

export const shoulderRaisesValidator: ExerciseValidator = {
  id: 'shoulder_raises',
  levels: {
    1: buildValidator(1),
  },
};
