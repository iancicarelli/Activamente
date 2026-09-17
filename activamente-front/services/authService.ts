// services/authService.ts
import { apiFetch } from "./apiClient";
import { setAuth, clearAuth, UserRole } from "./authStore";
import { looksLikeRut, normalizeRut } from "../utils/rut";

// Shape de POST /api/auth/login.
export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
  expires_in: number; // segundos
}

// Acepta email o RUT (R-05): decide por la forma del texto.
export const loginApi = async (identifier: string, password: string): Promise<LoginResponse> => {
  const value = identifier.trim();
  const body = looksLikeRut(value)
    ? { rut: normalizeRut(value), password }
    : { email: value.toLowerCase(), password };

  const data = await apiFetch<LoginResponse>("/api/auth/login", { method: "POST", auth: false, body });

  setAuth({
    token: data.access_token,
    role: data.role,
    userId: data.user_id,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data;
};

export const logout = (): void => {
  clearAuth("logout");
};
