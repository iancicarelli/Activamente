/**
 * hooks/useExerciseSession.ts — máquina de estados de la sesión de UN ejercicio
 * (EX-10 / TS-13), independiente de la cámara y testeable con renderHook o
 * llamando `sessionReducer` a mano.
 *
 * Fases: countdown → active → (rest → countdown …) → exerciseDone. `paused`
 * congela cualquiera de las tres primeras y `resume` vuelve a la anterior.
 *
 * Al cerrar cada serie llama `onSeriesDone(seriesCompleted, repsTotal)` para
 * persistir (EX-11); al terminar el ejercicio, `onExerciseDone`.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

export type SessionPhase = "idle" | "countdown" | "active" | "rest" | "paused" | "exerciseDone";

export type ExercisePlan = {
  exerciseId: string;
  name: string;
  level: number;
  totalSeries: number;
  totalReps: number;
  restSeconds: number;
  sessionExerciseId: string | null;
  exerciseIdx: number;
  totalExercises: number;
};

export type SessionState = {
  phase: SessionPhase;
  series: number; // 1-based
  reps: number; // en la serie actual
  totalRepsDone: number;
  seriesCompleted: number;
  countdown: number;
  restRemaining: number;
  pausedFrom: Exclude<SessionPhase, "paused" | "idle" | "exerciseDone"> | null;
};

export type SessionAction =
  | { type: "START" }
  | { type: "TICK" }
  | { type: "REP" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SKIP_REST" }
  | { type: "FINISH" }
  | { type: "RESET" };

export const COUNTDOWN_SECONDS = 3;

export const initialSessionState = (): SessionState => ({
  phase: "idle",
  series: 1,
  reps: 0,
  totalRepsDone: 0,
  seriesCompleted: 0,
  countdown: COUNTDOWN_SECONDS,
  restRemaining: 0,
  pausedFrom: null,
});

export function sessionReducer(state: SessionState, action: SessionAction, plan: ExercisePlan): SessionState {
  switch (action.type) {
    case "RESET":
      return initialSessionState();

    case "START":
      if (state.phase !== "idle") return state;
      return { ...state, phase: "countdown", countdown: COUNTDOWN_SECONDS };

    case "TICK": {
      if (state.phase === "countdown") {
        if (state.countdown > 1) return { ...state, countdown: state.countdown - 1 };
        return { ...state, phase: "active", countdown: 0 };
      }
      if (state.phase === "rest") {
        if (state.restRemaining > 1) return { ...state, restRemaining: state.restRemaining - 1 };
        return { ...state, phase: "countdown", restRemaining: 0, countdown: COUNTDOWN_SECONDS };
      }
      return state;
    }

    case "REP": {
      if (state.phase !== "active") return state;
      const reps = state.reps + 1;
      const totalRepsDone = state.totalRepsDone + 1;
      if (reps < plan.totalReps) return { ...state, reps, totalRepsDone };
      // Serie cerrada.
      const seriesCompleted = state.series;
      if (state.series >= plan.totalSeries) {
        return { ...state, reps, totalRepsDone, seriesCompleted, phase: "exerciseDone" };
      }
      const next = { ...state, reps: 0, totalRepsDone, seriesCompleted, series: state.series + 1 };
      if (plan.restSeconds > 0) return { ...next, phase: "rest", restRemaining: plan.restSeconds };
      return { ...next, phase: "countdown", countdown: COUNTDOWN_SECONDS };
    }

    case "PAUSE":
      if (state.phase !== "countdown" && state.phase !== "active" && state.phase !== "rest") return state;
      return { ...state, phase: "paused", pausedFrom: state.phase };

    case "RESUME":
      if (state.phase !== "paused" || !state.pausedFrom) return state;
      // Al reanudar desde 'active' damos una cuenta regresiva para prepararse.
      if (state.pausedFrom === "active") return { ...state, phase: "countdown", countdown: COUNTDOWN_SECONDS, pausedFrom: null };
      return { ...state, phase: state.pausedFrom, pausedFrom: null };

    case "SKIP_REST":
      if (state.phase !== "rest") return state;
      return { ...state, phase: "countdown", restRemaining: 0, countdown: COUNTDOWN_SECONDS };

    case "FINISH":
      if (state.phase === "exerciseDone") return state;
      return { ...state, phase: "exerciseDone", pausedFrom: null };

    default:
      return state;
  }
}

type Callbacks = {
  onSeriesDone?: (seriesCompleted: number, repsTotal: number) => void;
  onExerciseDone?: (state: SessionState) => void;
};

export function useExerciseSession(plan: ExercisePlan, callbacks: Callbacks = {}) {
  const planRef = useRef(plan);
  planRef.current = plan;
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const [state, rawDispatch] = useReducer(
    (s: SessionState, a: SessionAction) => sessionReducer(s, a, planRef.current),
    undefined,
    initialSessionState
  );

  const dispatch = useCallback((a: SessionAction) => rawDispatch(a), []);

  // Timer de 1 s para countdown y descanso.
  useEffect(() => {
    if (state.phase !== "countdown" && state.phase !== "rest") return;
    const id = setInterval(() => rawDispatch({ type: "TICK" }), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  // Callbacks al cerrar series / ejercicio.
  const lastSeriesNotified = useRef(0);
  useEffect(() => {
    if (state.seriesCompleted > lastSeriesNotified.current) {
      lastSeriesNotified.current = state.seriesCompleted;
      cbRef.current.onSeriesDone?.(state.seriesCompleted, state.totalRepsDone);
    }
  }, [state.seriesCompleted, state.totalRepsDone]);

  const doneNotified = useRef(false);
  useEffect(() => {
    if (state.phase === "exerciseDone" && !doneNotified.current) {
      doneNotified.current = true;
      cbRef.current.onExerciseDone?.(state);
    }
    if (state.phase === "idle") doneNotified.current = false;
  }, [state]);

  const actions = useMemo(
    () => ({
      start: () => dispatch({ type: "START" }),
      rep: () => dispatch({ type: "REP" }),
      pause: () => dispatch({ type: "PAUSE" }),
      resume: () => dispatch({ type: "RESUME" }),
      skipRest: () => dispatch({ type: "SKIP_REST" }),
      finish: () => dispatch({ type: "FINISH" }),
      reset: () => {
        lastSeriesNotified.current = 0;
        dispatch({ type: "RESET" });
      },
    }),
    [dispatch]
  );

  return { state, ...actions, isLastExercise: plan.exerciseIdx >= plan.totalExercises - 1 };
}
