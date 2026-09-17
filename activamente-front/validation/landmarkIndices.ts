/**
 * Índices de los landmarks de MediaPipe BlazePose (modelo de 33 puntos).
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 * Usar SIEMPRE estas constantes en los validadores, nunca números mágicos.
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

/** Índices que usan los validadores y el esqueleto (13 puntos). */
export const BODY_INDICES = [
  NOSE,
  LEFT_SHOULDER, RIGHT_SHOULDER,
  LEFT_ELBOW, RIGHT_ELBOW,
  LEFT_WRIST, RIGHT_WRIST,
  LEFT_HIP, RIGHT_HIP,
  LEFT_KNEE, RIGHT_KNEE,
  LEFT_ANKLE, RIGHT_ANKLE,
];
