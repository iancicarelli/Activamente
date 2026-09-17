// components/PoseSkeleton.tsx — overlay SVG del esqueleto. Los landmarks viven
// en el estado INTERNO y se actualizan por ref (update()), así un frame nuevo
// re-renderiza solo este componente y nunca la pantalla (EX-05).
// La cámara dibuja el frame en modo "cover": el frame (ancho/alto = frameAspect)
// se escala hasta llenar la vista y lo que sobra se recorta centrado. Acá se
// aplica la misma transformación para que los puntos caigan sobre el cuerpo.
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { Landmark } from "../validation/types";
import { isUsable } from "../validation/landmarkIndices";

const CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
];
const DRAW_INDICES: number[] = Array.from(new Set([0, ...CONNECTIONS.flat()]));

export type PoseSkeletonHandle = { update: (lms: Landmark[]) => void };

/** Rectángulo (en px de la vista) que ocupa el frame dibujado en modo cover. */
export function coverRect(viewW: number, viewH: number, frameAspect: number) {
  const scale = Math.max(viewW / frameAspect, viewH); // frame normalizado: ancho = aspect, alto = 1
  const w = frameAspect * scale;
  const h = scale;
  return { x: (viewW - w) / 2, y: (viewH - h) / 2, w, h };
}

export const PoseSkeleton = React.memo(
  forwardRef<PoseSkeletonHandle, { width: number; height: number; frameAspect?: number }>(function PoseSkeleton({ width, height, frameAspect = 0.75 }, ref) {
    const [landmarks, setLandmarks] = useState<Landmark[]>([]);
    useImperativeHandle(ref, () => ({ update: (lms) => setLandmarks(lms) }), []);

    if (landmarks.length === 0 || width === 0) return null;
    // El bitmap llega rotado a portrait desde Kotlin; espejo selfie en X + recorte cover.
    const r = coverRect(width, height, frameAspect);
    const sx = (lm: Landmark) => r.x + (1 - lm.x) * r.w;
    const sy = (lm: Landmark) => r.y + lm.y * r.h;

    return (
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        {CONNECTIONS.map(([a, b]) => {
          const lA = landmarks[a];
          const lB = landmarks[b];
          if (!isUsable(lA) || !isUsable(lB)) return null;
          return <Line key={`l-${a}-${b}`} x1={sx(lA)} y1={sy(lA)} x2={sx(lB)} y2={sy(lB)} stroke="#00E5FF" strokeWidth={3} strokeLinecap="round" />;
        })}
        {DRAW_INDICES.map((i) => {
          const lm = landmarks[i];
          if (!isUsable(lm)) return null;
          return <Circle key={`p-${i}`} cx={sx(lm)} cy={sy(lm)} r={6} fill="#76FF03" stroke="#fff" strokeWidth={1} />;
        })}
      </Svg>
    );
  })
);
