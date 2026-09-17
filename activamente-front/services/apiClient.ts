// services/apiClient.ts
//
// Wrapper de fetch para hablar con el backend: prefija la URL base, envía y
// parsea JSON y adjunta el Bearer token del authStore.
//
//  - 401 → la sesión ya no sirve: clearAuth("expired") y el root layout redirige
//    al login con el mensaje "Tu sesión expiró" (EP-07 / UX-03).
//  - 403 con detalle de cuenta desactivada → clearAuth("forbidden").
//  - Sin red → ApiError con status 0 y mensaje humano.

import { API_BASE_URL } from "./config";
import { getToken, clearAuth } from "./authStore";

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  // false para endpoints que NO deben mandar token (login).
  auth?: boolean;
  timeoutMs?: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function apiFetch<T = unknown>(
  path: string,
  { body, auth = true, headers, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest }: ApiOptions = {}
): Promise<T> {
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
  } catch {
    throw new ApiError("Sin conexión. Revisa tu internet e inténtalo de nuevo.", 0);
  } finally {
    if (timer) clearTimeout(timer);
  }

  let data: any = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const detail =
      (data && typeof data === "object" && typeof data.detail === "string" && data.detail) ||
      (data && typeof data === "object" && Array.isArray(data.detail) && data.detail[0]?.msg) ||
      (typeof data === "string" && data) ||
      `Error del servidor (${response.status})`;

    if (auth && response.status === 401) clearAuth("expired");
    if (auth && response.status === 403 && /desactivad/i.test(String(detail))) clearAuth("forbidden");

    throw new ApiError(String(detail).replace(/^Value error, /, ""), response.status);
  }

  return data as T;
}
