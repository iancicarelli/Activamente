import React from "react";
import { fireEvent, waitFor } from "@testing-library/react-native";
import PatientHomeScreen from "../../screens/patient/PatientHomeScreen";
import PreviousSurveyScreen from "../../screens/patient/PreviousSurveyScreen";
import PostExerciseSurveyScreen from "../../screens/patient/PostExerciseSurveyScreen";
import ExerciseSessionCompletedScreen from "../../screens/patient/ExerciseSessionCompletedScreen";
import PatientHistoryScreen from "../../screens/patient/PatientHistoryScreen";
import PatientProfileScreen from "../../screens/patient/PatientProfileScreen";
import { renderScreen, mockRouter, setParams } from "./helpers";
import { __resetAuthForTests, setAuth } from "../../services/authStore";

jest.mock("../../services/meService", () => ({ getMe: jest.fn() }));
jest.mock("../../services/routineService", () => ({ getNextRoutine: jest.fn() }));
jest.mock("../../services/appointmentService", () => ({ getNextAppointment: jest.fn() }));
jest.mock("../../services/sessionService", () => ({ createSession: jest.fn(), completeSession: jest.fn(), getSessionById: jest.fn() }));
jest.mock("../../services/surveyService", () => ({ submitPreSurvey: jest.fn(), submitPostSurvey: jest.fn() }));
jest.mock("../../services/patientService", () => ({ getMySessions: jest.fn(), getPatientById: jest.fn() }));
jest.mock("../../services/profileService", () => ({ changePassword: jest.fn() }));

const me = jest.requireMock("../../services/meService");
const routines = jest.requireMock("../../services/routineService");
const appts = jest.requireMock("../../services/appointmentService");
const sessions = jest.requireMock("../../services/sessionService");
const surveys = jest.requireMock("../../services/surveyService");
const patients = jest.requireMock("../../services/patientService");

const routine = { id: "r1", name: "Rutina lumbar", exercises: [{ id: "re1", exercise_id: "squat", order_index: 0, level: 1, total_series: 2, total_reps: 10, rest_time_seconds: 30, time_limit_seconds: null }] };

beforeEach(() => {
  jest.clearAllMocks();
  __resetAuthForTests();
  setAuth({ token: "t", role: "PATIENT", userId: "u1", expiresAt: Date.now() + 100000 });
  setParams({});
  me.getMe.mockResolvedValue({ full_name: "Pedro Soto", email: "p@t.com", role: "PATIENT", patient: { rut: "98765432-5", age: 70, phone: "+569", address: null, specialists: [{ id: "s", full_name: "María González", specialty: "Kine", phone: "+56911", email: "m@t.cl" }] } });
  appts.getNextAppointment.mockResolvedValue(null);
});

