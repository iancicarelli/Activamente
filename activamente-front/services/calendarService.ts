// services/calendarService.ts
//
// Cliente del listado de citas del especialista:
//   GET /api/appointments?date=YYYY-MM-DD → citas del especialista en esa fecha
//
// El backend filtra por el especialista del token y ya devuelve las citas
// ordenadas por hora. Aquí solo damos formato para la vista del calendario.

import { apiFetch } from "./apiClient";

export interface Appointment {
  id: string;
  patientName: string;
  date: string;
  time: string;
  displayMonth: string;
  displayDay: string;
  displayFullDate: string;
}

interface RawAppointment {
  id: string;
  specialist_id: string | null;
  patient_id: string | null;
  patient_name: string;
  specialist_name: string;
  date: string;       // "YYYY-MM-DD"
  time_slot: string;  // "HH:MM:SS"
  status: string;
  notes: string | null;
}

const MONTHS_SHORT = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

const WEEKDAYS = [
  "Domingo", "Lunes", "Martes", "Miércoles",
  "Jueves", "Viernes", "Sábado",
];

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

// GET /api/appointments?date= → citas del especialista para la fecha dada.
export const getAppointmentsByDate = async (
  date: string
): Promise<Appointment[]> => {
  const raw = await apiFetch<RawAppointment[]>(
    `/api/appointments?date=${date}`,
    { method: "GET", auth: true }
  );
  return raw.map(toAppointment);
};
