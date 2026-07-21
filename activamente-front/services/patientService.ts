// services/patientService.ts
//
// Cliente de los endpoints de pacientes del backend (todos protegidos con auth):
//   GET   /api/patients/                  → lista de pacientes
//   GET   /api/patients/by-rut/{rut}      → ficha de un paciente por RUT
//   GET   /api/patients/{id}              → ficha básica por id
//   POST  /api/patients/assign            → asigna un paciente al especialista
//   PATCH /api/patients/{id}/status       → habilita/deshabilita un paciente
//
// Sigue el patrón de los demás services: usa apiFetch (auth: true por defecto),
// que adjunta el Bearer token desde authStore. El especialista se obtiene del
// token en el backend, por eso no se envía en ninguna petición.

import { apiFetch } from "./apiClient";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  name: string;
  duration: string;
  date: string;
  completed: boolean;
}

export interface ComplianceMetrics {
  sessionsCompleted: number;
  sessionsTotal: number;
  adherencePercent: number;
}

export interface Patient {
  id: string;
  fullName: string;
  rut: string;
  age: number;
  gender: string;
  email: string;
  phone: string;
  address: string;
  metrics: ComplianceMetrics;
  sessions: Session[];
  active: boolean;
}

export interface PatientListItem {
  id: string;
  fullName: string;
  age?: number;
  lastActivity?: string; // p.ej. "Hoy, 10:00" | "Hace 5 días"
  hasAlert: boolean;
  alertMessage?: string;
}

// ─── Formas crudas del backend ─────────────────────────────────────────────────

interface RawPatientListItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string | null;
  hasAlert: boolean;
  alertMessage?: string;
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
  metrics?: ComplianceMetrics;
  sessions?: Session[];
}

// Métricas/sesiones aún no existen en el backend → valores por defecto seguros
// para que las pantallas rendericen sin romperse.
const EMPTY_METRICS: ComplianceMetrics = {
  sessionsCompleted: 0,
  sessionsTotal: 0,
  adherencePercent: 0,
};

const fullNameFrom = (first: string | null, last: string | null): string =>
  `${first ?? ""} ${last ?? ""}`.trim();

const toPatient = (raw: RawPatientResponse): Patient => ({
  id: raw.id,
  fullName: raw.fullName,
  rut: raw.rut ?? "",
  age: raw.age ?? 0,
  gender: raw.gender ?? "",
  email: raw.email,
  phone: raw.phone ?? "",
  address: raw.address ?? "",
  metrics: raw.metrics ?? EMPTY_METRICS,
  sessions: raw.sessions ?? [],
  active: raw.active,
});

// ─── Funciones ────────────────────────────────────────────────────────────────

// GET /api/patients/ → lista de pacientes del sistema.
// Paginación opcional (el backend usa limit=50 / offset=0 por defecto).
export const getPatients = async (
  params: { limit?: number; offset?: number } = {}
): Promise<PatientListItem[]> => {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();

  const raw = await apiFetch<RawPatientListItem[]>(
    `/api/patients/${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      auth: true,
    }
  );
  return raw.map((p) => ({
    id: p.id,
    fullName: fullNameFrom(p.first_name, p.last_name),
    hasAlert: p.hasAlert,
    alertMessage: p.alertMessage,
  }));
};

// GET /api/patients/by-rut/{rut} → ficha completa por RUT.
export const getPatientByRut = async (rut: string): Promise<Patient> => {
  const raw = await apiFetch<RawPatientResponse>(
    `/api/patients/by-rut/${encodeURIComponent(rut)}`,
    { method: "GET", auth: true }
  );
  return toPatient(raw);
};

// GET /api/patients/{id} → ficha básica por id (identidad + contacto mínimo).
export const getPatientById = async (id: string): Promise<Patient> => {
  const raw = await apiFetch<RawPatientResponse>(
    `/api/patients/${encodeURIComponent(id)}`,
    { method: "GET", auth: true }
  );
  return toPatient(raw);
};

// PATCH /api/patients/{id}/status → habilita/deshabilita al paciente.
export const togglePatientStatus = async (
  id: string,
  active: boolean
): Promise<Patient> => {
  const raw = await apiFetch<RawPatientResponse>(
    `/api/patients/${encodeURIComponent(id)}/status`,
    { method: "PATCH", auth: true, body: { active } }
  );
  return toPatient(raw);
};

// POST /api/patients/assign → vincula un paciente (por RUT) al especialista
// autenticado.
export const assignPatientToSpecialist = async (rut: string): Promise<void> => {
  await apiFetch<{ message: string }>("/api/patients/assign", {
    method: "POST",
    auth: true,
    body: { rut },
  });
};
