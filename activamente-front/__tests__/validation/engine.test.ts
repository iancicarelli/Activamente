import { calcularAngulo, calcularAngulo2D, distanciaX, distanciaY } from "../../validation/geometry";
import { createPhaseMachine, smooth, stabilizePhase } from "../../validation/stabilize";
import { createValidatorState } from "../../validation/types";
import { RepQualityTracker } from "../../validation/quality";

describe("geometry", () => {
  const p = (x: number, y: number, z = 0) => ({ x, y, z });
  test("ángulo recto", () => expect(calcularAngulo(p(1, 0), p(0, 0), p(0, 1))).toBeCloseTo(90));
  test("colineal opuesto = 180", () => expect(calcularAngulo(p(-1, 0), p(0, 0), p(1, 0))).toBeCloseTo(180));
  test("colineal mismo lado = 0", () => expect(calcularAngulo(p(1, 0), p(0, 0), p(2, 0))).toBeCloseTo(0));
  test("vector nulo → 0 sin NaN", () => expect(calcularAngulo(p(0, 0), p(0, 0), p(1, 1))).toBe(0));
  test("2D ignora z", () => expect(calcularAngulo2D({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90));
  test("distancias", () => {
    expect(distanciaY({ y: 0.2 }, { y: 0.5 })).toBeCloseTo(0.3);
    expect(distanciaX({ x: 0.9 }, { x: 0.5 })).toBeCloseTo(0.4);
  });
});

describe("stabilize", () => {
  test("smooth promedia con ventana", () => {
    const s = createValidatorState();
    expect(smooth(s, "a", 10, 3)).toBe(10);
    expect(smooth(s, "a", 20, 3)).toBe(15);
    expect(smooth(s, "a", 30, 3)).toBe(20);
    expect(smooth(s, "a", 40, 3)).toBe(30);
    expect(s.buffers.a).toHaveLength(3);
  });

  test("stabilizePhase exige N frames iguales", () => {
    const s = createValidatorState();
    expect(stabilizePhase(s, "descending", 2)).toBe("standing");
    expect(stabilizePhase(s, "hold", 2)).toBe("standing");
    expect(stabilizePhase(s, "hold", 2)).toBe("hold");
  });

  test("máquina 'high' con histéresis", () => {
    const m = createPhaseMachine({ standingEnter: 160, standingExit: 150, standingIs: "high" });
    expect(m("standing", 155, false)).toBe("standing"); // no bajó de exit
    expect(m("standing", 149, false)).toBe("descending");
    expect(m("descending", 155, false)).toBe("descending"); // no superó enter
    expect(m("descending", 161, false)).toBe("standing");
    expect(m("descending", 100, true)).toBe("hold");
    expect(m("hold", 120, false)).toBe("ascending");
    expect(m("ascending", 130, false)).toBe("ascending");
  });

  test("máquina 'low' (brazos)", () => {
    const m = createPhaseMachine({ standingEnter: 45, standingExit: 55, standingIs: "low" });
    expect(m("standing", 50, false)).toBe("standing");
    expect(m("standing", 60, false)).toBe("descending");
    expect(m("descending", 50, false)).toBe("descending");
    expect(m("descending", 40, false)).toBe("standing");
    expect(m("descending", 90, true)).toBe("hold");
  });
});

describe("RepQualityTracker", () => {
  const ok = { ok: true, feedback: null, repCompleted: false, phase: "descending" as const };
  const bad = { ok: false, feedback: "Estira los codos", repCompleted: false, phase: "descending" as const };
  const rep = { ok: true, feedback: "¡Repetición completada!", repCompleted: true, phase: "standing" as const };

  test("rep buena si ≥70% frames ok", () => {
    const t = new RepQualityTracker();
    for (let i = 0; i < 8; i++) t.frame(ok);
    t.frame(bad);
    t.frame(rep);
    expect(t.summary()).toEqual({ accuracy: 100, feedback: null });
  });

  test("rep mala guarda el feedback más frecuente", () => {
    const t = new RepQualityTracker();
    t.frame(ok);
    t.frame(bad);
    t.frame(bad);
    t.frame(rep);
    t.frame(ok);
    t.frame(rep);
    expect(t.summary()).toEqual({ accuracy: 50, feedback: "Estira los codos" });
    expect(t.repCount).toBe(2);
  });

  test("sin reps → null", () => expect(new RepQualityTracker().summary()).toEqual({ accuracy: null, feedback: null }));
});
