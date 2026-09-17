/**
 * hooks/useSessionPlan.ts — carga rutina + sesión + catálogo para las pantallas
 * de instrucción y ejercicio activo. Reemplaza el "EXERCISES[index]" fijo por
 * la rutina REAL (HC-01/HC-02): orden, nivel, series, reps y descanso.
 */

import { useCallback, useEffect, useState } from "react";
import { getExercises, Exercise } from "../services/exerciseService";
import { getRoutineById, RoutineWithExercises } from "../services/routineService";
import { getSessionById, SessionResponse } from "../services/sessionService";
import { getErrorMessage } from "../utils/errors";
import type { ExercisePlan } from "./useExerciseSession";

export type SessionPlan = {
  routine: RoutineWithExercises;
  session: SessionResponse | null;
  catalog: Record<string, Exercise>;
};

export function buildExercisePlan(plan: SessionPlan, index: number): ExercisePlan | null {
  const re = plan.routine.exercises[index];
  if (!re) return null;
  const se = plan.session?.session_exercises.find((s) => s.routine_exercise_id === re.id) ?? plan.session?.session_exercises[index] ?? null;
  return {
    exerciseId: re.exercise_id,
    name: plan.catalog[re.exercise_id]?.name ?? re.exercise_id,
    level: re.level ?? 1,
    totalSeries: Math.max(1, re.total_series ?? 1),
    totalReps: Math.max(1, re.total_reps ?? 10),
    restSeconds: Math.max(0, re.rest_time_seconds ?? 0),
    sessionExerciseId: se?.id ?? null,
    exerciseIdx: index,
    totalExercises: plan.routine.exercises.length,
  };
}

export function useSessionPlan(params: { sessionId?: string; routineId?: string }) {
  const { sessionId, routineId } = params;
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let session: SessionResponse | null = null;
      let rid = routineId;
      if (sessionId) {
        session = await getSessionById(sessionId);
        rid = session.routine_id ?? rid;
      }
      if (!rid) throw new Error("No se encontró la rutina de esta sesión.");
      const [routine, exercises] = await Promise.all([getRoutineById(rid), getExercises()]);
      const catalog: Record<string, Exercise> = {};
      for (const e of exercises) catalog[e.id] = e;
      setPlan({ routine, session, catalog });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId, routineId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { plan, loading, error, reload: load };
}
