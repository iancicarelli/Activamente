/**
 * Índices de los landmarks de MediaPipe BlazePose (modelo de 33 puntos).
 *
 * Acá solo están exportados los que se usan hoy. Si tu ejercicio necesita
 * otros puntos (orejas, ojos, dedos, talones), agregalos siguiendo el
 * orden oficial del modelo:
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 *
 * Convención: usar SIEMPRE estas constantes en los validadores, nunca
 * números mágicos como `lms[15]`.
 */
export const NOSE = 0;
export const LEFT_SHOULDER = 11;
export const RIGHT_SHOULDER = 12;
export const LEFT_ELBOW = 13;
export const RIGHT_ELBOW = 14;
export const LEFT_WRIST = 15;
export const RIGHT_WRIST = 16;
export const LEFT_HIP = 23;
export const RIGHT_HIP = 24;
export const LEFT_KNEE = 25;
export const RIGHT_KNEE = 26;
export const LEFT_ANKLE = 27;
export const RIGHT_ANKLE = 28;

/** Visibilidad mínima para considerar válido un landmark. */
export const MIN_VISIBILITY = 0.5;
