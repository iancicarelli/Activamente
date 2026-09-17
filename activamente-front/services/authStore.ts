// services/authStore.ts
//
// Sesión autenticada (JWT + rol + user id) con persistencia en expo-secure-store
// (UX-14): sobrevive al cierre de la app. `hydrateAuth()` la carga al arrancar
// (app/_layout.tsx). Dependency-free en la API pública: cualquier servicio o
// pantalla lee `getSession()` / `getToken()`.

import * as SecureStore from "expo-secure-store";

export type UserRole = "ADMIN" | "SPECIALIST" | "PATIENT";

export interface AuthSession {
  token: string;
  role: UserRole;
  userId: string;
  // epoch ms; sirve para no restaurar un token ya vencido.
  expiresAt: number;
}

export type ClearReason = "logout" | "expired" | "forbidden";

const STORAGE_KEY = "activamente.session";

let session: AuthSession | null = null;
let hydrated = false;
let lastClearReason: ClearReason | null = null;
const listeners = new Set<(session: AuthSession | null, reason: ClearReason | null) => void>();

const notify = (reason: ClearReason | null) => {
  listeners.forEach((cb) => cb(session, reason));
};

const persist = async (next: AuthSession | null) => {
  try {
    if (next) await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Sin secure store (p.ej. tests o web) la sesión vive solo en memoria.
  }
};

export function setAuth(next: AuthSession): void {
  session = next;
  lastClearReason = null;
  void persist(next);
  notify(null);
}

export function clearAuth(reason: ClearReason = "logout"): void {
  const hadSession = session !== null;
  session = null;
  lastClearReason = reason;
  void persist(null);
  if (hadSession) notify(reason);
}

export function getSession(): AuthSession | null {
  return session;
}

export function getToken(): string | null {
  return session?.token ?? null;
}

export function isHydrated(): boolean {
  return hydrated;
}

export function consumeClearReason(): ClearReason | null {
  const r = lastClearReason;
  lastClearReason = null;
  return r;
}

// Carga la sesión guardada. Descarta tokens vencidos.
export async function hydrateAuth(): Promise<AuthSession | null> {
  if (hydrated) return session;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed?.token && parsed.expiresAt > Date.now() + 60_000) {
        session = parsed;
      } else {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      }
    }
  } catch {
    session = null;
  }
  hydrated = true;
  return session;
}

// Suscripción a cambios de sesión: el root layout la usa para redirigir al
// login cuando el token expira (401) o la cuenta se desactiva (403).
export function subscribe(cb: (session: AuthSession | null, reason: ClearReason | null) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Solo para tests.
export function __resetAuthForTests(): void {
  session = null;
  hydrated = false;
  lastClearReason = null;
  listeners.clear();
}
