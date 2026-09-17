// screens/specialist/CalendarScreen.tsx — calendario del especialista (UX-06):
// puntos en los días con citas, estado con color y acciones cancelar /
// completar (HC-07), horario 24 h (UX-08). Se pueden ver días pasados.
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Screen, Banner, Card, Button, Badge, MonthCalendar, LoadingView, EmptyState, ErrorView, SectionTitle, confirm, useToast } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { getAppointmentsByDate, getCalendarCounts, updateAppointmentStatus, Appointment, AppointmentStatus, STATUS_LABEL } from "../../services/appointmentService";
import { formatLongDate, parseLocalDate, toDateString } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";

const TONE: Record<AppointmentStatus, "success" | "warning" | "danger" | "neutral"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  CANCELLED: "danger",
  COMPLETED: "neutral",
};

const monthRange = (year: number, month: number) => ({
  from: toDateString(new Date(year, month, 1)),
  to: toDateString(new Date(year, month + 1, 0)),
});

export default function CalendarScreen() {
  const toast = useToast();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const initial = date ? parseLocalDate(date) : new Date();
  const todayIso = toDateString(new Date());

  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [selected, setSelected] = useState<string | null>(toDateString(initial));
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadMarks = useCallback(async () => {
    const { from, to } = monthRange(year, month);
    try {
      const counts = await getCalendarCounts(from, to);
      const map: Record<string, number> = {};
      for (const c of counts) map[c.date] = c.count;
      setMarks(map);
    } catch {
      setMarks({});
    }
  }, [year, month]);

  const loadDay = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      setAppointments(await getAppointmentsByDate(selected));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void loadMarks();
  }, [loadMarks]);

  useFocusEffect(
    useCallback(() => {
      void loadDay();
      void loadMarks();
    }, [loadDay, loadMarks])
  );

  // Si venimos de "Agendar" con una fecha nueva, saltamos a ese día.
  useEffect(() => {
    if (!date) return;
    const d = parseLocalDate(date);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(date);
  }, [date]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const changeStatus = async (a: Appointment, status: AppointmentStatus) => {
    const label = status === "CANCELLED" ? "cancelar" : "marcar como completada";
    const ok = await confirm("Confirmar", `¿Quieres ${label} la cita de ${a.patientName} a las ${a.time}?`, { confirmText: "Sí", destructive: status === "CANCELLED" });
    if (!ok) return;
    setUpdatingId(a.id);
    try {
      const updated = await updateAppointmentStatus(a.id, status);
      setAppointments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      void loadMarks();
      toast(status === "CANCELLED" ? "Cita cancelada" : "Cita completada");
    } catch (e) {
      toast(getErrorMessage(e), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Screen>
      <Banner overline="Panel profesional" title="Calendario" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <MonthCalendar year={year} month={month} selected={selected} onSelect={setSelected} onPrevMonth={prevMonth} onNextMonth={nextMonth} marks={marks} todayIso={todayIso} />

        <SectionTitle>{selected ? `Citas del ${formatLongDate(selected).toLowerCase()}` : "Citas"}</SectionTitle>
        {loading ? (
          <LoadingView />
        ) : error ? (
          <ErrorView message={error} onRetry={loadDay} />
        ) : appointments.length === 0 ? (
          <EmptyState icon="calendar-check" title="Sin citas" message="No hay citas para esta fecha." />
        ) : (
          appointments.map((a) => (
            <Card key={a.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.time}>{a.time}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patient}>{a.patientName}</Text>
                  {a.notes ? <Text style={styles.notes}>{a.notes}</Text> : null}
                </View>
                <Badge label={STATUS_LABEL[a.status]} tone={TONE[a.status]} />
              </View>
              {(a.status === "CONFIRMED" || a.status === "PENDING") && (
                <View style={styles.actions}>
                  <Button title="Cancelar" variant="outline" size="sm" icon="close" onPress={() => changeStatus(a, "CANCELLED")} loading={updatingId === a.id} style={{ flex: 1 }} />
                  <Button title="Completada" size="sm" icon="check" onPress={() => changeStatus(a, "COMPLETED")} loading={updatingId === a.id} style={{ flex: 1 }} />
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  card: { borderLeftWidth: 4, borderLeftColor: Colors.btnTeal },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  time: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.textPrimary, minWidth: 60 },
  patient: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  notes: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
});
