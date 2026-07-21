// services/userService.ts
// Admin-only user management: list/search users and activate/deactivate them.
import { apiFetch } from "./apiClient";
import type { UserRole } from "./authStore";

// Spanish labels used across the admin UI, derived from the backend role enum.
export type RoleEs = "admin" | "especialista" | "paciente";

const ROLE_TO_ES: Record<UserRole, RoleEs> = {
  ADMIN: "admin",
  SPECIALIST: "especialista",
  PATIENT: "paciente",
};

// Raw shape returned by GET /api/users.
interface UserListItemDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
}

// Normalised shape the admin screens consume.
export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: RoleEs;
  isActive: boolean;
  createdAt: string | null;
}

const toAdminUser = (dto: UserListItemDto): AdminUser => ({
  id: dto.id,
  fullName: `${dto.first_name} ${dto.last_name}`.trim(),
  email: dto.email,
  role: ROLE_TO_ES[dto.role] ?? "paciente",
  isActive: dto.is_active,
  createdAt: dto.created_at,
});

export interface ListUsersParams {
  search?: string;
  role?: RoleEs;
  // Paginación (opcional). El backend usa limit=50 / offset=0 por defecto.
  limit?: number;
  offset?: number;
}

export const listUsers = async (
  params: ListUsersParams = {}
): Promise<AdminUser[]> => {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.role) query.set("role", params.role);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const qs = query.toString();
  const data = await apiFetch<UserListItemDto[]>(
    `/api/users${qs ? `?${qs}` : ""}`
  );
  return data.map(toAdminUser);
};

export const setUserStatus = async (
  id: string,
  isActive: boolean
): Promise<AdminUser> => {
  const data = await apiFetch<UserListItemDto>(`/api/users/${id}/status`, {
    method: "PATCH",
    body: { is_active: isActive },
  });
  return toAdminUser(data);
};

// ─── Alta de usuarios (POST /api/users, admin-only) ─────────────────────────────
// El backend genera una contraseña temporal y la devuelve una sola vez para que
// el admin se la entregue al nuevo usuario.

export interface CreateUserPayload {
  fullName: string;
  email: string;
  role: "paciente" | "especialista";
  // Campos opcionales por rol (se guardan en patients / specialists).
  rut?: string;
  phone?: string;
  age?: number;
  gender?: string;
  address?: string;
  specialty?: string;
}

export interface CreatedUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  temp_password?: string;
}

export const createUserApi = async (
  userData: CreateUserPayload
): Promise<CreatedUser> =>
  apiFetch<CreatedUser>("/api/users", {
    method: "POST",
    body: {
      ...userData,
      email: userData.email.trim().toLowerCase(),
    },
  });
