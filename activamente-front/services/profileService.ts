// services/profileService.ts
//
// Cliente de los endpoints de "mi perfil" (perfil propio del usuario logueado):
//   GET   /api/specialists/me     GET   /api/admins/me
//   PATCH /api/specialists/me     PATCH /api/admins/me
//   POST  /api/auth/change-password
//
// Sigue el patrón del resto de servicios: usa apiFetch (auth: true por defecto),
// que adjunta el Bearer token desde authStore. El backend toma el user del token,
// por eso no se envía ningún id en la URL.

import { apiFetch } from "./apiClient";

// ─── Especialista ──────────────────────────────────────────────────────────────

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

export const getSpecialistProfile = (): Promise<SpecialistProfile> =>
  apiFetch<SpecialistProfile>("/api/specialists/me", { method: "GET" });

export const updateSpecialistProfile = (
  body: SpecialistProfileUpdate
): Promise<SpecialistProfile> =>
  apiFetch<SpecialistProfile>("/api/specialists/me", { method: "PATCH", body });

// ─── Administrador ──────────────────────────────────────────────────────────────

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

export const getAdminProfile = (): Promise<AdminProfile> =>
  apiFetch<AdminProfile>("/api/admins/me", { method: "GET" });

export const updateAdminProfile = (
  body: AdminProfileUpdate
): Promise<AdminProfile> =>
  apiFetch<AdminProfile>("/api/admins/me", { method: "PATCH", body });

// ─── Cambio de contraseña (cualquier rol) ───────────────────────────────────────

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

// POST /api/auth/change-password → 204 No Content (sin body de respuesta).
export const changePassword = (body: ChangePasswordPayload): Promise<void> =>
  apiFetch<void>("/api/auth/change-password", { method: "POST", body });
