// services/appointmentService.ts
//
// Cliente de los endpoints de citas del backend (todos protegidos con auth):
//   GET  /api/appointments/available-slots?date=YYYY-MM-DD → cupos del día
//   POST /api/appointments                                 → agenda una cita
//   GET  /api/appointments/next                            → próxima cita (paciente)
//   GET  /api/appointments?date=YYYY-MM-DD                 → citas del especialista ese día
//
// El especialista se obtiene del token en el backend, por eso no se envía.

import { apiFetch } from "./apiClient";
import { getPatientById } from "./patientService";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TimeSlot {
  id: string;
  time: string;        // "HH:MM"
  available: boolean;
  note?: string;
}

export interface AppointmentPatient {
  id: string;
  fullName: string;
}

export interface AppointmentPayload {
  patientId: string;
  date: Date;
  timeSlot: string;    // "HH:MM"
}

export interface NextAppointment {
  id: string;
  date: string;        // "YYYY-MM-DD"
  time: string;        // "10:00 AM"
  specialistName: string;
}

// Cita ya formateada para la vista del calendario del especialista.
export interface Appointment {
  id: string;
  patientName: string;
  date: string;
  time: string;
  displayMonth: string;
  displayDay: string;
  displayFullDate: string;
}

// ─── Formas crudas del backend ─────────────────────────────────────────────────

interface RawSlot {
  time: string;
  available: boolean;
}

interface RawAvailableSlots {
  date: string;
  slots: RawSlot[];
}

interface RawAppointment {
  id: string;
  specialist_id: string | null;
  patient_id: string | null;
  patient_name: string;
  specialist_name: string;
  date: string;
  time_slot: string;
  status: string;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_SHORT = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

const WEEKDAYS = [
  "Domingo", "Lunes", "Martes", "Miércoles",
  "Jueves", "Viernes", "Sábado",
];

// Date → "YYYY-MM-DD" en hora local (evita el corrimiento de toISOString).
const toDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// "14:30:00" → "02:30 PM"
const formatTime = (timeSlot: string): string => {
  const [hStr, mStr] = timeSlot.split(":");
  let h = Number.parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${mStr ?? "00"} ${period}`;
};

const toAppointment = (raw: RawAppointment): Appointment => {
  // Parse local (sin TZ) para que el día no se corra.
  const d = new Date(`${raw.date}T00:00:00`);
  return {
    id: raw.id,
    patientName: raw.patient_name,
    date: raw.date,
    time: formatTime(raw.time_slot),
    displayMonth: MONTHS_SHORT[d.getMonth()],
    displayDay: String(d.getDate()),
    displayFullDate: `${WEEKDAYS[d.getDay()]}, ${d.getFullYear()}`,
  };
};

// ─── Funciones ────────────────────────────────────────────────────────────────

// GET /api/appointments/available-slots → cupos del día con su disponibilidad.
export const getAvailableSlots = async (date: Date): Promise<TimeSlot[]> => {
  const raw = await apiFetch<RawAvailableSlots>(
    `/api/appointments/available-slots?date=${toDateString(date)}`,
    { method: "GET", auth: true }
  );
  return raw.slots.map((s) => ({
    id: s.time,
    time: s.time,
    available: s.available,
  }));
};

// Reutiliza la ficha del paciente para mostrar su nombre en el resumen.
export const getPatientForAppointment = async (
  id: string
): Promise<AppointmentPatient> => {
  const patient = await getPatientById(id);
  return { id: patient.id, fullName: patient.fullName };
};

// POST /api/appointments → agenda la cita para el paciente indicado.
export const confirmAppointment = async (
  payload: AppointmentPayload
): Promise<void> => {
  await apiFetch("/api/appointments", {
    method: "POST",
    auth: true,
    body: {
      patient_id: payload.patientId,
      date: toDateString(payload.date),
      time_slot: payload.timeSlot,
    },
  });
};

// GET /api/appointments/next → próxima cita futura del paciente autenticado.
export const getNextAppointment = async (): Promise<NextAppointment | null> => {
  const raw = await apiFetch<RawAppointment | null>(
    "/api/appointments/next",
    { method: "GET", auth: true }
  );
  if (!raw) return null;
  return {
    id: raw.id,
    date: raw.date,
    time: formatTime(raw.time_slot),
    specialistName: raw.specialist_name,
  };
};

// GET /api/appointments?date= → citas del especialista para la fecha dada.
// El backend filtra por el especialista del token y ya las devuelve ordenadas por hora.
export const getAppointmentsByDate = async (
  date: string
): Promise<Appointment[]> => {
  const raw = await apiFetch<RawAppointment[]>(
    `/api/appointments?date=${date}`,
    { method: "GET", auth: true }
  );
  return raw.map(toAppointment);
};