describe("PatientHomeScreen", () => {
  test("hoy toca: muestra rutina y el botón Comenzar navega a la encuesta", async () => {
    routines.getNextRoutine.mockResolvedValue({ routine, next_date: "2026-09-13", is_today: true, days_until: 0 });
    const { findByText, getByTestId } = renderScreen(<PatientHomeScreen />);
    expect(await findByText("Rutina lumbar")).toBeTruthy();
    expect(await findByText(/Hola, Pedro/)).toBeTruthy();
    fireEvent.press(getByTestId("start-training"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/patient/survey-pre", params: { routineId: "r1" } });
  });

  test("no toca hoy: dice cuándo es la próxima", async () => {
    routines.getNextRoutine.mockResolvedValue({ routine, next_date: "2026-09-16", is_today: false, days_until: 3 });
    const { findByText } = renderScreen(<PatientHomeScreen />);
    expect(await findByText(/Hoy no tienes entrenamiento/)).toBeTruthy();
    expect(await findByText(/próximo entrenamiento es el miércoles/)).toBeTruthy();
  });

  test("sin rutina", async () => {
    routines.getNextRoutine.mockResolvedValue({ routine: null, next_date: null, is_today: false, days_until: null });
    const { findByText } = renderScreen(<PatientHomeScreen />);
    expect(await findByText(/Aún no tienes una rutina/)).toBeTruthy();
  });
});

describe("PreviousSurveyScreen", () => {
  test("crea la sesión, manda la encuesta 1-5 y navega con sessionId", async () => {
    setParams({ routineId: "r1" });
    sessions.createSession.mockResolvedValue({ id: "sess-1", session_exercises: [] });
    surveys.submitPreSurvey.mockResolvedValue({});
    const { getByTestId } = renderScreen(<PreviousSurveyScreen />);
    for (let i = 0; i < 3; i++) {
      fireEvent.press(getByTestId("scale-option-2"));
      fireEvent.press(getByTestId("survey-next"));
    }
    fireEvent.press(getByTestId("survey-submit"));
    await waitFor(() => expect(sessions.createSession).toHaveBeenCalledWith("r1"));
    expect(surveys.submitPreSurvey).toHaveBeenCalledWith({ session_id: "sess-1", pain_level: 2, fatigue_level: 2, stress_level: 2, comments: undefined });
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/patient/instruction", params: { sessionId: "sess-1", index: "0" } });
  });

  test("si falla muestra error y NO navega (BT-03)", async () => {
    setParams({ routineId: "r1" });
    sessions.createSession.mockRejectedValue(new Error("boom"));
    const { getByTestId, findByText } = renderScreen(<PreviousSurveyScreen />);
    for (let i = 0; i < 3; i++) {
      fireEvent.press(getByTestId("scale-option-1"));
      fireEvent.press(getByTestId("survey-next"));
    }
    fireEvent.press(getByTestId("survey-submit"));
    expect(await findByText("boom")).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe("PostExerciseSurveyScreen", () => {
  test("ánimo 1-5, completa la sesión una sola vez y navega", async () => {
    setParams({ sessionId: "sess-1" });
    surveys.submitPostSurvey.mockResolvedValue({});
    sessions.completeSession.mockResolvedValue({});
    const { getByTestId } = renderScreen(<PostExerciseSurveyScreen />);
    fireEvent.press(getByTestId("scale-option-4"));
    fireEvent.press(getByTestId("post-next"));
    fireEvent.press(getByTestId("scale-option-1"));
    fireEvent.press(getByTestId("post-submit"));
    await waitFor(() => expect(sessions.completeSession).toHaveBeenCalledTimes(1));
    expect(surveys.submitPostSurvey).toHaveBeenCalledWith({ session_id: "sess-1", mood_level: 4, pain_level: 1 });
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/patient/session-completed", params: { sessionId: "sess-1" } });
  });
});

describe("ExerciseSessionCompletedScreen", () => {
  test("resumen real y 'Listo' va al historial sin volver a completar", async () => {
    setParams({ sessionId: "sess-1" });
    sessions.getSessionById.mockResolvedValue({ id: "sess-1", duration_minutes: 12, is_completed: true, session_exercises: [{ reps_completed: 10, series_completed: 2 }, { reps_completed: 0, series_completed: 0 }] });
    const { findByText, getByTestId } = renderScreen(<ExerciseSessionCompletedScreen />);
    expect(await findByText(/Hiciste 1 de 2 ejercicios/)).toBeTruthy();
    fireEvent.press(getByTestId("completed-done"));
    expect(mockRouter.replace).toHaveBeenCalledWith("/patient/(tabs)/history");
    expect(sessions.completeSession).not.toHaveBeenCalled();
  });
});

describe("PatientHistoryScreen", () => {
  test("agrupa y muestra racha", async () => {
    patients.getMySessions.mockResolvedValue([{ id: "s1", name: "Rutina", date: new Date().toISOString(), completedAt: null, durationMinutes: 5, completed: true, exercisesTotal: 2, exercisesDone: 2, preSurvey: null, postSurvey: null }]);
    patients.getPatientById.mockResolvedValue({ metrics: { sessionsCompleted: 3, sessionsTotal: 4, adherencePercent: 75, sessionsCompletedThisWeek: 1, currentStreakDays: 2 } });
    const { findByText } = renderScreen(<PatientHistoryScreen />);
    expect(await findByText("Esta semana")).toBeTruthy();
    expect(await findByText("días seguidos")).toBeTruthy();
  });

  test("estado vacío", async () => {
    patients.getMySessions.mockResolvedValue([]);
    patients.getPatientById.mockResolvedValue({ metrics: null });
    const { findByText } = renderScreen(<PatientHistoryScreen />);
    expect(await findByText(/Aún no tienes sesiones/)).toBeTruthy();
  });
});

describe("PatientProfileScreen", () => {
  test("muestra especialista real con botón Llamar", async () => {
    const { findByText } = renderScreen(<PatientProfileScreen />);
    expect(await findByText("María González")).toBeTruthy();
    expect(await findByText("Llamar")).toBeTruthy();
  });
});
