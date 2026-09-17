import { act, renderHook } from "@testing-library/react-native";
import { COUNTDOWN_SECONDS, ExercisePlan, initialSessionState, sessionReducer, useExerciseSession } from "../../hooks/useExerciseSession";

const plan: ExercisePlan = {
  exerciseId: "squat",
  name: "Sentadilla",
  level: 1,
  totalSeries: 2,
  totalReps: 3,
  restSeconds: 2,
  sessionExerciseId: "se-1",
  exerciseIdx: 0,
  totalExercises: 2,
};

const reduce = (actions: Parameters<typeof sessionReducer>[1][], p = plan) =>
  actions.reduce((s, a) => sessionReducer(s, a, p), initialSessionState());

describe("sessionReducer", () => {
  test("START → countdown → active tras N ticks", () => {
    const s = reduce([{ type: "START" }, { type: "TICK" }, { type: "TICK" }, { type: "TICK" }]);
    expect(s.phase).toBe("active");
  });

  test("REP solo cuenta en active", () => {
    expect(reduce([{ type: "REP" }]).reps).toBe(0);
    const s = reduce([{ type: "START" }, { type: "TICK" }, { type: "TICK" }, { type: "TICK" }, { type: "REP" }]);
    expect(s.reps).toBe(1);
    expect(s.totalRepsDone).toBe(1);
  });

  test("al completar la serie 1 pasa a rest y luego a countdown de la serie 2", () => {
    const toActive = [{ type: "START" as const }, ...Array(COUNTDOWN_SECONDS).fill({ type: "TICK" as const })];
    let s = reduce([...toActive, { type: "REP" }, { type: "REP" }, { type: "REP" }]);
    expect(s.phase).toBe("rest");
    expect(s.seriesCompleted).toBe(1);
    expect(s.series).toBe(2);
    expect(s.reps).toBe(0);
    expect(s.restRemaining).toBe(2);
    s = sessionReducer(s, { type: "TICK" }, plan);
    s = sessionReducer(s, { type: "TICK" }, plan);
    expect(s.phase).toBe("countdown");
  });

  test("sin descanso pasa directo a countdown", () => {
    const p = { ...plan, restSeconds: 0 };
    const s = reduce([{ type: "START" }, { type: "TICK" }, { type: "TICK" }, { type: "TICK" }, { type: "REP" }, { type: "REP" }, { type: "REP" }], p);
    expect(s.phase).toBe("countdown");
  });

  test("última serie → exerciseDone", () => {
    const p = { ...plan, totalSeries: 1 };
    const s = reduce([{ type: "START" }, { type: "TICK" }, { type: "TICK" }, { type: "TICK" }, { type: "REP" }, { type: "REP" }, { type: "REP" }], p);
    expect(s.phase).toBe("exerciseDone");
    expect(s.seriesCompleted).toBe(1);
    expect(s.totalRepsDone).toBe(3);
  });

  test("pausa y reanudación desde active vuelve con countdown", () => {
    let s = reduce([{ type: "START" }, { type: "TICK" }, { type: "TICK" }, { type: "TICK" }, { type: "REP" }, { type: "PAUSE" }]);
    expect(s.phase).toBe("paused");
    expect(s.pausedFrom).toBe("active");
    s = sessionReducer(s, { type: "REP" }, plan);
    expect(s.reps).toBe(1); // no cuenta en pausa
    s = sessionReducer(s, { type: "RESUME" }, plan);
    expect(s.phase).toBe("countdown");
    expect(s.reps).toBe(1); // conserva el progreso
  });

  test("SKIP_REST y FINISH", () => {
    let s = reduce([{ type: "START" }, { type: "TICK" }, { type: "TICK" }, { type: "TICK" }, { type: "REP" }, { type: "REP" }, { type: "REP" }]);
    s = sessionReducer(s, { type: "SKIP_REST" }, plan);
    expect(s.phase).toBe("countdown");
    s = sessionReducer(s, { type: "FINISH" }, plan);
    expect(s.phase).toBe("exerciseDone");
  });
});

describe("useExerciseSession (timers + callbacks)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("countdown avanza solo y notifica series y fin", () => {
    const onSeriesDone = jest.fn();
    const onExerciseDone = jest.fn();
    const { result } = renderHook(() => useExerciseSession({ ...plan, totalSeries: 1, totalReps: 2 }, { onSeriesDone, onExerciseDone }));

    act(() => result.current.start());
    expect(result.current.state.phase).toBe("countdown");
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.state.phase).toBe("active");

    act(() => result.current.rep());
    act(() => result.current.rep());
    expect(result.current.state.phase).toBe("exerciseDone");
    expect(onSeriesDone).toHaveBeenCalledWith(1, 2);
    expect(onExerciseDone).toHaveBeenCalledTimes(1);
    expect(result.current.isLastExercise).toBe(false);
  });

  test("el descanso cuenta hacia atrás con el timer", () => {
    const { result } = renderHook(() => useExerciseSession(plan));
    act(() => result.current.start());
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    act(() => result.current.rep());
    act(() => result.current.rep());
    act(() => result.current.rep());
    expect(result.current.state.phase).toBe("rest");
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.state.phase).toBe("countdown");
    expect(result.current.state.series).toBe(2);
  });
});
