// services/sessionService.ts
//
// Cliente de los endpoints de sesiones del backend (ahora protegidos con auth):
//   POST /api/sessions
//   POST /api/sessions/{session_id}/complete
//   PUT  /api/sessions/{session_id}/exercises/{session_exercise_id}
//
// Sigue el patrón de authService.ts: usa apiFetch (auth: true por defecto), que
// adjunta el Bearer token desde authStore.

import { apiFetch } from "./apiClient";

// Respuesta de POST /api/sessions y /complete (SessionResponse).
export interface SessionResponse {
  id: string;
  patient_id: string | null;
  routine_id: string | null;
  date: string | null;
  duration_minutes: number | null;
  is_completed: boolean | null;
  // POST /api/sessions crea un session_exercise por cada ejercicio de la rutina
  // (ordenados por order_index) y devuelve sus ids reales aquí. /complete
  // devuelve [] por defecto.
  session_exercises: SessionExerciseResponse[];
}

// Body de PUT .../exercises/{seid} (SessionExerciseUpdate).
export interface SessionExerciseUpdate {
  series_completed: number;
  reps_completed: number;
  accuracy_score?: number | null;
  feedback?: string | null;
}

// Respuesta del PUT de progreso (SessionExerciseResponse).
export interface SessionExerciseResponse {
  id: string;
  session_id: string;
  exercise_id: string;
  series_completed: number;
  reps_completed: number;
  accuracy_score: number | null;
  feedback: string | null;
}

// POST /api/sessions → crea la sesión (is_completed=False) y devuelve su id.
export const createSession = (
  patientId: string,
  routineId: string
): Promise<SessionResponse> =>
  apiFetch<SessionResponse>("/api/sessions", {
    method: "POST",
    auth: true,
    body: { patient_id: patientId, routine_id: routineId },
  });

// GET /api/sessions/{sessionId} → sesión con sus session_exercises (incluye
// series_completed reales) + duration_minutes. La pantalla de resumen final lo
// usa para mostrar datos reales en vez de valores hardcodeados.
export const getSessionById = (
  sessionId: string
): Promise<SessionResponse> =>
  apiFetch<SessionResponse>(`/api/sessions/${sessionId}`, {
    method: "GET",
    auth: true,
  });

// POST /api/sessions/{sessionId}/complete → marca la sesión como completada.
export const completeSession = (
  sessionId: string
): Promise<SessionResponse> =>
  apiFetch<SessionResponse>(
    `/api/sessions/${sessionId}/complete`,
    {
      method: "POST",
      auth: true,
    }
  );

// PUT /api/sessions/{sessionId}/exercises/{sessionExerciseId} → persiste progreso.
export const updateExerciseProgress = (
  sessionId: string,
  sessionExerciseId: string,
  data: SessionExerciseUpdate
): Promise<SessionExerciseResponse> =>
  apiFetch<SessionExerciseResponse>(
    `/api/sessions/${sessionId}/exercises/${sessionExerciseId}`,
    {
      method: "PUT",
      auth: true,
      body: data,
    }
  );
