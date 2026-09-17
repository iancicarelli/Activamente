// screens/specialist/RoutineListScreen.tsx — rutinas de un paciente: días, vigencia,
// ejercicios y acciones Editar / Eliminar.
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Badge, LoadingView, EmptyState, ErrorView, confirm, useToast } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { deleteRoutine, getRoutinesByPatient, RoutineWithExercises } from "../../services/routineService";
import { formatNumericDate, formatTime24, formatWeekdays, toDateString } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";
import { isBetaExercise } from "../../validation/validators/exerciseRegistry";

const isCurrent = (r: RoutineWithExercises) => {
  const today = toDateString(new Date());
  return r.start_date <= today && r.end_date >= today;
};

function RoutineCard({ routine, deleting, onEdit, onDelete }: { routine: RoutineWithExercises; deleting: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="clipboard-list-outline" size={24} color={Colors.btnTeal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{routine.name}</Text>
          <Text style={styles.meta}>
            {routine.exercises.length} {routine.exercises.length === 1 ? "ejercicio" : "ejercicios"} · {formatWeekdays(routine.days_of_week)}
            {routine.scheduled_time ? ` ${formatTime24(routine.scheduled_time)}` : ""}
          </Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={onEdit} disabled={deleting} accessibilityRole="button" accessibilityLabel="Editar rutina">
          <MaterialCommunityIcons name="pencil-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} disabled={deleting} accessibilityRole="button" accessibilityLabel="Eliminar rutina">
          <MaterialCommunityIcons name={deleting ? "progress-clock" : "trash-can-outline"} size={20} color={Colors.textOnDark} />
        </TouchableOpacity>
      </View>
      <View style={styles.chips}>
        <Badge label={`${formatNumericDate(routine.start_date)} – ${formatNumericDate(routine.end_date)}`} icon="calendar-range" tone="neutral" />
        {isCurrent(routine) ? <Badge label="Vigente" tone="success" icon="check" /> : <Badge label="Fuera de fecha" tone="neutral" />}
      </View>
      <View style={styles.exercises}>
        {routine.exercises.map((e) => (
          <Text key={e.id} style={styles.exercise}>
            • {e.exercise_id.replace(/_/g, " ")}{isBetaExercise(e.exercise_id) ? " (beta)" : ""} · nivel {e.level} · {e.total_series}×{e.total_reps}
            {e.rest_time_seconds ? ` · descanso ${e.rest_time_seconds} s` : ""}
          </Text>
        ))}
      </View>
    </Card>
  );
}

export default function RoutineListScreen() {
  const router = useRouter();
  const toast = useToast();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) {
      setError("No se indicó el paciente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRoutines(await getRoutinesByPatient(patientId));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const remove = async (r: RoutineWithExercises) => {
    const ok = await confirm("¿Eliminar rutina?", `Se eliminará "${r.name}". Las sesiones ya realizadas se conservan.`, { confirmText: "Eliminar", destructive: true });
    if (!ok) return;
    setDeletingId(r.id);
    try {
      await deleteRoutine(r.id);
      setRoutines((prev) => prev.filter((x) => x.id !== r.id));
      toast("Rutina eliminada");
    } catch (e) {
      toast(getErrorMessage(e), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Screen>
      <Banner overline="Panel profesional" title="Rutinas del paciente" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingView />
        ) : error ? (
          <ErrorView message={error} onRetry={load} />
        ) : routines.length === 0 ? (
          <EmptyState icon="clipboard-plus-outline" title="Sin rutinas" message="Crea la primera rutina para este paciente." />
        ) : (
          routines.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              deleting={deletingId === r.id}
              onEdit={() => router.push({ pathname: routes.createRoutine, params: { patientId: r.patient_id, routineId: r.id } })}
              onDelete={() => remove(r)}
            />
          ))
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Crear rutina" icon="plus-circle-outline" onPress={() => router.push({ pathname: routes.createRoutine, params: { patientId: patientId ?? "" } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 24 },
  footer: { padding: 16, paddingTop: 0 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center" },
  title: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  editBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.cardBgAlt, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.btnDanger, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  exercises: { marginTop: 10, gap: 2 },
  exercise: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textPrimary, textTransform: "capitalize" },
});
