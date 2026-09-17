// utils/dates.ts — fechas en español y helpers de calendario. El backend manda
// ISO (YYYY-MM-DD, HH:MM:SS o ISO 8601 con zona); acá se formatea para la UI.

export const WEEKDAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const WEEKDAYS_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const MONTHS_SHORT_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// days_of_week del backend: 1 = lunes … 7 = domingo.
export const ISO_WEEKDAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const ISO_WEEKDAYS_SHORT_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const isoWeekdayName = (d: number): string => ISO_WEEKDAYS_ES[d - 1] ?? "—";

// [1, 3, 5] → "Lun, Mié y Vie"; los 7 → "Todos los días"; lun-vie → "Lunes a viernes".
export const formatWeekdays = (days: number[]): string => {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return "—";
  if (sorted.length === 7) return "Todos los días";
  if (sorted.join() === "1,2,3,4,5") return "Lunes a viernes";
  if (sorted.length === 1) return isoWeekdayName(sorted[0]);
  const names = sorted.map((d) => ISO_WEEKDAYS_SHORT_ES[d - 1]);
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// Date → "YYYY-MM-DD" en hora local (evita el corrimiento de toISOString).
export const toDateString = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// "YYYY-MM-DD" → Date local a las 00:00 (sin corrimiento de zona).
export const parseLocalDate = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const todayLocal = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// "14:30:00" | "14:30" → "14:30" (formato chileno 24 h, UX-08).
export const formatTime24 = (time: string): string => {
  const [h, m] = time.split(":");
  return `${pad2(Number(h))}:${m ?? "00"}`;
};

// "2026-09-13" → "Sábado 13 de septiembre"
export const formatLongDate = (iso: string): string => {
  const d = parseLocalDate(iso);
  return `${WEEKDAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
};

// "2026-09-13" → "Sáb 13 sep"
export const formatShortDate = (iso: string): string => {
  const d = parseLocalDate(iso);
  return `${WEEKDAYS_SHORT_ES[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT_ES[d.getMonth()]}`;
};

// "2026-09-13" → "13/09/2026"
export const formatNumericDate = (iso: string): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

// ISO 8601 con zona ("2026-09-13T14:03:00+00:00") → "Sábado 13 de septiembre, 11:03"
export const formatDateTime = (isoDateTime: string): string => {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "—";
  return `${WEEKDAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// ISO 8601 → "13 de septiembre de 2026"
export const formatMemberSince = (iso: string | null | undefined): string => {
  if (!iso) return "No disponible";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
};

// Texto relativo simple para la home del paciente ("hoy", "mañana", "el miércoles").
export const relativeDayLabel = (iso: string, daysUntil: number): string => {
  if (daysUntil === 0) return "hoy";
  if (daysUntil === 1) return "mañana";
  const d = parseLocalDate(iso);
  if (daysUntil < 7) return `el ${WEEKDAYS_ES[d.getDay()].toLowerCase()}`;
  return `el ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
};

// Lunes de la semana de una fecha local (para agrupar historial).
export const weekStart = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const dow = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - dow);
  return copy;
};

export type CalDay = { day: number; inMonth: boolean; iso: string };

// Grilla de calendario (semanas de lunes a domingo) para un mes.
export const buildCalendar = (year: number, month: number): CalDay[][] => {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const flat: CalDay[] = [];
  const isoFor = (y: number, m: number, d: number) => toDateString(new Date(y, m, d));

  for (let i = firstDow - 1; i >= 0; i--) {
    flat.push({ day: daysInPrev - i, inMonth: false, iso: isoFor(year, month - 1, daysInPrev - i) });
  }
  for (let d = 1; d <= daysInMonth; d++) flat.push({ day: d, inMonth: true, iso: isoFor(year, month, d) });
  let next = 1;
  while (flat.length % 7 !== 0) {
    flat.push({ day: next, inMonth: false, iso: isoFor(year, month + 1, next) });
    next++;
  }
  const weeks: CalDay[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
};

export const monthTitle = (year: number, month: number): string => {
  const name = MONTHS_ES[month];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
};
