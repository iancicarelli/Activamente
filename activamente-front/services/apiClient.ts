// services/apiClient.ts
//
// Thin wrapper around fetch that every service should use to talk to the
// backend. It prefixes the API base URL, sends/parses JSON, and automatically
// attaches the Bearer token stored in authStore so all authenticated screens
// just work without each call re-implementing auth.

import { API_BASE_URL } from "./config";
import { getToken, clearAuth } from "./authStore";

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  // Set to false for endpoints that must NOT send the token (e.g. login).
  auth?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  { body, auth = true, headers, ...rest }: ApiOptions = {}
): Promise<T> {
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  };

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();
    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // An expired/invalid token means the session is no longer valid.
  if (response.status === 401) {
    clearAuth();
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
      (data && typeof data === "object" && data.detail) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(detail, response.status);
  }

  return data as T;
}
