import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getAvailableSlots,
  getPatientForAppointment,
  confirmAppointment,
  TimeSlot,
  AppointmentPatient,
} from "../../services/appointmentService";
import SpecialistNavbar from "../../components/SpecialistNavbar";
import { routes } from "../../router/routes";
import { BannerStyle, Colors, Fonts, GradientColors } from "../../constants/theme";

// ─── Calendar helpers ─────────────────────────────────────────────────────────

const DAYS_ES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type CalDay = { day: number; inMonth: boolean };

function buildCalendar(year: number, month: number): CalDay[][] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const flat: CalDay[] = [];
  for (let i = firstDow - 1; i >= 0; i--) flat.push({ day: daysInPrev - i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) flat.push({ day: d, inMonth: true });
  let next = 1;
  while (flat.length % 7 !== 0) flat.push({ day: next++, inMonth: false });

  const weeks: CalDay[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBadge({ step }: { step: number }) {
  return (
    <View style={styles.stepBadge}>
      <Text style={styles.stepBadgeText}>{step}</Text>
    </View>
  );
}

function SectionCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <StepBadge step={step} />
        <Text style={styles.sectionCardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScheduleAppointmentScreen() {
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [patient, setPatient] = useState<AppointmentPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  // Ficha del paciente recibido por navegación (para el resumen).
  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    getPatientForAppointment(patientId)
      .then(setPatient)
      .catch((err) => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  // Cupos disponibles para el día seleccionado (se recargan al cambiar de día).
  useEffect(() => {
    if (!selectedDay) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSelectedSlot(null);
    getAvailableSlots(new Date(year, month, selectedDay))
      .then(setSlots)
      .catch((err) => Alert.alert("Error", err.message))
      .finally(() => setSlotsLoading(false));
  }, [year, month, selectedDay]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const handleConfirm = async () => {
    if (!patientId) {
      Alert.alert("Atención", "No se ha seleccionado un paciente.");
      return;
    }
    if (!selectedDay || !selectedSlot) {
      Alert.alert("Atención", "Seleccione una fecha y horario.");
      return;
    }
    setConfirming(true);
    try {
      await confirmAppointment({
        patientId,
        date: new Date(year, month, selectedDay),
        timeSlot: selectedSlot,
      });
      // Fecha agendada en formato YYYY-MM-DD para preseleccionarla en el calendario.
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        selectedDay
      ).padStart(2, "0")}`;
      Alert.alert(
        "Confirmado",
        "La cita ha sido agendada correctamente.",
        [
          {
            text: "Ver en calendario",
            onPress: () =>
              router.push({
                pathname: routes.specialistCalendar as any,
                params: { date: dateStr },
              }),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setConfirming(false);
    }
  };

  const weeks = buildCalendar(year, month);
  const selectedSlotObj = slots.find((s) => s.id === selectedSlot);

  const formatSelectedDate = () => {
    if (!selectedDay) return "—";
    const d = new Date(year, month, selectedDay);
    const day = d.getDate();
    const mon = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()];
    return `${day} ${mon}, ${d.getFullYear()}`;
  };

  if (!fontsLoaded || loading) {
    return (
      <LinearGradient colors={GradientColors as any} style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.btnTeal} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GradientColors as any} style={styles.container}>
      {/* ── Banner ── */}
      <View style={styles.banner}>
        <Text style={styles.bannerSubtitle}>Panel Profesional</Text>
        <Text style={styles.bannerTitle}>Agendar Hora</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Calendar card ── */}
        <View style={styles.calendarCard}>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS_ES[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.calRow}>
            {DAYS_ES.map((d) => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.calRow}>
              {week.map((cell, di) => {
                const isSelected = cell.inMonth && cell.day === selectedDay;
                return (
                  <TouchableOpacity
                    key={di}
                    style={[styles.calCell, isSelected && styles.calCellSelected]}
                    onPress={() => cell.inMonth && setSelectedDay(cell.day)}
                    activeOpacity={cell.inMonth ? 0.7 : 1}
                  >
                    <Text
                      style={[
                        styles.calCellText,
                        !cell.inMonth && styles.calCellGray,
                        isSelected && styles.calCellTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Available slots ── */}
        <SectionCard step={2} title={"Horarios Disponibles"}>
          {slotsLoading ? (
            <ActivityIndicator color={Colors.btnTeal} style={{ marginVertical: 12 }} />
          ) : !selectedDay ? (
            <Text style={styles.slotsEmpty}>Seleccione un día para ver los horarios.</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {slots.map((slot) => {
                const active = slot.id === selectedSlot;
                const disabled = !slot.available;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.slotBtn,
                      active && styles.slotBtnActive,
                      disabled && styles.slotBtnDisabled,
                    ]}
                    onPress={() => !disabled && setSelectedSlot(slot.id)}
                    activeOpacity={disabled ? 1 : 0.85}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        active && styles.slotTextActive,
                        disabled && styles.slotTextDisabled,
                      ]}
                    >
                      {slot.time}
                    </Text>
                    {slot.note && !active && !disabled && (
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={14}
                        color={Colors.btnTeal}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </SectionCard>

        {/* ── Summary ── */}
        <SectionCard step={3} title="Resumen">
          <Text style={styles.summaryLabel}>PACIENTE</Text>
          <View style={styles.summaryPatientRow}>
            <View style={styles.summaryAvatar}>
              <MaterialCommunityIcons name="account" size={20} color={Colors.btnTeal} />
            </View>
            <Text style={styles.summaryPatientName}>{patient?.fullName ?? "—"}</Text>
          </View>

          <View style={styles.summaryDateTimeRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>FECHA</Text>
              <View style={styles.summaryIconRow}>
                <MaterialCommunityIcons name="calendar-outline" size={15} color={Colors.btnTeal} />
                <Text style={styles.summaryDateText}>{formatSelectedDate()}</Text>
              </View>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>HORA</Text>
              <View style={styles.summaryIconRow}>
                <MaterialCommunityIcons name="clock-outline" size={15} color={Colors.btnTeal} />
                <Text style={styles.summaryDateText}>
                  {selectedSlotObj ? selectedSlotObj.time : "—"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <MaterialCommunityIcons
              name="information-outline"
              size={16}
              color={Colors.btnDanger}
              style={{ marginRight: 8, marginTop: 1 }}
            />
            <Text style={styles.infoText}>
              Cita de seguimiento presencial en el consultorio principal.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirm}
            disabled={confirming}
            activeOpacity={0.85}
          >
            {confirming ? (
              <ActivityIndicator color={Colors.textOnDark} size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirmar cita  →</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.confirmNote}>
            Al confirmar, se enviará una notificación al paciente.
          </Text>
        </SectionCard>
      </ScrollView>

      <SpecialistNavbar active="calendar" />
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  // ── Banner ──
  banner: { ...BannerStyle },
  bannerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.bannerSubtitle,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.bannerTitle,
  },

  // ── Calendar ──
  calendarCard: {
    backgroundColor: "rgba(222,237,230,0.85)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  monthLabel: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  calRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: "rgba(39, 105, 90,0.5)",
    paddingBottom: 6,
  },
  calCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 20,
  },
  calCellSelected: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 20,
  },
  calCellText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  calCellGray: {
    color: "rgba(39, 105, 90,0.25)",
  },
  calCellTextSelected: {
    color: Colors.textOnDark,
    fontFamily: Fonts.bold,
  },

  // ── Section card ──
  sectionCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  stepBadge: {
    backgroundColor: Colors.btnTeal,
    borderRadius: 8,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },
  sectionCardTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    flex: 1,
  },

  // ── Slots ──
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  slotBtn: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.btnTeal,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: Colors.cardBgAlt,
  },
  slotBtnActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  slotBtnDisabled: {
    backgroundColor: "rgba(39, 105, 90,0.06)",
    borderColor: "rgba(39, 105, 90,0.15)",
  },
  slotText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  slotTextActive: {
    color: Colors.textOnDark,
  },
  slotTextDisabled: {
    color: "rgba(39, 105, 90,0.3)",
    textDecorationLine: "line-through",
  },
  slotsEmpty: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: "rgba(39, 105, 90,0.6)",
    textAlign: "center",
    paddingVertical: 12,
  },

  // ── Summary ──
  summaryLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: "rgba(39, 105, 90,0.45)",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 4,
  },
  summaryPatientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  summaryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  summaryPatientName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  summaryDateTimeRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 14,
  },
  summaryCol: { flex: 1 },
  summaryIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  summaryDateText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(231,87,86,0.12)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 17,
  },
  confirmBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  confirmBtnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },
  confirmNote: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: "rgba(39, 105, 90,0.5)",
    textAlign: "center",
    lineHeight: 16,
  },
});
