// services/profileService.ts — perfil propio (GET/PATCH /api/specialists/me,
// /api/admins/me) y cambio de contraseña (POST /api/auth/change-password).
import { apiFetch } from "./apiClient";

export interface SpecialistProfile {
  first_name: string | null;
  last_name: string | null;
  email: string;
  rut: string | null;
  specialty: string | null;
  phone: string | null;
  is_active: boolean;
}

export interface SpecialistProfileUpdate {
  first_name?: string;
  last_name?: string;
  specialty?: string;
  phone?: string;
}

export const getSpecialistProfile = (): Promise<SpecialistProfile> => apiFetch<SpecialistProfile>("/api/specialists/me");

export const updateSpecialistProfile = (body: SpecialistProfileUpdate): Promise<SpecialistProfile> =>
  apiFetch<SpecialistProfile>("/api/specialists/me", { method: "PATCH", body });

export interface AdminProfile {
  first_name: string | null;
  last_name: string | null;
  email: string;
  job_title: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string | null;
}

export interface AdminProfileUpdate {
  first_name?: string;
  last_name?: string;
  job_title?: string;
  phone?: string;
}

export const getAdminProfile = (): Promise<AdminProfile> => apiFetch<AdminProfile>("/api/admins/me");

export const updateAdminProfile = (body: AdminProfileUpdate): Promise<AdminProfile> =>
  apiFetch<AdminProfile>("/api/admins/me", { method: "PATCH", body });

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export const changePassword = (body: ChangePasswordPayload): Promise<void> =>
  apiFetch<void>("/api/auth/change-password", { method: "POST", body });

// "Nombre Apellido Apellido" → {first_name, last_name}
export const splitFullName = (fullName: string): { first_name: string; last_name: string } => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first_name = parts.shift() ?? "";
  return { first_name, last_name: parts.join(" ") };
};
