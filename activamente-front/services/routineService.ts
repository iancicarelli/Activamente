// services/routineService.ts
//   POST   /api/routines
//   PUT    /api/routines/{id}                 (editar; ejercicios se sincronizan por exercise_id)
//   GET    /api/routines?patient_id=
//   GET    /api/routines/{id}
//   GET    /api/routines/active?patient_id=   (404 → null)
//   GET    /api/routines/next?patient_id=     (EP-05)
//   DELETE /api/routines/{id}
import { apiFetch, ApiError } from "./apiClient";

export interface RoutineExerciseCreate {
  exercise_id: string;
  order_index: number;
  level: number;
  total_series: number;
  total_reps: number;
  rest_time_seconds?: number | null;
  time_limit_seconds?: number | null;
}

export interface RoutineUpdate {
  name: string;
  start_date: string;      // YYYY-MM-DD
  end_date: string;        // YYYY-MM-DD
  days_of_week: number[];  // 1 lunes … 7 domingo, al menos uno
  scheduled_time: string | null;  // HH:MM:SS
  exercises: RoutineExerciseCreate[];
}

export interface RoutineCreate extends RoutineUpdate {
  patient_id: string;
}

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

export interface Routine {
  id: string;
  specialist_id: string | null;
  patient_id: string;
  name: string;
  start_date: string;
  end_date: string;
  days_of_week: number[];
  scheduled_time: string | null;
  created_at: string | null;
}

export interface RoutineWithExercises extends Routine {
  exercises: RoutineExercise[];
}

export interface NextRoutine {
  routine: RoutineWithExercises | null;
  next_date: string | null;
  is_today: boolean;
  days_until: number | null;
}

const sortExercises = (r: RoutineWithExercises): RoutineWithExercises => ({
  ...r,
  exercises: [...r.exercises].sort((a, b) => a.order_index - b.order_index),
});

export const createRoutine = (data: RoutineCreate): Promise<RoutineWithExercises> =>
  apiFetch<RoutineWithExercises>("/api/routines", { method: "POST", body: data }).then(sortExercises);

export const updateRoutine = (routineId: string, data: RoutineUpdate): Promise<RoutineWithExercises> =>
  apiFetch<RoutineWithExercises>(`/api/routines/${encodeURIComponent(routineId)}`, { method: "PUT", body: data }).then(sortExercises);

export const deleteRoutine = (routineId: string): Promise<void> =>
  apiFetch<void>(`/api/routines/${encodeURIComponent(routineId)}`, { method: "DELETE" });

export const getRoutinesByPatient = (patientId: string): Promise<RoutineWithExercises[]> =>
  apiFetch<RoutineWithExercises[]>(`/api/routines?patient_id=${encodeURIComponent(patientId)}`).then((rs) =>
    rs.map(sortExercises)
  );

export const getRoutineById = (routineId: string): Promise<RoutineWithExercises> =>
  apiFetch<RoutineWithExercises>(`/api/routines/${encodeURIComponent(routineId)}`).then(sortExercises);

export const getActiveRoutine = async (patientId: string): Promise<RoutineWithExercises | null> => {
  try {
    return sortExercises(
      await apiFetch<RoutineWithExercises>(`/api/routines/active?patient_id=${encodeURIComponent(patientId)}`)
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
};

export const getNextRoutine = (patientId: string): Promise<NextRoutine> =>
  apiFetch<NextRoutine>(`/api/routines/next?patient_id=${encodeURIComponent(patientId)}`).then((n) => ({
    ...n,
    routine: n.routine ? sortExercises(n.routine) : null,
  }));
