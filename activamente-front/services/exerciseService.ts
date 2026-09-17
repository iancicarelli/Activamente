// services/exerciseService.ts — GET /api/exercises (catálogo con max_level).
import { apiFetch } from "./apiClient";

export interface Exercise {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  multimedia_url: string | null;
  max_level: number;
}

export const getExercises = (): Promise<Exercise[]> => apiFetch<Exercise[]>("/api/exercises");
