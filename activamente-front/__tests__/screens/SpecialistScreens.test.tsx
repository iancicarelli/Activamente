import React from "react";
import { fireEvent, waitFor } from "@testing-library/react-native";
import PatientListScreen from "../../screens/specialist/PatientListScreen";
import MedicalRecordScreen from "../../screens/specialist/MedicalRecordScreen";
import CalendarScreen from "../../screens/specialist/CalendarScreen";
import SpecialistHomeScreen from "../../screens/specialist/SpecialistHomeScreen";
import CreateRoutineScreen, { buildRoutinePayload } from "../../screens/specialist/CreateRoutineScreen";
import { renderScreen, mockRouter, setParams } from "./helpers";

jest.mock("../../services/patientService", () => ({ getPatients: jest.fn(), unassignPatient: jest.fn(), getPatientById: jest.fn(), setPatientAccountStatus: jest.fn() }));
jest.mock("../../services/appointmentService", () => ({
  getAppointmentsByDate: jest.fn(),
  getCalendarCounts: jest.fn(),
  updateAppointmentStatus: jest.fn(),
  STATUS_LABEL: { PENDING: "Pendiente", CONFIRMED: "Confirmada", CANCELLED: "Cancelada", COMPLETED: "Completada" },
}));
jest.mock("../../services/specialistService", () => ({ getDashboard: jest.fn() }));
jest.mock("../../services/exerciseService", () => ({ getExercises: jest.fn() }));
jest.mock("../../services/routineService", () => ({ createRoutine: jest.fn(), getRoutineById: jest.fn(), updateRoutine: jest.fn() }));

const patients = jest.requireMock("../../services/patientService");
const appts = jest.requireMock("../../services/appointmentService");
const dash = jest.requireMock("../../services/specialistService");
const exercises = jest.requireMock("../../services/exerciseService");
const routinesApi = jest.requireMock("../../services/routineService");

beforeEach(() => {
  jest.clearAllMocks();
  setParams({});
});

describe("PatientListScreen", () => {
  test("lista con badges y navegación a ficha", async () => {
    patients.getPatients.mockResolvedValue([
      { id: "p1", fullName: "Pedro Soto", rut: "98765432-5", age: 70, isActive: true, hasAlert: true, alertMessage: "Nivel de dolor alto", isNew: false, lastSessionDate: null },
      { id: "p2", fullName: "Ana Pérez", rut: null, age: null, isActive: false, hasAlert: false, alertMessage: null, isNew: true, lastSessionDate: null },
    ]);
    const { findByText, getAllByText } = renderScreen(<PatientListScreen />);
    expect(await findByText("Pedro Soto")).toBeTruthy();
    expect(await findByText("Nivel de dolor alto")).toBeTruthy();
    expect(await findByText("Sin sesiones aún")).toBeTruthy();
    expect(await findByText("Cuenta deshabilitada")).toBeTruthy();
    fireEvent.press(getAllByText("Ficha")[0]);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/specialist/medical-record", params: { patientId: "p1" } });
  });

  test("alerta de bienestar con su mensaje", async () => {
    patients.getPatients.mockResolvedValue([
      { id: "p1", fullName: "Pedro Soto", rut: null, age: null, isActive: true, hasAlert: true, alertMessage: "Dolor alto antes de la sesión · Estrés alto", alertKind: "wellbeing", isNew: false, lastSessionDate: null },
    ]);
    const { findByText } = renderScreen(<PatientListScreen />);
    expect(await findByText("Dolor alto antes de la sesión · Estrés alto")).toBeTruthy();
  });

  test("estado vacío", async () => {
    patients.getPatients.mockResolvedValue([]);
    const { findByText } = renderScreen(<PatientListScreen />);
    expect(await findByText(/Aún no tienes pacientes/)).toBeTruthy();
  });
});

