// services/appointmentService.ts
//   GET   /api/appointments/available-slots?date=
//   POST  /api/appointments
//   GET   /api/appointments/next                 (paciente)
//   GET   /api/appointments?date|from|to|patient_id
//   GET   /api/appointments/calendar?from&to     (conteo por día)
//   PATCH /api/appointments/{id}/status
import { apiFetch } from "./apiClient";
import { formatTime24, toDateString } from "../utils/dates";

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export interface TimeSlot {
  id: string;
  time: string;      // "HH:MM"
  available: boolean;
}

export interface AppointmentPayload {
  patientId: string;
  date: Date;
  timeSlot: string;  // "HH:MM"
  notes?: string;
}

export interface Appointment {
  id: string;
  patientId: string | null;
  patientName: string;
  specialistName: string;
  date: string;      // "YYYY-MM-DD"
  time: string;      // "HH:MM" (24 h)
  status: AppointmentStatus;
  notes: string | null;
}

export interface DayCount {
  date: string;
  count: number;
}

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
  status: AppointmentStatus;
  notes: string | null;
}

export const toAppointment = (raw: RawAppointment): Appointment => ({
  id: raw.id,
  patientId: raw.patient_id,
  patientName: raw.patient_name,
  specialistName: raw.specialist_name,
  date: raw.date,
  time: formatTime24(raw.time_slot),
  status: raw.status,
  notes: raw.notes,
});

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};

export const getAvailableSlots = async (date: Date): Promise<TimeSlot[]> => {
  const raw = await apiFetch<RawAvailableSlots>(`/api/appointments/available-slots?date=${toDateString(date)}`);
  return raw.slots.map((s) => ({ id: s.time, time: s.time, available: s.available }));
};

export const confirmAppointment = (payload: AppointmentPayload): Promise<Appointment> =>
  apiFetch<RawAppointment>("/api/appointments", {
    method: "POST",
    body: {
      patient_id: payload.patientId,
      date: toDateString(payload.date),
      time_slot: payload.timeSlot,
      notes: payload.notes?.trim() || undefined,
    },
  }).then(toAppointment);

export const getNextAppointment = async (): Promise<Appointment | null> => {
  const raw = await apiFetch<RawAppointment | null>("/api/appointments/next");
  return raw ? toAppointment(raw) : null;
};

export interface ListAppointmentsParams {
  date?: string;
  from?: string;
  to?: string;
  patientId?: string;
}

export const listAppointments = async (params: ListAppointmentsParams = {}): Promise<Appointment[]> => {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.patientId) query.set("patient_id", params.patientId);
  const qs = query.toString();
  const raw = await apiFetch<RawAppointment[]>(`/api/appointments${qs ? `?${qs}` : ""}`);
  return raw.map(toAppointment);
};

export const getAppointmentsByDate = (date: string): Promise<Appointment[]> => listAppointments({ date });

export const getCalendarCounts = (from: string, to: string): Promise<DayCount[]> =>
  apiFetch<DayCount[]>(`/api/appointments/calendar?from=${from}&to=${to}`);

export const updateAppointmentStatus = (id: string, status: AppointmentStatus): Promise<Appointment> =>
  apiFetch<RawAppointment>(`/api/appointments/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  }).then(toAppointment);
