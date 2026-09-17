import { buildCalendar, formatLongDate, formatWeekdays, formatNumericDate, formatShortDate, formatTime24, isoWeekdayName, parseLocalDate, relativeDayLabel, toDateString, weekStart } from "../../utils/dates";

describe("dates", () => {
  test("toDateString / parseLocalDate no corren el día", () => {
    const d = new Date(2026, 8, 13, 23, 30);
    expect(toDateString(d)).toBe("2026-09-13");
    expect(parseLocalDate("2026-09-13").getDate()).toBe(13);
  });
  test("formatTime24", () => {
    expect(formatTime24("14:30:00")).toBe("14:30");
    expect(formatTime24("9:05")).toBe("09:05");
  });
  test("fechas en español", () => {
    expect(formatLongDate("2026-09-13")).toBe("Domingo 13 de septiembre");
    expect(formatShortDate("2026-09-14")).toBe("Lun 14 sep");
    expect(formatNumericDate("2026-09-13")).toBe("13/09/2026");
    expect(isoWeekdayName(1)).toBe("Lunes");
    expect(isoWeekdayName(7)).toBe("Domingo");
  });
  test("relativeDayLabel", () => {
    expect(relativeDayLabel("2026-09-13", 0)).toBe("hoy");
    expect(relativeDayLabel("2026-09-14", 1)).toBe("mañana");
    expect(relativeDayLabel("2026-09-16", 3)).toBe("el miércoles");
    expect(relativeDayLabel("2026-10-01", 18)).toBe("el 1 de octubre");
  });
  test("buildCalendar: semanas completas de lunes a domingo", () => {
    const weeks = buildCalendar(2026, 8); // septiembre 2026 empieza martes
    expect(weeks[0][0]).toEqual({ day: 31, inMonth: false, iso: "2026-08-31" });
    expect(weeks[0][1]).toEqual({ day: 1, inMonth: true, iso: "2026-09-01" });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
  test("weekStart es lunes", () => {
    expect(weekStart(new Date(2026, 8, 13)).getDay()).toBe(1);
    expect(weekStart(new Date(2026, 8, 14)).getDate()).toBe(14);
  });

  test("formatWeekdays", () => {
    expect(formatWeekdays([3])).toBe("Miércoles");
    expect(formatWeekdays([5, 1, 3])).toBe("Lun, Mié y Vie");
    expect(formatWeekdays([1, 2, 3, 4, 5])).toBe("Lunes a viernes");
    expect(formatWeekdays([7, 6, 5, 4, 3, 2, 1])).toBe("Todos los días");
    expect(formatWeekdays([])).toBe("—");
  });
});