describe("MedicalRecordScreen", () => {
  test("sin encuestas muestra el estado vacío de bienestar", async () => {
    setParams({ patientId: "p1" });
    patients.getPatientById.mockResolvedValue({
      id: "p1", fullName: "Ana", rut: "", age: null, gender: "", email: "a@t.com", phone: "", address: "", active: true, assignedToMe: true,
      metrics: null, sessions: [], wellbeing: null,
    });
    const { findByText } = renderScreen(<MedicalRecordScreen />);
    expect(await findByText("Sin encuestas todavía")).toBeTruthy();
  });

  test("muestra métricas de la semana y sesiones con encuestas", async () => {
    setParams({ patientId: "p1" });
    patients.getPatientById.mockResolvedValue({
      id: "p1", fullName: "Pedro Soto", rut: "98765432-5", age: 70, gender: "Masculino", email: "p@t.com", phone: "", address: "", active: true, assignedToMe: true,
      metrics: { sessionsCompleted: 2, sessionsTotal: 3, adherencePercent: 67, sessionsCompletedThisWeek: 1, currentStreakDays: 1 },
      sessions: [
        { id: "s2", name: "Rutina", date: "2026-09-14T10:00:00+00:00", completedAt: null, durationMinutes: 8, completed: true, exercisesTotal: 2, exercisesDone: 2, preSurvey: { pain_level: 4, fatigue_level: 2, stress_level: null, mood_level: null, comments: null }, postSurvey: { pain_level: 2, fatigue_level: null, stress_level: null, mood_level: 5, comments: "mejor" } },
        { id: "s1", name: "Rutina", date: "2026-09-13T10:00:00+00:00", completedAt: null, durationMinutes: 8, completed: true, exercisesTotal: 2, exercisesDone: 2, preSurvey: { pain_level: 2, fatigue_level: 2, stress_level: null, mood_level: null, comments: null }, postSurvey: null },
      ],
      wellbeing: {
        sessionId: "s2", date: "2026-09-14T10:00:00+00:00", hasAlert: true, reasons: ["Dolor alto antes de la sesión"],
        preSurvey: { pain_level: 4, fatigue_level: 2, stress_level: null, mood_level: null, comments: null },
        postSurvey: { pain_level: 2, fatigue_level: null, stress_level: null, mood_level: 5, comments: "mejor" },
      },
    });
    const { findByText, getAllByText } = renderScreen(<MedicalRecordScreen />);
    expect(await findByText("esta semana")).toBeTruthy();
    expect(await findByText(/67% de adherencia/)).toBeTruthy();
    expect(await findByText("Requiere atención")).toBeTruthy();
    expect(await findByText("Dolor alto antes de la sesión")).toBeTruthy();
    expect(getAllByText("Bastante").length).toBeGreaterThan(0);
    expect(getAllByText("El dolor bajó después de la sesión").length).toBeGreaterThan(0);
    expect(await findByText("Métricas en rojo")).toBeTruthy();
    expect(await findByText("Evolución")).toBeTruthy();
    expect(await findByText("Deshabilitar")).toBeTruthy();
  });
});

describe("CalendarScreen", () => {
  test("citas del día con estado y acciones", async () => {
    appts.getCalendarCounts.mockResolvedValue([]);
    appts.getAppointmentsByDate.mockResolvedValue([{ id: "a1", patientId: "p1", patientName: "Pedro Soto", specialistName: "M", date: "2026-09-14", time: "10:00", status: "CONFIRMED", notes: "Control" }]);
    const { findByText } = renderScreen(<CalendarScreen />);
    expect(await findByText("Pedro Soto")).toBeTruthy();
    expect(await findByText("Confirmada")).toBeTruthy();
    expect(await findByText("Completada")).toBeTruthy();
    expect(await findByText("10:00")).toBeTruthy();
  });
});

describe("SpecialistHomeScreen", () => {
  test("dashboard", async () => {
    dash.getDashboard.mockResolvedValue({ specialist: { full_name: "María", specialty: "Kine" }, stats: { total_patients: 3, active_today: 1, alerts: 2, avg_adherence: 80 }, progress: { sessions_completed_today: 1, sessions_total_today: 2, daily_compliance: 50 } });
    const { findByText } = renderScreen(<SpecialistHomeScreen />);
    expect(await findByText("Hola, María")).toBeTruthy();
    expect(await findByText("80%")).toBeTruthy();
  });
});

