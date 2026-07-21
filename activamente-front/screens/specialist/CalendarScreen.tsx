import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { useLocalSearchParams } from "expo-router";
import { getAppointmentsByDate, Appointment } from "../../services/calendarService";
import SpecialistNavbar from "../../components/SpecialistNavbar";

// ─── Helpers del Calendario ───────────────────────────────────────────────────

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

  for (let i = firstDow - 1; i >= 0; i--) {
    flat.push({ day: daysInPrev - i, inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    flat.push({ day: d, inMonth: true });
  }

  let next = 1;
  while (flat.length % 7 !== 0) {
    flat.push({ day: next++, inMonth: false });
  }

  const weeks: CalDay[][] = [];
  for (let i = 0; i < flat.length; i += 7) {
    weeks.push(flat.slice(i, i + 7));
  }

  return weeks;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function CalendarScreen() {
  // Fecha opcional recibida al venir desde "Agendar Hora" (YYYY-MM-DD).
  const { date } = useLocalSearchParams<{ date?: string }>();

  // Obtenemos la fecha de hoy a las 00:00:00 para comparar correctamente
  const todayDateObj = new Date();
  todayDateObj.setHours(0, 0, 0, 0);

  // Si llegamos desde una cita recién agendada, arrancamos en ese día;
  // si no, en el día de hoy.
  const initialDate = date ? new Date(`${date}T00:00:00`) : todayDateObj;

  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDate.getDate());
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  // Efecto para buscar citas cada vez que se selecciona un día
  useEffect(() => {
    if (!selectedDay) return;

    const fetchAppointments = async () => {
      setIsLoading(true);
      try {
        // Formateamos la fecha a YYYY-MM-DD para consultar GET /api/appointments
        const formattedMonth = String(month + 1).padStart(2, "0");
        const formattedDay = String(selectedDay).padStart(2, "0");
        const dateString = `${year}-${formattedMonth}-${formattedDay}`;

        const data = await getAppointmentsByDate(dateString);
        setAppointments(data);
      } catch (error) {
        console.error("Error fetching appointments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointments();
  }, [selectedDay, month, year]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  if (!fontsLoaded) return null;

  const weeks = buildCalendar(year, month);

  return (
    <LinearGradient colors={['#DEEDE6','#90C0C1']} style={styles.safeArea}>
      <View style={styles.container}>

        {/* ── Banner ── */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Calendario</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Calendario Custom ── */}
          <View style={styles.calendarCard}>
            
            {/* Controles de Mes */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#0D472A" />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {MONTHS_ES[month]} {year}
              </Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#0D472A" />
              </TouchableOpacity>
            </View>

            {/* Cabecera de Días */}
            <View style={styles.calRow}>
              {DAYS_ES.map((d) => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Cuadrícula de Días */}
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.calRow}>
                {week.map((cell, di) => {
                  // Validación para saber si es un día pasado
                  const cellDate = new Date(year, month, cell.day);
                  const isPast = cellDate < todayDateObj;
                  
                  const isSelected = cell.inMonth && cell.day === selectedDay;
                  // Deshabilitamos si no es del mes actual o si es un día en el pasado
                  const isDisabled = !cell.inMonth || isPast;

                  return (
                    <TouchableOpacity
                      key={di}
                      style={[styles.calCell, isSelected && styles.calCellSelected]}
                      onPress={() => {
                        if (!isDisabled) setSelectedDay(cell.day);
                      }}
                      activeOpacity={isDisabled ? 1 : 0.7}
                      disabled={isDisabled}
                    >
                      <Text
                        style={[
                          styles.calCellText,
                          isDisabled && styles.calCellGray,
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

          {/* ── Lista de Citas ── */}
          <Text style={styles.sectionTitle}>
            Citas {selectedDay ? `el ${selectedDay} de ${MONTHS_ES[month]}` : "Programadas"}
          </Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#49A2A5" style={{ marginTop: 40 }} />
          ) : !selectedDay ? (
            <Text style={styles.emptyText}>Selecciona un día para ver las citas.</Text>
          ) : appointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="calendar-check" size={40} color="#D8ECEA" />
              <Text style={styles.emptyText}>No hay citas para esta fecha.</Text>
            </View>
          ) : (
            appointments.map((appointment) => (
              <View key={appointment.id} style={styles.appointmentCard}>
                
                <View style={styles.appointmentHeader}>
                  <Text style={styles.appointmentPatient}>{appointment.patientName}</Text>
                  <View style={[
                    styles.statusBadge
                  ]}>
                    <Text style={[
                      styles.statusBadgeText
                    ]}>
                    </Text>
                  </View>
                </View>

                <View style={styles.appointmentDetails}>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="calendar-blank-outline" size={18} color="#49A2A5" />
                    <Text style={styles.detailText}>{appointment.displayFullDate}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color="#49A2A5" />
                    <Text style={styles.detailText}>{appointment.time}</Text>
                  </View>
                </View>

              </View>
            ))
          )}

        </ScrollView>

        <SpecialistNavbar active="calendar" />
      </View>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  banner: {
    width: '100%',
    backgroundColor: '#49A2A5',
    paddingTop: 54,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: 'PromptBold',
    color: '#DEEDE6',
  },

  // ── Calendar Card ──
  calendarCard: {
    backgroundColor: "rgba(222,237,230,0.85)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  monthLabel: {
    fontSize: 18,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  calRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "rgba(39, 105, 90,0.5)",
    paddingBottom: 6,
  },
  calCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 20,
  },
  calCellSelected: {
    backgroundColor: "#27695A",
    borderRadius: 20,
  },
  calCellText: {
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
  // Estilo para días pasados o fuera del mes
  calCellGray: {
    color: "rgba(39, 105, 90,0.25)",
  },
  calCellTextSelected: {
    color: "#DEEDE6",
    fontFamily: "PromptBold",
  },

  // ── Sección de Citas ──
  sectionTitle: {
    fontSize: 18,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 16,
    marginLeft: 4,
  },
  emptyCard: {
    backgroundColor: "rgba(222,237,230,0.85)",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90,0.6)",
    textAlign: "center",
    marginTop: 10,
  },

  // ── Tarjeta de Cita ──
  appointmentCard: {
    backgroundColor: "rgba(222,237,230,0.85)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#49A2A5",
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  appointmentPatient: {
    fontSize: 16,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: "PromptBold",
    letterSpacing: 0.5,
  },
  appointmentDetails: {
    flexDirection: "row",
    gap: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
});