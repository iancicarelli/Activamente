// services/userService.ts — gestión de usuarios (solo admin).
//   GET   /api/users?search&role&limit&offset  → {items, total, limit, offset}
//   POST  /api/users                           → temp_password una vez
//   PATCH /api/users/{id}                      → editar perfil (HC-09)
//   PATCH /api/users/{id}/status
//   PUT   /api/users/{id}/password             → el admin fija una contraseña nueva (204)
import { apiFetch } from "./apiClient";
import type { UserRole } from "./authStore";

export type RoleEs = "admin" | "especialista" | "paciente";

const ROLE_TO_ES: Record<UserRole, RoleEs> = {
  ADMIN: "admin",
  SPECIALIST: "especialista",
  PATIENT: "paciente",
};

export const ROLE_LABEL: Record<RoleEs, string> = {
  admin: "Administrador",
  especialista: "Especialista",
  paciente: "Paciente",
};

interface UserListItemDto {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
  rut: string | null;
  phone: string | null;
}

interface UserListDto {
  items: UserListItemDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: RoleEs;
  isActive: boolean;
  createdAt: string | null;
  rut: string | null;
  phone: string | null;
}

export interface UserPage {
  items: AdminUser[];
  total: number;
  hasMore: boolean;
}

export const toAdminUser = (dto: UserListItemDto): AdminUser => ({
  id: dto.id,
  fullName: `${dto.first_name} ${dto.last_name}`.trim(),
  email: dto.email,
  role: ROLE_TO_ES[dto.role] ?? "paciente",
  isActive: dto.is_active,
  createdAt: dto.created_at,
  rut: dto.rut,
  phone: dto.phone,
});

export interface ListUsersParams {
  search?: string;
  role?: RoleEs;
  limit?: number;
  offset?: number;
}

export const listUsers = async (params: ListUsersParams = {}): Promise<UserPage> => {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.role) query.set("role", params.role);
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  query.set("limit", String(limit));
  query.set("offset", String(offset));
  const data = await apiFetch<UserListDto>(`/api/users?${query.toString()}`);
  return {
    items: data.items.map(toAdminUser),
    total: data.total,
    hasMore: offset + data.items.length < data.total,
  };
};

export const setUserStatus = (id: string, isActive: boolean): Promise<AdminUser> =>
  apiFetch<UserListItemDto>(`/api/users/${id}/status`, { method: "PATCH", body: { is_active: isActive } }).then(toAdminUser);

export const setUserPassword = (id: string, newPassword: string): Promise<void> =>
  apiFetch<void>(`/api/users/${id}/password`, { method: "PUT", body: { new_password: newPassword } });

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  rut?: string;
  phone?: string;
  age?: number;
  gender?: string;
  address?: string;
  specialty?: string;
  job_title?: string;
}

export const updateUser = (id: string, body: UpdateUserPayload): Promise<AdminUser> =>
  apiFetch<UserListItemDto>(`/api/users/${id}`, { method: "PATCH", body }).then(toAdminUser);

export interface CreateUserPayload {
  fullName: string;
  email: string;
  role: "paciente" | "especialista";
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

export const createUserApi = (userData: CreateUserPayload): Promise<CreatedUser> =>
  apiFetch<CreatedUser>("/api/users", {
    method: "POST",
    body: { ...userData, email: userData.email.trim().toLowerCase() },
  });
