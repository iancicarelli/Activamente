// validation/exerciseLog.ts — log automático de cada ejercicio (solo __DEV__).
//
// Desde que arranca el ejercicio (countdown) hasta que termina o se sale, guarda
// por frame: landmarks, tiempos del plugin nativo (si el build los devuelve),
// resultado del validador y fase de la sesión; más eventos (reps, series, fases).
// Se escribe en <documentDirectory>/exercise-logs/<fecha>_<ejercicio>_L<nivel>.json
// al cerrar cada serie, al terminar y al salir. Bajar con scripts/pull-logs.sh.
//
// El formato `frames[].lms` es el mismo de los fixtures (validation/__fixtures__),
// así un log se puede convertir en fixture de test recortando lo demás.
import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import type { Landmark, ValidatorResult } from "./types";

export const LOG_DIR = "exercise-logs";
const MAX_FRAMES = 9000; // ~10 min a 15 fps

export type NativeTiming = { convMs: number; detMs: number; ts: number };

// Lo que devuelve el plugin: lista de landmarks (build viejo) o
// { landmarks, convMs, detMs, ts } (build con tiempos).
export function parsePluginResult(raw: unknown): { lms: Landmark[]; native: NativeTiming | null } {
  if (Array.isArray(raw)) return { lms: raw as Landmark[], native: null };
  if (raw && typeof raw === "object" && Array.isArray((raw as { landmarks?: unknown }).landmarks)) {
    const r = raw as { landmarks: Landmark[]; convMs?: number; detMs?: number; ts?: number };
    return { lms: r.landmarks, native: { convMs: r.convMs ?? -1, detMs: r.detMs ?? -1, ts: r.ts ?? -1 } };
  }
  return { lms: [], native: null };
}

type LogFrame = {
  t: number; // ms desde el inicio del log
  sp: string; // fase de la sesión (countdown/active/rest/paused…)
  lms: number[][]; // [x, y, z, visibility] × 33, 3 decimales
  n?: { c: number; d: number }; // nativo: c = YUV→bitmap ms, d = detectForVideo ms
  js?: number; // ms del validador en JS
  r?: { p: string; ok: boolean; fb: string | null; rep: boolean; m?: Record<string, number> }; // validador
};

type LogEvent = { t: number; type: string; [k: string]: unknown };

export type ExerciseLog = {
  version: 1;
  format: string;
  startedAt: string;
  device: Record<string, unknown>;
  exerciseId: string;
  level: number;
  totalSeries: number;
  totalReps: number;
  sessionId: string;
  fps: number | null;
  frames: LogFrame[];
  events: LogEvent[];
  summary: { frames: number; dropped: number; durationS: number; reps: number; nativeAvgMs: { conv: number; det: number } | null };
};

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function deviceInfo(): Record<string, unknown> {
  const c = (Platform as unknown as { constants?: Record<string, unknown> }).constants ?? {};
  return { os: Platform.OS, version: Platform.Version, brand: c.Brand, model: c.Model, release: c.Release };
}

export class ExerciseLogger {
  private readonly startMs = Date.now();
  private readonly log: ExerciseLog;
  private readonly file: File | null;
  private dropped = 0;
  private reps = 0;
  private convSum = 0;
  private detSum = 0;
  private nativeCount = 0;
  private lastPhase = "";

  constructor(meta: { exerciseId: string; level: number; totalSeries: number; totalReps: number; sessionId: string }) {
    const stamp = new Date(this.startMs).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    this.log = {
      version: 1,
      format: "frames[]: t ms · sp fase sesión · lms [x,y,z,vis]×33 · n {c conv ms, d detect ms} · js ms validador · r {p fase, ok, fb feedback, rep, m métricas}",
      startedAt: new Date(this.startMs).toISOString(),
      device: deviceInfo(),
      ...meta,
      fps: null,
      frames: [],
      events: [],
      summary: { frames: 0, dropped: 0, durationS: 0, reps: 0, nativeAvgMs: null },
    };
    let file: File | null = null;
    try {
      const dir = new Directory(Paths.document, LOG_DIR);
      dir.create({ idempotent: true, intermediates: true });
      file = new File(dir, `${stamp}_${meta.exerciseId}_L${meta.level}.json`);
    } catch (e) {
      console.warn("[exerciseLog] no se pudo crear el directorio", e);
    }
    this.file = file;
  }

  get uri(): string | null {
    return this.file?.uri ?? null;
  }

  get frameCount(): number {
    return this.log.frames.length;
  }

  private t(): number {
    return Date.now() - this.startMs;
  }

  frame(input: { lms: Landmark[]; native: NativeTiming | null; sessionPhase: string; jsMs?: number; result?: ValidatorResult }): void {
    if (input.native) {
      this.convSum += input.native.convMs;
      this.detSum += input.native.detMs;
      this.nativeCount += 1;
    }
    if (this.log.frames.length >= MAX_FRAMES) {
      this.dropped += 1;
      return;
    }
    const f: LogFrame = {
      t: this.t(),
      sp: input.sessionPhase,
      lms: input.lms.map((l) => [round(l.x, 3), round(l.y, 3), round(l.z, 3), round(l.visibility, 2)]),
    };
    if (input.native) f.n = { c: round(input.native.convMs, 1), d: round(input.native.detMs, 1) };
    if (input.jsMs != null) f.js = round(input.jsMs, 1);
    if (input.result) {
      const m = input.result.metrics;
      f.r = {
        p: input.result.phase,
        ok: input.result.ok,
        fb: input.result.feedback,
        rep: input.result.repCompleted,
        ...(m ? { m: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, round(v, 1)])) } : {}),
      };
      if (input.result.phase !== this.lastPhase) {
        this.lastPhase = input.result.phase;
        this.event("phase", { phase: input.result.phase });
      }
      if (input.result.repCompleted) this.reps += 1;
    }
    this.log.frames.push(f);
  }

  event(type: string, data: Record<string, unknown> = {}): void {
    this.log.events.push({ t: this.t(), type, ...data });
  }

  /** Escribe el archivo completo (síncrono, unos ms). Llamar al cerrar serie/ejercicio/salir. */
  flush(reason: string): void {
    if (!this.file) return;
    const durationS = this.t() / 1000;
    const detected = this.log.frames.length + this.dropped;
    this.log.fps = durationS > 0 ? round(detected / durationS, 1) : null;
    this.log.summary = {
      frames: this.log.frames.length,
      dropped: this.dropped,
      durationS: round(durationS, 1),
      reps: this.reps,
      nativeAvgMs: this.nativeCount ? { conv: round(this.convSum / this.nativeCount, 1), det: round(this.detSum / this.nativeCount, 1) } : null,
    };
    this.event("flush", { reason });
    try {
      this.file.write(JSON.stringify(this.log));
    } catch (e) {
      console.warn("[exerciseLog] no se pudo escribir", e);
    }
  }
}
