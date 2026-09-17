// components/PoseSkeleton.tsx — overlay SVG del esqueleto. Los landmarks viven
// en el estado INTERNO y se actualizan por ref (update()), así un frame nuevo
// re-renderiza solo este componente y nunca la pantalla (EX-05).
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { Landmark } from "../validation/types";
import { MIN_VISIBILITY } from "../validation/landmarkIndices";

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

export const PoseSkeleton = React.memo(
  forwardRef<PoseSkeletonHandle, { width: number; height: number }>(function PoseSkeleton({ width, height }, ref) {
    const [landmarks, setLandmarks] = useState<Landmark[]>([]);
    useImperativeHandle(ref, () => ({ update: (lms) => setLandmarks(lms) }), []);

    if (landmarks.length === 0 || width === 0) return null;
    // El bitmap llega rotado a portrait desde Kotlin; solo espejo selfie en X.
    const sx = (lm: Landmark) => (1 - lm.x) * width;
    const sy = (lm: Landmark) => lm.y * height;

    return (
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        {CONNECTIONS.map(([a, b]) => {
          const lA = landmarks[a];
          const lB = landmarks[b];
          if (!lA || !lB || lA.visibility < MIN_VISIBILITY || lB.visibility < MIN_VISIBILITY) return null;
          return <Line key={`l-${a}-${b}`} x1={sx(lA)} y1={sy(lA)} x2={sx(lB)} y2={sy(lB)} stroke="#00E5FF" strokeWidth={3} strokeLinecap="round" />;
        })}
        {DRAW_INDICES.map((i) => {
          const lm = landmarks[i];
          if (!lm || lm.visibility < MIN_VISIBILITY) return null;
          return <Circle key={`p-${i}`} cx={sx(lm)} cy={sy(lm)} r={6} fill="#76FF03" stroke="#fff" strokeWidth={1} />;
        })}
      </Svg>
    );
  })
);
