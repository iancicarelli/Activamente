// validation/framing.ts — encuadre antes de empezar (EX-51). El teléfono suele
// estar apoyado en una mesa mirando hacia arriba, así que los pies quedan fuera
// del cuadro por abajo; el aviso más útil casi siempre es "aléjate".
import { Landmark } from "./types";
import { BODY_INDICES, LEFT_ANKLE, LEFT_HIP, LEFT_KNEE, NOSE, RIGHT_ANKLE, RIGHT_HIP, RIGHT_KNEE, isUsable } from "./landmarkIndices";
import { exerciseRegistry } from "./validators/exerciseRegistry";

export type FramingStatus = { ok: boolean; message: string; hint: string | null };

const LOWER = new Set([LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE]);
const EDGE = 0.04;

export const framingIndicesFor = (exerciseId: string): number[] => exerciseRegistry[exerciseId]?.framingIndices ?? BODY_INDICES;
export const viewFor = (exerciseId: string): "front" | "side" => exerciseRegistry[exerciseId]?.view ?? "front";

export function assessFraming(lms: Landmark[], required: number[]): FramingStatus {
  if (lms.length === 0) return { ok: false, message: "Ponte frente al teléfono, a unos dos metros", hint: null };
  const nose = lms[NOSE];
  // La cabeza pegada al borde superior también cuenta como "cortada".
  const headCut = required.includes(NOSE) && isUsable(nose) && nose.y < EDGE;
  const missing = required.filter((i) => !isUsable(lms[i]));
  if (missing.length === 0 && !headCut) return { ok: true, message: "¡Te vemos completo!", hint: null };

  const lowerMissing = missing.filter((i) => LOWER.has(i));
  const belowFrame = lowerMissing.some((i) => lms[i] && lms[i].y > 1 - EDGE);
  const needsFeet = required.includes(LEFT_ANKLE) || required.includes(RIGHT_ANKLE);

  if (lowerMissing.length > 0 && (belowFrame || lowerMissing.length === missing.length)) {
    // Cámara apuntando alto: mucho espacio vacío sobre la cabeza.
    const hint = nose && nose.y > 0.35 ? "o inclina el teléfono un poco hacia abajo" : null;
    return { ok: false, message: needsFeet ? "Aléjate hasta que se vean tus pies" : "Aléjate hasta que se vea tu cadera", hint };
  }
  if (!isUsable(nose) || nose.y < EDGE) return { ok: false, message: "Aléjate un poco: no se ve tu cabeza", hint: null };
  const offSide = missing.some((i) => lms[i] && (lms[i].x < EDGE || lms[i].x > 1 - EDGE));
  if (offSide) return { ok: false, message: "Ponte al centro de la imagen", hint: null };
  return { ok: false, message: "Ponte donde se vea todo tu cuerpo", hint: null };
}
