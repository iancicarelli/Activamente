// services/authStore.ts
//
// Lightweight in-memory holder for the authenticated session (JWT + role +
// user id). It is intentionally dependency-free so every service/screen can
// read the current token without prop drilling or extra packages.
//
// The token lives for the duration of the app process. If you later need it to
// survive app restarts, swap the internals for expo-secure-store / AsyncStorage
// — the public API below can stay the same.

export type UserRole = "ADMIN" | "SPECIALIST" | "PATIENT";

export interface Patient {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  rut?: string;
  age?: number;
  gender?: string;
  phone?: string;
  address?: string;
}

export interface AuthSession {
  token: string;
  role: UserRole;
  userId: string;
  patient?: Patient;
}

let session: AuthSession | null = null;
const listeners = new Set<(session: AuthSession | null) => void>();

export function setAuth(next: AuthSession): void {
  session = next;
  listeners.forEach((cb) => cb(session));
}

export function clearAuth(): void {
  session = null;
  listeners.forEach((cb) => cb(session));
}

export function getSession(): AuthSession | null {
  return session;
}

export function getToken(): string | null {
  return session?.token ?? null;
}

export function getRole(): UserRole | null {
  return session?.role ?? null;
}

export function isAuthenticated(): boolean {
  return session !== null;
}

// Subscribe to session changes (e.g. to redirect to login on logout).
// Returns an unsubscribe function.
export function subscribe(cb: (session: AuthSession | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
