// services/patientService.ts
//   GET    /api/patients/?search&limit&offset   (especialista: solo asignados)
//   GET    /api/patients/me/sessions
//   GET    /api/patients/by-rut/{rut}
//   GET    /api/patients/{id}
//   POST   /api/patients/assign
//   DELETE /api/patients/{id}/assign
//   PATCH  /api/patients/{id}/status           (cuenta: users.is_active)
import { apiFetch } from "./apiClient";

export interface SurveySummary {
  pain_level: number | null;
  fatigue_level: number | null;
  stress_level: number | null;
  mood_level: number | null;
  comments: string | null;
}

export interface SessionItem {
  id: string;
  name: string;
  date: string;               // ISO 8601 con zona
  completedAt: string | null;
  durationMinutes: number | null;
  completed: boolean;
  exercisesTotal: number;
  exercisesDone: number;
  preSurvey: SurveySummary | null;
  postSurvey: SurveySummary | null;
}

// Encuestas de la última sesión con encuesta y las métricas "en rojo" (alerta).
export interface WellbeingStatus {
  sessionId: string;
  date: string;               // ISO 8601 con zona
  hasAlert: boolean;
  reasons: string[];
  preSurvey: SurveySummary | null;
  postSurvey: SurveySummary | null;
}

export type AlertKind = "wellbeing" | "inactive";

export interface ComplianceMetrics {
  sessionsCompleted: number;
  sessionsTotal: number;
  adherencePercent: number;
  sessionsCompletedThisWeek: number;
  currentStreakDays: number;
}

export interface Patient {
  id: string;
  fullName: string;
  rut: string;
  age: number | null;
  gender: string;
  email: string;
  phone: string;
  address: string;
  active: boolean;
  assignedToMe: boolean | null;
  metrics: ComplianceMetrics | null;
  sessions: SessionItem[];
  wellbeing: WellbeingStatus | null;
}

export interface PatientListItem {
  id: string;
  fullName: string;
  rut: string | null;
  age: number | null;
  isActive: boolean;
  hasAlert: boolean;
  alertMessage: string | null;
  alertKind: AlertKind | null;
  isNew: boolean;
  lastSessionDate: string | null;
}

// ─── Formas crudas ────────────────────────────────────────────────────────────

interface RawSessionItem {
  id: string;
  name: string;
  date: string;
  completed_at: string | null;
  duration_minutes: number | null;
  completed: boolean;
  exercises_total: number;
  exercises_done: number;
  pre_survey: SurveySummary | null;
  post_survey: SurveySummary | null;
}

interface RawPatientListItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  rut: string | null;
  age: number | null;
  is_active: boolean;
  hasAlert: boolean;
  alertMessage: string | null;
  alertKind?: AlertKind | null;
  isNew: boolean;
  lastSessionDate: string | null;
}

interface RawWellbeingStatus {
  session_id: string;
  date: string;
  has_alert: boolean;
  reasons: string[];
  pre_survey: SurveySummary | null;
  post_survey: SurveySummary | null;
}

interface RawPatientResponse {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  rut?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  assignedToMe?: boolean | null;
  metrics?: ComplianceMetrics | null;
  sessions?: RawSessionItem[] | null;
  wellbeing?: RawWellbeingStatus | null;
}

export const toSessionItem = (raw: RawSessionItem): SessionItem => ({
  id: raw.id,
  name: raw.name,
  date: raw.date,
  completedAt: raw.completed_at,
  durationMinutes: raw.duration_minutes,
  completed: raw.completed,
  exercisesTotal: raw.exercises_total,
  exercisesDone: raw.exercises_done,
  preSurvey: raw.pre_survey,
  postSurvey: raw.post_survey,
});

export const toWellbeingStatus = (raw: RawWellbeingStatus): WellbeingStatus => ({
  sessionId: raw.session_id,
  date: raw.date,
  hasAlert: raw.has_alert,
  reasons: raw.reasons ?? [],
  preSurvey: raw.pre_survey,
  postSurvey: raw.post_survey,
});

export const toPatient = (raw: RawPatientResponse): Patient => ({
  id: raw.id,
  fullName: raw.fullName,
  rut: raw.rut ?? "",
  age: raw.age ?? null,
  gender: raw.gender ?? "",
  email: raw.email,
  phone: raw.phone ?? "",
  address: raw.address ?? "",
  active: raw.active,
  assignedToMe: raw.assignedToMe ?? null,
  metrics: raw.metrics ?? null,
  sessions: (raw.sessions ?? []).map(toSessionItem),
  wellbeing: raw.wellbeing ? toWellbeingStatus(raw.wellbeing) : null,
});

export const toPatientListItem = (p: RawPatientListItem): PatientListItem => ({
  id: p.id,
  fullName: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
  rut: p.rut,
  age: p.age,
  isActive: p.is_active,
  hasAlert: p.hasAlert,
  alertMessage: p.alertMessage,
  alertKind: p.alertKind ?? null,
  isNew: p.isNew,
  lastSessionDate: p.lastSessionDate,
});

// ─── Funciones ────────────────────────────────────────────────────────────────

export interface ListPatientsParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export const getPatients = async (params: ListPatientsParams = {}): Promise<PatientListItem[]> => {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const raw = await apiFetch<RawPatientListItem[]>(`/api/patients/${qs ? `?${qs}` : ""}`);
  return raw.map(toPatientListItem);
};

export const getMySessions = async (params: { limit?: number; offset?: number } = {}): Promise<SessionItem[]> => {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const raw = await apiFetch<RawSessionItem[]>(`/api/patients/me/sessions${qs ? `?${qs}` : ""}`);
  return raw.map(toSessionItem);
};

export const getPatientByRut = (rut: string): Promise<Patient> =>
  apiFetch<RawPatientResponse>(`/api/patients/by-rut/${encodeURIComponent(rut)}`).then(toPatient);

export const getPatientById = (id: string): Promise<Patient> =>
  apiFetch<RawPatientResponse>(`/api/patients/${encodeURIComponent(id)}`).then(toPatient);

export const setPatientAccountStatus = (id: string, active: boolean): Promise<Patient> =>
  apiFetch<RawPatientResponse>(`/api/patients/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { active },
  }).then(toPatient);

export const assignPatientToSpecialist = (rut: string): Promise<{ message: string; patient_id: string }> =>
  apiFetch<{ message: string; patient_id: string }>("/api/patients/assign", { method: "POST", body: { rut } });

export const unassignPatient = (id: string): Promise<void> =>
  apiFetch<void>(`/api/patients/${encodeURIComponent(id)}/assign`, { method: "DELETE" });
