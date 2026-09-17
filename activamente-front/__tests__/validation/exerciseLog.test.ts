import { ExerciseLogger, parsePluginResult } from "../../validation/exerciseLog";
import * as P from "./poseFactory";

describe("parsePluginResult", () => {
  test("lista plana (build viejo) y objeto con tiempos (build nuevo)", () => {
    const lms = P.standing();
    expect(parsePluginResult(lms)).toEqual({ lms, native: null });
    expect(parsePluginResult({ landmarks: lms, convMs: 5.5, detMs: 70, ts: 1 })).toEqual({ lms, native: { convMs: 5.5, detMs: 70, ts: 1 } });
    expect(parsePluginResult(null)).toEqual({ lms: [], native: null });
    expect(parsePluginResult({})).toEqual({ lms: [], native: null });
  });
});

describe("ExerciseLogger", () => {
  test("guarda frames, eventos y resumen en el formato de fixtures", () => {
    const logger = new ExerciseLogger({ exerciseId: "squat", level: 1, totalSeries: 1, totalReps: 2, sessionId: "s" });
    logger.frame({ lms: P.standing(), native: { convMs: 10, detMs: 80, ts: 1 }, sessionPhase: "countdown" });
    logger.frame({
      lms: P.squat(100),
      native: { convMs: 10, detMs: 60, ts: 2 },
      sessionPhase: "active",
      jsMs: 1.234,
      result: { ok: true, feedback: "¡Repetición completada!", repCompleted: true, phase: "standing", metrics: { kneeAngle: 100.26 } },
    });
    logger.event("seriesDone", { series: 1 });
    logger.flush("test");
    const file = (logger as unknown as { file: { write: jest.Mock } }).file;
    const written = JSON.parse(file.write.mock.calls[0][0]);
    expect(written.exerciseId).toBe("squat");
    expect(written.frames).toHaveLength(2);
    expect(written.frames[0].lms).toHaveLength(33);
    expect(written.frames[0].lms[0]).toHaveLength(4);
    expect(written.frames[1]).toMatchObject({ sp: "active", n: { c: 10, d: 60 }, js: 1.2, r: { p: "standing", rep: true, m: { kneeAngle: 100.3 } } });
    expect(written.summary).toMatchObject({ frames: 2, reps: 1, nativeAvgMs: { conv: 10, det: 70 } });
    expect(written.events.map((e: { type: string }) => e.type)).toEqual(["phase", "seriesDone", "flush"]);
  });
});
