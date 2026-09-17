// Replay de logs reales (validation/__logs__/*.json, bajados con scripts/pull-logs.sh)
// a través de los validadores ACTUALES. Sirve para calibrar umbrales sin volver a
// grabar: imprime reps contadas y frames descartados por visibilidad por cada log.
//
// Solo corre con REPLAY_LOGS=1 (scripts/replay-logs.sh); en `npm test` se salta.
// Si el log trae `expectedReps` (agregado a mano con lo que la persona hizo de
// verdad), se exige que el conteo esté a ±1 de ese valor.
import * as fs from "fs";
import * as path from "path";
import { exerciseRegistry } from "../../validation/validators/exerciseRegistry";
import { createValidatorState, Landmark } from "../../validation/types";

const DIR = path.join(__dirname, "..", "..", "validation", "__logs__");
type Log = { exerciseId: string; level: number; totalReps: number; expectedReps?: number; frames: { sp: string; lms: number[][] }[] };

const logs = process.env.REPLAY_LOGS && fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort() : [];

// REPLAY_TRACE="<archivo>,<t0 ms>,<t1 ms>" imprime además una línea por frame de ese log
// en esa ventana (fase, ok, REP, feedback, métricas) con el validador ACTUAL.
const [traceName, traceT0, traceT1] = (process.env.REPLAY_TRACE || "").split(",");

function replay(name: string, log: Log) {
  const fn = exerciseRegistry[log.exerciseId]?.levels[log.level];
  const active = log.frames.filter((f) => f.sp === "active");
  const state = createValidatorState();
  let invisible = 0;
  const reps: string[] = [];
  const trace: string[] = [];
  let cycleStart = 0;
  let minMetric = Infinity;
  let maxMetric = -Infinity;
  for (const f of active) {
    const lms: Landmark[] = f.lms.map(([x, y, z, visibility]) => ({ x, y, z, visibility }));
    const r = fn(lms, state);
    const t = (f as { t?: number }).t ?? 0;
    if (!r.ok && !r.metrics) invisible += 1;
    const main = r.metrics ? Object.values(r.metrics)[0] : undefined;
    if (r.phase === "standing" && !r.repCompleted) {
      cycleStart = t;
      minMetric = Infinity;
      maxMetric = -Infinity;
    } else if (main != null) {
      minMetric = Math.min(minMetric, main);
      maxMetric = Math.max(maxMetric, main);
    }
    // Por rep: cuándo, cuánto duró el ciclo y hasta dónde llegó la métrica principal
    // (sentadilla/toe touch/pierna: mirar el mín, p. ej. rodilla 62°; brazos: el máx).
    const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : "?");
    if (r.repCompleted) reps.push(`${(t / 1000).toFixed(1)}s (${((t - cycleStart) / 1000).toFixed(1)}s, ${fmt(minMetric)}-${fmt(maxMetric)})`);
    if (name === traceName && t >= +traceT0 && t <= +traceT1) {
      const m = Object.entries(r.metrics ?? {}).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(" ");
      trace.push(`  ${t} ${r.phase.padEnd(10)} ${r.ok ? "ok" : "--"} ${r.repCompleted ? "REP" : "   "} ${(r.feedback ?? "").slice(0, 26).padEnd(26)} ${m}`);
    }
  }
  return { reps: state.repCount, invisible, frames: active.length, repList: reps, trace };
}

if (logs.length === 0) {
  test.skip("replay de logs: correr con REPLAY_LOGS=1 (scripts/replay-logs.sh)", () => {});
} else {
  test.each(logs)("%s", (name) => {
    const log = JSON.parse(fs.readFileSync(path.join(DIR, name), "utf-8")) as Log;
    if (!exerciseRegistry[log.exerciseId]) return;
    const { reps, invisible, frames, repList, trace } = replay(name, log);
    const expected = log.expectedReps != null ? ` esperado=${log.expectedReps}` : "";
    console.log(
      `${name}: reps=${reps} (objetivo ${log.totalReps}${expected}) sin visibilidad ${invisible}/${frames} frames` +
        (repList.length ? `\n  reps en: ${repList.join(" · ")}` : "") +
        (trace.length ? `\n${trace.join("\n")}` : "")
    );
    if (log.expectedReps != null && frames > 0) expect(Math.abs(reps - log.expectedReps)).toBeLessThanOrEqual(1);
  });
}
