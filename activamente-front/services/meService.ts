// services/meService.ts — GET /api/me: perfil del usuario logueado según rol (EP-14).
import { apiFetch } from "./apiClient";
import type { UserRole } from "./authStore";

export interface SpecialistSummary {
  id: string;
  full_name: string;
  specialty: string | null;
  phone: string | null;
  email: string;
}

export interface MePatient {
  rut: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  specialists: SpecialistSummary[];
}

export interface MeResponse {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  patient: MePatient | null;
  specialist: { rut: string | null; specialty: string | null; phone: string | null; total_patients: number } | null;
  admin: { job_title: string | null; phone: string | null } | null;
}

export const getMe = (): Promise<MeResponse> => apiFetch<MeResponse>("/api/me");
