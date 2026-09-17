import { assessFraming, framingIndicesFor, viewFor } from "../../validation/framing";
import { coverRect } from "../../components/PoseSkeleton";
import { isUsable, BODY_INDICES, LEFT_ANKLE, RIGHT_ANKLE, LEFT_KNEE, RIGHT_KNEE, LEFT_HIP, RIGHT_HIP, NOSE, UPPER_BODY_INDICES } from "../../validation/landmarkIndices";
import { exerciseRegistry } from "../../validation/validators/exerciseRegistry";
import * as P from "./poseFactory";

describe("isUsable", () => {
  test("rechaza puntos fuera del cuadro aunque la visibilidad sea alta", () => {
    expect(isUsable(P.lm(0.5, 0.5))).toBe(true);
    expect(isUsable(P.lm(0.5, 1.08, 0, 0.9))).toBe(false); // pie bajo el borde (caso real del log)
    expect(isUsable(P.lm(-0.1, 0.5))).toBe(false);
    expect(isUsable(P.lm(0.5, 0.5, 0, 0.3))).toBe(false);
    expect(isUsable(undefined)).toBe(false);
  });
});

describe("assessFraming", () => {
  const shift = (lms: ReturnType<typeof P.standing>, idx: number[], dy: number) => lms.map((l, i) => (idx.includes(i) ? { ...l, y: l.y + dy } : l));

  test("cuerpo completo dentro → ok", () => {
    expect(assessFraming(P.standing(), BODY_INDICES)).toEqual({ ok: true, message: "¡Te vemos completo!", hint: null });
  });

  test("sin pose → acercarse a la cámara", () => {
    expect(assessFraming([], BODY_INDICES).message).toMatch(/frente al teléfono/);
  });

  test("pies fuera por abajo → aléjate; con cabeza baja en el cuadro, sugiere inclinar", () => {
    const feetOut = shift(P.standing(), [LEFT_ANKLE, RIGHT_ANKLE], 0.15); // y ≈ 1.10
    const r = assessFraming(feetOut, BODY_INDICES);
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Aléjate hasta que se vean tus pies");
    expect(r.hint).toBeNull(); // nariz en 0.15: sin espacio vacío arriba
    const aimedHigh = shift(feetOut, [NOSE], 0.3); // nariz al 45 %: cámara apuntando alto
    expect(assessFraming(aimedHigh, BODY_INDICES).hint).toMatch(/inclina el teléfono/);
  });

  test("brazos solo necesita el cuerpo superior; sin cadera pide verla", () => {
    const legsOut = shift(P.standing(), [LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE], 0.4);
    expect(assessFraming(legsOut, framingIndicesFor("shoulder_raises")).ok).toBe(true);
    const hipsOut = shift(P.standing(), [LEFT_HIP, RIGHT_HIP, LEFT_KNEE, RIGHT_KNEE, LEFT_ANKLE, RIGHT_ANKLE], 0.5);
    expect(assessFraming(hipsOut, framingIndicesFor("shoulder_raises")).message).toBe("Aléjate hasta que se vea tu cadera");
  });

  test("cabeza cortada arriba", () => {
    const headOut = shift(P.standing(), [NOSE], -0.14); // y ≈ 0.01
    expect(assessFraming(headOut, BODY_INDICES).message).toMatch(/cabeza/);
  });

  test("registro: vista y puntos por ejercicio", () => {
    expect(viewFor("squat")).toBe("side");
    expect(viewFor("shoulder_raises")).toBe("front");
    expect(framingIndicesFor("shoulder_raises")).toEqual(UPPER_BODY_INDICES);
    expect(exerciseRegistry.leg_raise.beta).toBe(true);
    expect(exerciseRegistry.squat.beta).toBeUndefined();
  });
});

describe("coverRect", () => {
  test("vista más alta que el frame: se recortan los lados", () => {
    const r = coverRect(360, 800, 0.75); // frame 3:4 en pantalla 9:20
    expect(r.h).toBe(800);
    expect(r.w).toBe(600);
    expect(r.x).toBe(-120);
    expect(r.y).toBe(0);
  });
  test("vista más ancha que el frame: se recorta arriba/abajo", () => {
    const r = coverRect(400, 400, 0.75);
    expect(r.w).toBeCloseTo(400);
    expect(r.h).toBeCloseTo(533.33, 1);
    expect(r.y).toBeCloseTo(-66.67, 1);
  });
});
