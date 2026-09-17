// Tests de los validadores con secuencias sintéticas (TS-11 / EX-34) y, si
// existen, con fixtures reales de validation/__fixtures__.
import { exerciseRegistry } from "../../validation/validators/exerciseRegistry";
import { createValidatorState, Landmark, ValidatorState } from "../../validation/types";
import { BODY_INDICES } from "../../validation/landmarkIndices";
import * as P from "./poseFactory";
import { listFixtures, loadFixture } from "./fixtures";

function run(exerciseId: string, level: number, frames: Landmark[][], state: ValidatorState = createValidatorState()) {
  const fn = exerciseRegistry[exerciseId].levels[level];
  const results = frames.map((f) => fn(f, state));
  return { reps: state.repCount, results, state };
}

const cases: { id: string; level: number; frame: (t: number) => Landmark[]; edge: (t: number) => Landmark[] }[] = [
  { id: "squat", level: 1, frame: (t) => P.squat(P.lerp(178, 100, t)), edge: (t) => P.squat(P.lerp(178, 154, t)) },
  { id: "squat", level: 3, frame: (t) => P.squat(P.lerp(178, 70, t)), edge: (t) => P.squat(P.lerp(178, 154, t)) },
  { id: "toe_touch", level: 1, frame: (t) => P.toeTouch(P.lerp(175, 95, t)), edge: (t) => P.toeTouch(P.lerp(175, 150, t)) },
  { id: "shoulder_raises", level: 1, frame: (t) => P.shoulderRaise(P.lerp(25, 95, t)), edge: (t) => P.shoulderRaise(P.lerp(25, 53, t)) },
  { id: "shoulder_raises", level: 3, frame: (t) => P.shoulderRaise(P.lerp(25, 150, t)), edge: (t) => P.shoulderRaise(P.lerp(25, 53, t)) },
  { id: "leg_raise", level: 1, frame: (t) => P.legRaise(P.lerp(178, 140, t)), edge: (t) => P.legRaise(P.lerp(178, 160, t)) },
  { id: "leg_raise", level: 3, frame: (t) => P.legRaise(P.lerp(178, 110, t)), edge: (t) => P.legRaise(P.lerp(178, 160, t)) },
];

describe.each(cases)("$id nivel $level", ({ id, level, frame, edge }) => {
  test("10 repeticiones completas → repCount === 10", () => {
    expect(run(id, level, P.repSequence(10, frame)).reps).toBe(10);
  });

  test("con ruido de ±0.01 cuenta al menos 9 de 10 y nunca de más", () => {
    const frames = P.repSequence(10, frame).map((f, i) => P.jitter(f, 0.01, i + 1));
    const reps = run(id, level, frames).reps;
    expect(reps).toBeGreaterThanOrEqual(9);
    expect(reps).toBeLessThanOrEqual(10);
  });

  test("oscilar en el borde de 'standing' no cuenta (histéresis)", () => {
    expect(run(id, level, P.repSequence(10, edge)).reps).toBe(0);
  });

  test("sin visibilidad no avanza la fase ni cuenta", () => {
    const frames = P.repSequence(3, frame).map((f) => P.invisible(f, BODY_INDICES));
    const { reps, results, state } = run(id, level, frames);
    expect(reps).toBe(0);
    expect(state.phase).toBe("standing");
    expect(results.every((r) => !r.ok && r.feedback)).toBe(true);
  });

  test("lista vacía de landmarks → ok:false con feedback", () => {
    const r = exerciseRegistry[id].levels[level]([], createValidatorState());
    expect(r.ok).toBe(false);
    expect(r.repCompleted).toBe(false);
  });

  test("la segunda sesión arranca limpia (estado nuevo, sin buffers viejos)", () => {
    const first = run(id, level, P.repSequence(2, frame));
    expect(first.reps).toBe(2);
    const second = run(id, level, P.repSequence(1, frame));
    expect(second.reps).toBe(1);
    expect(second.state.frames).toBe(P.repSequence(1, frame).length);
  });
});

