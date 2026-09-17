// screens/patient/PatientHomeScreen.tsx — inicio del paciente (UX-11):
// saludo con nombre, qué toca hoy (rutina, ejercicios, duración estimada), un
// botón grande "Comenzar", próxima cita siempre visible (BT-14) y, si no toca
// hoy, cuándo es la próxima (EP-05) + repasar ejercicios.
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, LoadingView, ErrorView } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { getSession } from "../../services/authStore";
import { getMe } from "../../services/meService";
import { getNextAppointment, Appointment } from "../../services/appointmentService";
import { getNextRoutine, NextRoutine } from "../../services/routineService";
import { formatLongDate, relativeDayLabel } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";
import { firstName } from "../../utils/text";

// Estimación gruesa: ~4 s por repetición + descansos + 20 s de preparación por ejercicio.
const estimateMinutes = (r: NonNullable<NextRoutine["routine"]>): number => {
  const seconds = r.exercises.reduce((sum, e) => {
    const reps = e.total_series * e.total_reps * 4;
    const rest = Math.max(0, e.total_series - 1) * (e.rest_time_seconds ?? 0);
    return sum + reps + rest + 20;
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
};

export default function PatientHomeScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [next, setNext] = useState<NextRoutine | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = getSession()?.userId;
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [me, routine, appt] = await Promise.all([
        getMe(),
        getNextRoutine(userId),
        getNextAppointment().catch(() => null),
      ]);
      setName(firstName(me.full_name));
      setNext(routine);
      setAppointment(appt);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const routine = next?.routine ?? null;
  const isToday = !!next?.is_today && !!routine;

  const start = () => {
    if (!routine) return;
    router.push({ pathname: routes.surveyPre, params: { routineId: routine.id } });
  };

  const review = () => {
    if (!routine) return;
    router.push({ pathname: routes.instruction, params: { routineId: routine.id, index: "0", preview: "1" } });
  };

  const showAppointment = () => {
    if (!appointment) return;
    Alert.alert(
      "Tu próxima cita",
      `${formatLongDate(appointment.date)} a las ${appointment.time}\nCon ${appointment.specialistName}${appointment.notes ? `\n\n${appointment.notes}` : ""}`
    );
  };

  return (
    <Screen>
      <Banner title={name ? `Hola, ${name}` : "Hola"} subtitle="Bienvenido a tu entrenamiento" big />
      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={error} onRetry={load} big />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {appointment && (
            <Card style={styles.appointment} alt>
              <MaterialCommunityIcons name="calendar-clock" size={44} color={Colors.textPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.appointmentTitle}>Próxima cita</Text>
                <Text style={styles.appointmentBody}>
                  {formatLongDate(appointment.date)}, {appointment.time}
                </Text>
              </View>
              <Button title="Ver" variant="teal" size="sm" onPress={showAppointment} />
            </Card>
          )}

          {isToday && routine ? (
            <Card style={styles.todayCard}>
              <Text style={styles.todayLabel}>Hoy te toca</Text>
              <Text style={styles.routineName}>{routine.name}</Text>
              <View style={styles.metaRow}>
                <Meta icon="dumbbell" text={`${routine.exercises.length} ${routine.exercises.length === 1 ? "ejercicio" : "ejercicios"}`} />
                <Meta icon="clock-outline" text={`${estimateMinutes(routine)} min aprox.`} />
              </View>
              <Button title="Comenzar entrenamiento" size="patient" icon="play" onPress={start} style={{ marginTop: 18 }} testID="start-training" />
              <Button title="Repasar los ejercicios" size="patient" variant="outline" icon="book-open-page-variant-outline" onPress={review} style={{ marginTop: 12 }} />
            </Card>
          ) : routine && next?.next_date ? (
            <Card style={styles.todayCard}>
              <MaterialCommunityIcons name="calendar-heart" size={56} color={Colors.btnTeal} style={{ alignSelf: "center" }} />
              <Text style={styles.restTitle}>Hoy no tienes entrenamiento</Text>
              <Text style={styles.restBody}>
                Tu próximo entrenamiento es {relativeDayLabel(next.next_date, next.days_until ?? 0)}: {routine.name}.
              </Text>
              <Button title="Repasar mis ejercicios" size="patient" variant="outline" icon="book-open-page-variant-outline" onPress={review} style={{ marginTop: 18 }} />
            </Card>
          ) : (
            <Card style={styles.todayCard}>
              <MaterialCommunityIcons name="clipboard-text-clock-outline" size={56} color={Colors.btnTeal} style={{ alignSelf: "center" }} />
              <Text style={styles.restTitle}>Aún no tienes una rutina</Text>
              <Text style={styles.restBody}>Tu especialista te asignará una pronto. Si crees que es un error, comunícate con él.</Text>
            </Card>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; text: string }) {
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={icon} size={24} color={Colors.btnTeal} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  appointment: { flexDirection: "row", alignItems: "center", gap: 12 },
  appointmentTitle: { fontSize: FontSize.patient.label, fontFamily: Fonts.bold, color: Colors.textPrimary },
  appointmentBody: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary, marginTop: 2 },
  todayCard: { paddingVertical: 24 },
  todayLabel: { fontSize: FontSize.patient.label, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: "center" },
  routineName: { fontSize: FontSize.hero, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: "center", marginTop: 6, lineHeight: 42 },
  metaRow: { flexDirection: "row", justifyContent: "center", gap: 22, marginTop: 14, flexWrap: "wrap" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary },
  restTitle: { fontSize: FontSize.patient.title, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: "center", marginTop: 12 },
  restBody: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary, textAlign: "center", marginTop: 10, lineHeight: 30 },
});
