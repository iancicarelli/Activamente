import {
  ExerciseValidator,
  Landmark,
  ValidatorFn,
  ValidatorResult,
  ValidatorState,
} from '../types';

import { calcularAngulo } from '../geometry';

import {
  LEFT_HIP, 
  LEFT_KNEE, 
  LEFT_ANKLE, 
  LEFT_SHOULDER, 
  MIN_VISIBILITY
} from '../landmarkIndices';

const KEY_INDICES = [LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, LEFT_SHOULDER];

const KNEE_STRAIGHT_ANGLE = 160;
const HIP_LOW_ANGLE = 30;
const HIP_HIGH_ANGLE = 70;

function allKeyLandmarksVisible(lms: Landmark[]): boolean {
  return KEY_INDICES.every(idx => lms[idx] && lms[idx].visibility >= MIN_VISIBILITY);
}

function buildValidator(level: number): ValidatorFn {
    return (lms: Landmark[], state: ValidatorState): ValidatorResult => {
    if (!allKeyLandmarksVisible(lms)) {
      return { ok: false, feedback: "Asegúrate de estar visible", repCompleted: false, phase: state.phase };
    }

    const hip = lms[LEFT_HIP];
    const knee = lms[LEFT_KNEE];
    const ankle = lms[LEFT_ANKLE];
    const shoulder = lms[LEFT_SHOULDER];

    const anguloRodilla = calcularAngulo(hip, knee, ankle);
    const anguloCadera = calcularAngulo(shoulder, hip, knee);

    let feedback: string | null = null;
    let ok = true;

    if (anguloRodilla < KNEE_STRAIGHT_ANGLE) {
      feedback = "Pierna doblada"; ok = false;
    } else if (anguloCadera < HIP_LOW_ANGLE) {
      feedback = "Muy bajo"; ok = false;
    } else if (anguloCadera > HIP_HIGH_ANGLE) {
      feedback = "Demasiado alto"; ok = false;
    } else {
      feedback = "Correcto";
    }

     return { ok, feedback, repCompleted: false, phase: state.phase };

    };

}

export const legRaiseValidator: ExerciseValidator = {
  id: 'leg_raise',
  levels: {
    1: buildValidator(1),
  }
};