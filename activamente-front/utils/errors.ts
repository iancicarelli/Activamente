// utils/errors.ts — mensajes de error humanos (UX-03).
import { ApiError } from "../services/apiClient";

export const getErrorMessage = (error: unknown, fallback = "Ocurrió un problema. Inténtalo de nuevo."): string => {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const isOffline = (error: unknown): boolean => error instanceof ApiError && error.status === 0;
