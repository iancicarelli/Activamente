import { calcularAngulo, calcularAngulo2D, distanciaX, distanciaY } from "../../validation/geometry";
import { restBaseline, smooth, stabilizePhase } from "../../validation/stabilize";
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
  test("smooth promedia sobre una ventana de MILISEGUNDOS, no de frames", () => {
    const s = createValidatorState();
    expect(smooth(s, "a", 0, 10, 500)).toBe(10);
    expect(smooth(s, "a", 100, 20, 500)).toBe(15);
    expect(smooth(s, "a", 200, 30, 500)).toBe(20);
    // A 1.25 fps el frame anterior ya quedó fuera de la ventana: no promedia con él.
    expect(smooth(s, "a", 800, 40, 500)).toBe(40);
  });

  test("la misma ventana cubre más frames a más fps (EX-47)", () => {
    const lento = createValidatorState();
    const rapido = createValidatorState();
    for (let i = 0; i < 10; i++) smooth(lento, "a", i * 200, 1, 400); // 5 fps
    for (let i = 0; i < 10; i++) smooth(rapido, "a", i * 40, 1, 400); // 25 fps
    expect(lento.windows.a.v.length).toBeLessThan(rapido.windows.a.v.length);
  });

  test("stabilizePhase exige que la fase se sostenga el tiempo pedido", () => {
    const s = createValidatorState();
    expect(stabilizePhase(s, 0, "descending", 200)).toBe("standing");
    expect(stabilizePhase(s, 100, "hold", 200)).toBe("standing"); // cambió, no confirma
    expect(stabilizePhase(s, 200, "hold", 200)).toBe("standing"); // aún mezclada
    expect(stabilizePhase(s, 300, "hold", 200)).toBe("hold"); // 200 ms sostenidos
  });

  test("restBaseline sigue el reposo de la persona, no un valor fijo (EX-46)", () => {
    const s = createValidatorState();
    // De pie en 170°, con bajadas a 100° (las repeticiones).
    let t = 0;
    for (let i = 0; i < 40; i++, t += 200) restBaseline(s, "r", t, i % 5 === 0 ? 100 : 170, "high");
    expect(restBaseline(s, "r", t, 170, "high")).toBeGreaterThan(160); // las bajadas no arrastran el reposo
  });

  test("restBaseline acompaña la deriva de postura", () => {
    const s = createValidatorState();
    let t = 0;
    for (let i = 0; i < 40; i++, t += 200) restBaseline(s, "r", t, 170, "high");
    const antes = restBaseline(s, "r", t, 170, "high");
    // La persona deja de estirar del todo las piernas: su reposo real baja a 156°.
    for (let i = 0; i < 70; i++, t += 200) restBaseline(s, "r", t, 156, "high");
    const despues = restBaseline(s, "r", t, 156, "high");
    expect(antes).toBeGreaterThan(165);
    expect(despues).toBeLessThan(160);
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
