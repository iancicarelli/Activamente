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

// MediaPipe "inventa" puntos fuera de la imagen (x o y fuera de [0,1]) a veces con
// visibilidad > 0.5; con el teléfono apoyado en una mesa los pies suelen quedar
// bajo el borde. Un landmark solo es usable si está dentro del cuadro (con margen).
export const FRAME_MARGIN = 0.03;

export const isUsable = (lm: { x: number; y: number; visibility: number } | undefined): boolean =>
  !!lm && lm.visibility >= MIN_VISIBILITY && lm.x >= -FRAME_MARGIN && lm.x <= 1 + FRAME_MARGIN && lm.y >= -FRAME_MARGIN && lm.y <= 1 + FRAME_MARGIN;

// Histéresis de visibilidad (calibrado con logs reales, 2026-09-17): el encuadre
// exige `isUsable` (0.5 y margen 0.03) para EMPEZAR; una vez en el ejercicio, los
// validadores usan `isTrackable`, más tolerante, porque en la sentadilla de perfil
// el tobillo cercano oscila en 0.45-0.49 de visibilidad y en y ≈ 1.0-1.06 (pegado
// al borde inferior) y cada frame descartado perdía una repetición entera.
// MediaPipe sigue dando coordenadas razonables en ese rango.
export const TRACK_MIN_VISIBILITY = 0.3;
export const TRACK_BOTTOM_MARGIN = 0.1; // solo rodillas y tobillos, hacia abajo
const NEAR_FLOOR = new Set([LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE]);

export const isTrackable = (lm: { x: number; y: number; visibility: number } | undefined, index: number): boolean => {
  if (!lm || lm.visibility < TRACK_MIN_VISIBILITY) return false;
  const bottom = NEAR_FLOOR.has(index) ? TRACK_BOTTOM_MARGIN : FRAME_MARGIN;
  return lm.x >= -FRAME_MARGIN && lm.x <= 1 + FRAME_MARGIN && lm.y >= -FRAME_MARGIN && lm.y <= 1 + bottom;
};

/** Cuerpo superior + cadera (brazos): no hace falta ver las piernas. */
export const UPPER_BODY_INDICES = [NOSE, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW, LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP];
export const LOWER_BODY_INDICES = [LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE];

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
