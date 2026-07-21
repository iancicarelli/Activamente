// services/routineService.ts
//
// Cliente de los endpoints de rutinas del backend:
//   POST /api/routines                       (crea rutina + ejercicios)
//   GET  /api/routines?patient_id={uuid}     (rutinas de un paciente)
//
// Sigue el patrón de authService.ts: usa apiFetch (auth: true por defecto), que
// adjunta el Bearer token desde authStore. El backend toma specialist_id del
// token, por eso no se envía en el body.

import { apiFetch, ApiError } from "./apiClient";

// Un ejercicio dentro del body de creación (RoutineExerciseCreate).
export interface RoutineExerciseCreate {
  exercise_id: string;
  order_index: number;
  level: number;
  total_series: number;
  total_reps: number;
  rest_time_seconds?: number | null;
  time_limit_seconds?: number | null;
}

// Body de POST /api/routines (RoutineCreate). Las fechas/horas viajan como
// strings ISO ("2026-06-13" para date, "10:30:00" para time).
export interface RoutineCreate {
  patient_id: string;
  name: string;
  start_date: string;
  end_date: string;
  day_of_week: number;
  scheduled_time: string;
  exercises: RoutineExerciseCreate[];
}

// Forma base de una rutina devuelta por el backend (RoutineResponse).
export interface Routine {
  id: string;
  specialist_id: string;
  patient_id: string;
  name: string;
  start_date: string;
  end_date: string;
  day_of_week: number;
  scheduled_time: string;
  created_at: string;
}

// Ejercicio anidado en la respuesta con ejercicios (RoutineExerciseResponse).
export interface RoutineExercise {
  id: string;
  exercise_id: string;
  order_index: number;
  level: number;
  total_series: number;
  total_reps: number;
  rest_time_seconds: number | null;
  time_limit_seconds: number | null;
}

// GET /api/routines devuelve la rutina con sus ejercicios anidados.
export interface RoutineWithExercises extends Routine {
  exercises: RoutineExercise[];
}

// POST /api/routines → crea una rutina y sus ejercicios en una transacción.
export const createRoutine = (data: RoutineCreate): Promise<Routine> =>
  apiFetch<Routine>("/api/routines", {
    method: "POST",
    auth: true,
    body: data,
  });

// DELETE /api/routines/{routineId} → hard delete de la rutina (CASCADE en
// routine_exercises). El backend responde 204 sin body.
export const deleteRoutine = (routineId: string): Promise<void> =>
  apiFetch<void>(`/api/routines/${encodeURIComponent(routineId)}`, {
    method: "DELETE",
    auth: true,
  });

// GET /api/routines?patient_id={patientId} → rutinas del paciente.
export const getRoutinesByPatient = (
  patientId: string
): Promise<RoutineWithExercises[]> =>
  apiFetch<RoutineWithExercises[]>(
    `/api/routines?patient_id=${encodeURIComponent(patientId)}`,
    {
      method: "GET",
      auth: true,
    }
  );

// GET /api/routines/active?patient_id={patientId} → rutina vigente para HOY.
// El backend responde 404 ("Sin rutina activa para hoy") cuando no hay ninguna;
// eso es un estado valido, no un error, asi que lo traducimos a null.
export const getActiveRoutine = async (
  patientId: string
): Promise<RoutineWithExercises | null> => {
  try {
    return await apiFetch<RoutineWithExercises>(
      `/api/routines/active?patient_id=${encodeURIComponent(patientId)}`,
      { method: "GET", auth: true }
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return null;
    }
    throw e;
  }
};
