// services/authService.ts
import { apiFetch } from "./apiClient";
import { setAuth, clearAuth, UserRole, Patient } from "./authStore";

// Shape returned by POST /api/auth/login on the backend.
export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
  patient?: Patient;
}

// Authenticates against the backend, stores the JWT + role in the auth store
// and returns the raw response so the caller can route by role.
export const loginApi = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const data = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    auth: false, // no token yet — this is how we get one
    body: { email, password },
  });

  setAuth({
    token: data.access_token,
    role: data.role,
    userId: data.user_id,
    patient: data.patient
  });

  return data;
};

// Clears the stored session. Call this from any "cerrar sesión" button.
export const logout = (): void => {
  clearAuth();
};