describe("CreateRoutineScreen", () => {
  test("buildRoutinePayload arma order_index y fechas ISO", () => {
    const payload = buildRoutinePayload({
      patientId: "p1",
      name: " Lumbar ",
      startDate: new Date(2026, 8, 14),
      endDate: new Date(2026, 9, 14),
      daysOfWeek: [5, 1, 3, 3],
      time: new Date(2026, 8, 14, 9, 30),
      items: [
        { exercise_id: "squat", name: "Sentadilla", maxLevel: 3, level: 2, total_series: 3, total_reps: 8, rest_time_seconds: 30 },
        { exercise_id: "toe_touch", name: "Toe", maxLevel: 3, level: 1, total_series: 1, total_reps: 10, rest_time_seconds: 0 },
      ],
    });
    expect(payload).toEqual({
      patient_id: "p1",
      name: "Lumbar",
      start_date: "2026-09-14",
      end_date: "2026-10-14",
      days_of_week: [1, 3, 5],
      scheduled_time: "09:30:00",
      exercises: [
        { exercise_id: "squat", order_index: 0, level: 2, total_series: 3, total_reps: 8, rest_time_seconds: 30 },
        { exercise_id: "toe_touch", order_index: 1, level: 1, total_series: 1, total_reps: 10, rest_time_seconds: 0 },
      ],
    });
  });

  test("solo ofrece los niveles del ejercicio y deshabilita Guardar hasta ser válido", async () => {
    setParams({ patientId: "p1" });
    exercises.getExercises.mockResolvedValue([{ id: "squat", name: "Sentadilla", description: null, instructions: null, multimedia_url: null, max_level: 2 }]);
    const { findByText, getByTestId, queryByText, queryByTestId } = renderScreen(<CreateRoutineScreen />);
    expect(await findByText("Sentadilla")).toBeTruthy();
    expect(getByTestId("save-routine").props.accessibilityState.disabled).toBe(true);
    fireEvent.press(await findByText("Agregar"));
    await waitFor(() => expect(queryByText("1. Sentadilla")).toBeTruthy());
    expect(queryByTestId("level-2")).toBeTruthy();
    expect(queryByTestId("level-3")).toBeNull(); // max_level 2 → no hay nivel 3
  });

  test("editar: precarga la rutina, permite varios días y guarda con updateRoutine", async () => {
    setParams({ patientId: "p1", routineId: "r1" });
    exercises.getExercises.mockResolvedValue([{ id: "squat", name: "Sentadilla", description: null, instructions: null, multimedia_url: null, max_level: 3 }]);
    routinesApi.getRoutineById.mockResolvedValue({
      id: "r1", specialist_id: "s", patient_id: "p1", name: "Piernas", start_date: "2026-09-01", end_date: "2026-10-01",
      days_of_week: [1], scheduled_time: "10:00:00", created_at: null,
      exercises: [{ id: "re1", exercise_id: "squat", order_index: 0, level: 2, total_series: 3, total_reps: 8, rest_time_seconds: 30, time_limit_seconds: null }],
    });
    routinesApi.updateRoutine.mockResolvedValue({});
    const { findByText, getByTestId } = renderScreen(<CreateRoutineScreen />);
    expect(await findByText("Editar rutina")).toBeTruthy();
    expect(await findByText("1. Sentadilla")).toBeTruthy();
    fireEvent.press(getByTestId("day-3"));
    fireEvent.press(getByTestId("day-5"));
    expect(await findByText("Lun, Mié y Vie")).toBeTruthy();
    fireEvent.press(getByTestId("save-routine"));
    await waitFor(() => expect(routinesApi.updateRoutine).toHaveBeenCalled());
    const [id, body] = routinesApi.updateRoutine.mock.calls[0];
    expect(id).toBe("r1");
    expect(body).not.toHaveProperty("patient_id");
    expect(body).toMatchObject({ name: "Piernas", start_date: "2026-09-01", days_of_week: [1, 3, 5], scheduled_time: "10:00:00" });
    expect(body.exercises[0]).toMatchObject({ exercise_id: "squat", level: 2, total_series: 3 });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  test("sin días elegidos no deja guardar", async () => {
    setParams({ patientId: "p1" });
    exercises.getExercises.mockResolvedValue([{ id: "squat", name: "Sentadilla", description: null, instructions: null, multimedia_url: null, max_level: 1 }]);
    const { findByText, getByTestId } = renderScreen(<CreateRoutineScreen />);
    fireEvent.press(await findByText("Agregar"));
    const todayIso = ((new Date().getDay() + 6) % 7) + 1;
    fireEvent.press(getByTestId(`day-${todayIso}`)); // desmarca el único día
    expect(await findByText("Elige al menos un día.")).toBeTruthy();
    expect(getByTestId("save-routine").props.accessibilityState.disabled).toBe(true);
  });
});
