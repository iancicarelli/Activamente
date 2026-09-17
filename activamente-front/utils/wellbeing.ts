// utils/wellbeing.ts — lectura de las encuestas 1-5 para la UI: palabras, semáforo
// y cambio antes/después. Umbrales iguales a app/services/patient_metrics.py:
// dolor/cansancio/estrés 4-5 = rojo; ánimo 1-2 = rojo.
import type { SessionItem, SurveySummary } from "../services/patientService";

export type MetricKey = "pain" | "fatigue" | "stress" | "mood";
export type MetricTone = "good" | "warn" | "bad";

export const METRIC_LABEL: Record<MetricKey, string> = {
  pain: "Dolor",
  fatigue: "Cansancio",
  stress: "Estrés",
  mood: "Ánimo",
};

const INTENSITY_WORDS = ["", "Nada", "Poco", "Algo", "Bastante", "Mucho"];
const MOOD_WORDS = ["", "Muy mal", "Mal", "Regular", "Bien", "Muy bien"];

const isScale = (v: number | null | undefined): v is number => typeof v === "number" && v >= 1 && v <= 5;

export const metricWord = (key: MetricKey, value: number | null | undefined): string =>
  isScale(value) ? (key === "mood" ? MOOD_WORDS : INTENSITY_WORDS)[value] : "—";

export const metricTone = (key: MetricKey, value: number | null | undefined): MetricTone | null => {
  if (!isScale(value)) return null;
  if (key === "mood") return value <= 2 ? "bad" : value === 3 ? "warn" : "good";
  return value >= 4 ? "bad" : value === 3 ? "warn" : "good";
};

export type Change = "better" | "same" | "worse";

// Dolor antes → después: menos dolor es mejor.
export const painChange = (pre: SurveySummary | null, post: SurveySummary | null): Change | null => {
  const a = pre?.pain_level;
  const b = post?.pain_level;
  if (!isScale(a) || !isScale(b)) return null;
  return b < a ? "better" : b > a ? "worse" : "same";
};

export const hasSurvey = (s: Pick<SessionItem, "preSurvey" | "postSurvey">) => !!(s.preSurvey || s.postSurvey);

// true si alguna métrica de la sesión está en rojo.
export const sessionHasRedMetric = (s: Pick<SessionItem, "preSurvey" | "postSurvey">): boolean =>
  metricTone("pain", s.preSurvey?.pain_level) === "bad" ||
  metricTone("fatigue", s.preSurvey?.fatigue_level) === "bad" ||
  metricTone("stress", s.preSurvey?.stress_level) === "bad" ||
  metricTone("pain", s.postSurvey?.pain_level) === "bad" ||
  metricTone("mood", s.postSurvey?.mood_level) === "bad";
