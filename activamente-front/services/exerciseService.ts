// services/exerciseService.ts
//
// Cliente del endpoint de la biblioteca de ejercicios del backend:
//   GET /api/exercises
//
// Sigue el patrón de authService.ts: usa apiFetch (auth: true por defecto), que
// adjunta el Bearer token desde authStore.

import { apiFetch } from "./apiClient";

// Forma de cada ejercicio devuelto por GET /api/exercises (ExerciseResponse).
export interface Exercise {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  multimedia_url: string | null;
}

// GET /api/exercises → lista completa de la biblioteca de ejercicios.
export const getExercises = (): Promise<Exercise[]> =>
  apiFetch<Exercise[]>("/api/exercises", {
    method: "GET",
    auth: true,
  });
