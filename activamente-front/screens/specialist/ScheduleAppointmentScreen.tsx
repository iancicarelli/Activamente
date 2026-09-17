// screens/specialist/ScheduleAppointmentScreen.tsx — agendar hora en 3 pasos:
// día (sin pasados, EP-06/HC-06), horario libre, resumen con notas reales.
// Sin textos falsos de notificación ni consultorio.
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Field, KeyboardAwareScrollView, MonthCalendar, InlineError, LoadingView, ErrorView, useToast } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { confirmAppointment, getAvailableSlots, TimeSlot } from "../../services/appointmentService";
import { getPatientById } from "../../services/patientService";
import { formatLongDate, parseLocalDate, toDateString } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <View style={styles.stepHead}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{n}</Text>
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

export default function ScheduleAppointmentScreen() {
  const router = useRouter();
  const toast = useToast();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const today = new Date();
  const todayIso = toDateString(today);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(todayIso);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [patientName, setPatientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setLoadError("No se indicó el paciente.");
      setLoading(false);
      return;
    }
    getPatientById(patientId)
      .then((p) => setPatientName(p.fullName))
      .catch((e) => setLoadError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => {
    if (!selected) return;
    setSlotsLoading(true);
    setSlot(null);
    getAvailableSlots(parseLocalDate(selected))
      .then(setSlots)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setSlotsLoading(false));
  }, [selected]);

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

  const submit = async () => {
    if (!patientId || !selected || !slot) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmAppointment({ patientId, date: parseLocalDate(selected), timeSlot: slot, notes });
      toast("Cita agendada");
      router.replace({ pathname: routes.specialistCalendar, params: { date: selected } });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setConfirming(false);
    }
  };

  const canConfirm = !!selected && !!slot && !confirming;

  return (
    <Screen>
      <Banner overline="Panel profesional" title="Agendar hora" showBack />
      {loading ? (
        <LoadingView />
      ) : loadError ? (
        <ErrorView message={loadError} />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Step n={1} title="Elige el día">
            <MonthCalendar year={year} month={month} selected={selected} onSelect={setSelected} onPrevMonth={prevMonth} onNextMonth={nextMonth} minDate={todayIso} todayIso={todayIso} />
          </Step>

          <Step n={2} title="Elige el horario">
            {slotsLoading ? (
              <LoadingView />
            ) : !selected ? (
              <Text style={styles.muted}>Selecciona un día para ver los horarios.</Text>
            ) : (
              <View style={styles.slots}>
                {slots.map((s) => {
                  const active = s.id === slot;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.slot, active && styles.slotActive, !s.available && styles.slotDisabled]}
                      onPress={() => s.available && setSlot(s.id)}
                      disabled={!s.available}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active, disabled: !s.available }}
                      accessibilityLabel={`${s.time}${s.available ? "" : ", ocupado"}`}
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive, !s.available && styles.slotTextDisabled]}>{s.time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Step>

          <Step n={3} title="Confirma">
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="account" size={22} color={Colors.btnTeal} />
              <Text style={styles.summaryText}>{patientName ?? "—"}</Text>
            </View>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="calendar-outline" size={22} color={Colors.btnTeal} />
              <Text style={styles.summaryText}>{selected ? formatLongDate(selected) : "—"}</Text>
            </View>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="clock-outline" size={22} color={Colors.btnTeal} />
              <Text style={styles.summaryText}>{slot ?? "—"}</Text>
            </View>
            <Field label="Notas (opcional)" value={notes} onChangeText={setNotes} placeholder="Ej: control de rodilla, traer exámenes" icon="note-text-outline" multiline />
            <InlineError message={error} />
            <Button title="Confirmar cita" icon="check" onPress={submit} disabled={!canConfirm} loading={confirming} testID="confirm-appointment" />
          </Step>
        </KeyboardAwareScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  stepHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  stepBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.btnTeal, alignItems: "center", justifyContent: "center" },
  stepBadgeText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textOnDark },
  stepTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary },
  muted: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: "center", paddingVertical: 12 },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slot: { width: "30%", flexGrow: 1, minHeight: 48, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardBgAlt },
  slotActive: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  slotDisabled: { backgroundColor: "rgba(39,105,90,0.06)", borderColor: "rgba(39,105,90,0.15)" },
  slotText: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  slotTextActive: { color: Colors.textOnDark },
  slotTextDisabled: { color: "rgba(39,105,90,0.35)", textDecorationLine: "line-through" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  summaryText: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textPrimary, flex: 1 },
});