describe("niveles", () => {
  test("media sentadilla no cuenta en nivel 3 pero sí en nivel 1", () => {
    const seq = P.repSequence(5, (t) => P.squat(P.lerp(178, 105, t)));
    expect(run("squat", 1, seq).reps).toBe(5);
    expect(run("squat", 3, seq).reps).toBe(0);
  });

  test("brazos a la altura del hombro no cuentan en nivel 3", () => {
    const seq = P.repSequence(5, (t) => P.shoulderRaise(P.lerp(25, 95, t)));
    expect(run("shoulder_raises", 3, seq).reps).toBe(0);
  });

  test("toe touch: nivel 3 exige muñecas a los tobillos", () => {
    const knees = (t: number) => P.toeTouch(P.lerp(175, 95, t), P.lerp(0.6, 0.8, t));
    const ankles = (t: number) => P.toeTouch(P.lerp(175, 95, t), P.lerp(0.6, 0.94, t));
    expect(run("toe_touch", 3, P.repSequence(3, knees)).reps).toBe(0);
    expect(run("toe_touch", 3, P.repSequence(3, ankles)).reps).toBe(3);
  });

  test("maxLevel expuesto por cada validador", () => {
    for (const v of Object.values(exerciseRegistry)) {
      expect(v.maxLevel).toBeGreaterThanOrEqual(1);
      expect(Object.keys(v.levels).length).toBe(v.maxLevel);
    }
  });
});

describe("reglas de forma", () => {
  // Las reglas de forma dan feedback pero NO bloquean el conteo: la calidad por
  // rep la registra RepQualityTracker (EX-35) y va al accuracy_score.
  test("shoulder raises: codos doblados → 'Estira los codos'", () => {
    const bent = (t: number) => {
      const f = P.shoulderRaise(P.lerp(25, 95, t));
      f[15] = { ...f[15], y: f[13].y - 0.02, x: f[13].x + 0.1 }; // muñeca izquierda hacia arriba: codo ~90°
      return f;
    };
    const { results } = run("shoulder_raises", 1, P.repSequence(3, bent));
    expect(results.some((r) => r.feedback === "Estira los codos")).toBe(true);
    expect(results.filter((r) => !r.ok).length).toBeGreaterThan(3);
  });

  test("shoulder raises: brazos asimétricos → feedback de simetría", () => {
    const { results } = run("shoulder_raises", 1, P.repSequence(2, (t) => P.shoulderRaise(P.lerp(25, 95, t), 40)));
    expect(results.some((r) => r.feedback === "Sube los dos brazos a la misma altura")).toBe(true);
  });

  test("leg raise: rodilla doblada → 'Mantén la pierna estirada'", () => {
    const { results } = run("leg_raise", 1, P.repSequence(2, (t) => P.legRaise(P.lerp(178, 140, t), 60)));
    expect(results.some((r) => r.feedback === "Mantén la pierna estirada")).toBe(true);
  });

  test("feedback por fase en español", () => {
    const { results } = run("squat", 1, P.repSequence(1, (t) => P.squat(P.lerp(178, 100, t))));
    const feedbacks = new Set(results.map((r) => r.feedback));
    expect(feedbacks.has("¡Repetición completada!")).toBe(true);
    expect(feedbacks.has("Baja flexionando las rodillas")).toBe(true);
  });
});

describe("fixtures reales", () => {
  const fixtures = listFixtures();
  if (fixtures.length === 0) {
    test.skip("no hay fixtures grabados todavía (ver validation/__fixtures__/README.md)", () => {});
    return;
  }
  test.each(fixtures)("%s cuenta las reps esperadas", (name) => {
    const { meta, frames } = loadFixture(name);
    const { reps } = run(meta.exerciseId, meta.level ?? 1, frames);
    if (meta.expectedReps != null) expect(reps).toBe(meta.expectedReps);
    else expect(reps).toBeGreaterThanOrEqual(0);
  });
});
