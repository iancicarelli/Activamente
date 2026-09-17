import { toPatient, toPatientListItem, toSessionItem } from "../../services/patientService";
import { toAdminUser } from "../../services/userService";
import { toAppointment } from "../../services/appointmentService";
import { loginApi } from "../../services/authService";
import { __resetAuthForTests, getSession } from "../../services/authStore";

describe("mappers", () => {
  test("toPatient rellena vacíos y mapea sesiones", () => {
    const p = toPatient({
      id: "p1",
      fullName: "Pedro Soto",
      email: "p@t.com",
      active: true,
      sessions: [
        { id: "s1", name: "Rutina", date: "2026-09-13T10:00:00+00:00", completed_at: null, duration_minutes: 12, completed: true, exercises_total: 4, exercises_done: 3, pre_survey: null, post_survey: { pain_level: null, fatigue_level: null, stress_level: null, mood_level: 4, comments: null } },
      ],
    } as any);
    expect(p.rut).toBe("");
    expect(p.age).toBeNull();
    expect(p.sessions[0]).toMatchObject({ durationMinutes: 12, exercisesDone: 3, postSurvey: { mood_level: 4 } });
    expect(p.wellbeing).toBeNull();
  });

  test("toPatient mapea el estado de bienestar", () => {
    const p = toPatient({
      id: "p1", fullName: "Pedro", email: "p@t.com", active: true,
      wellbeing: { session_id: "s1", date: "2026-09-13T10:00:00+00:00", has_alert: true, reasons: ["Estrés alto"], pre_survey: null, post_survey: null },
    } as any);
    expect(p.wellbeing).toEqual({ sessionId: "s1", date: "2026-09-13T10:00:00+00:00", hasAlert: true, reasons: ["Estrés alto"], preSurvey: null, postSurvey: null });
  });

  test("toSessionItem", () => {
    expect(toSessionItem({ id: "s", name: "n", date: "d", completed_at: "c", duration_minutes: null, completed: false, exercises_total: 1, exercises_done: 0, pre_survey: null, post_survey: null } as any).completedAt).toBe("c");
  });

  test("toPatientListItem arma el nombre", () => {
    const item = toPatientListItem({ id: "1", first_name: "Ana", last_name: null, email: "a", rut: null, age: null, is_active: true, hasAlert: false, alertMessage: null, isNew: true, lastSessionDate: null } as any);
    expect(item.fullName).toBe("Ana");
    expect(item.alertKind).toBeNull();
  });

  test("toAdminUser traduce el rol", () => {
    expect(toAdminUser({ id: "1", first_name: "A", last_name: "B", email: "e", role: "SPECIALIST", is_active: true, created_at: null, rut: null, phone: null }).role).toBe("especialista");
  });

  test("toAppointment usa 24 h", () => {
    const a = toAppointment({ id: "1", specialist_id: null, patient_id: "p", patient_name: "P", specialist_name: "S", date: "2026-09-14", time_slot: "15:30:00", status: "CONFIRMED", notes: null });
    expect(a.time).toBe("15:30");
  });
});

describe("loginApi", () => {
  beforeEach(() => {
    __resetAuthForTests();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: "t", token_type: "bearer", role: "PATIENT", user_id: "u", expires_in: 3600 }),
    });
  });

  test("con email manda email en minúsculas", async () => {
    await loginApi("Pedro@Test.com", "x");
    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ email: "pedro@test.com", password: "x" });
    expect(getSession()).toMatchObject({ token: "t", role: "PATIENT", userId: "u" });
  });

  test("con RUT manda rut normalizado", async () => {
    await loginApi("98.765.432-5", "x");
    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ rut: "987654325", password: "x" });
  });
});
