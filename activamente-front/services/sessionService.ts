// services/sessionService.ts
//   POST /api/sessions                    (patient_id sale del token)
//   GET  /api/sessions/{id}
//   POST /api/sessions/{id}/complete      (idempotente)
//   PUT  /api/sessions/{id}/exercises/{seid}
import { apiFetch } from "./apiClient";

export interface SessionExerciseResponse {
  id: string;
  session_id: string;
  exercise_id: string | null;
  routine_exercise_id: string | null;
  series_completed: number;
  reps_completed: number;
  accuracy_score: number | null;
  feedback: string | null;
}

export interface SessionResponse {
  id: string;
  patient_id: string;
  routine_id: string | null;
  date: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  is_completed: boolean;
  // Uno por ejercicio de la rutina, en orden order_index.
  session_exercises: SessionExerciseResponse[];
}

export interface SessionExerciseUpdate {
  series_completed: number;
  reps_completed: number;
  accuracy_score?: number | null;
  feedback?: string | null;
}

export const createSession = (routineId: string): Promise<SessionResponse> =>
  apiFetch<SessionResponse>("/api/sessions", { method: "POST", body: { routine_id: routineId } });

export const getSessionById = (sessionId: string): Promise<SessionResponse> =>
  apiFetch<SessionResponse>(`/api/sessions/${encodeURIComponent(sessionId)}`);

export const completeSession = (sessionId: string): Promise<SessionResponse> =>
  apiFetch<SessionResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/complete`, { method: "POST" });

export const updateExerciseProgress = (
  sessionId: string,
  sessionExerciseId: string,
  data: SessionExerciseUpdate
): Promise<SessionExerciseResponse> =>
  apiFetch<SessionExerciseResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/exercises/${encodeURIComponent(sessionExerciseId)}`,
    { method: "PUT", body: data }
  );
