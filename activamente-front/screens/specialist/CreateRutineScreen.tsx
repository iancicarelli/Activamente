import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFonts } from "expo-font";
import { routes } from "../../router/routes";
import { BannerStyle, Colors, Fonts, GradientColors } from "../../constants/theme";
import { getExercises, Exercise } from "../../services/exerciseService";
import { createRoutine, RoutineCreate } from "../../services/routineService";

// ─── Types ────────────────────────────────────────────────────────────────────

// Ejercicio dentro de la rutina en construcción (editable por el especialista).
type BuilderItem = {
  exercise_id: string;
  name: string;
  level: number;
  total_series: number;
  total_reps: number;
  rest_time_seconds: number;
};

// day_of_week del backend: 1 → Lunes … 7 → Domingo.
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

const LEVELS = [1, 2, 3];

const pad2 = (n: number) => n.toString().padStart(2, "0");
// "HH:MM" para mostrar en pantalla.
const formatDisplayTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
// "HH:MM:00" para el campo TIME de PostgreSQL.
const formatBackendTime = (d: Date) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateRutineScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();

  // Biblioteca de ejercicios
  const [available, setAvailable] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [exercisesError, setExercisesError] = useState<string | null>(null);

  // Rutina en construcción
  const [selected, setSelected] = useState<BuilderItem[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Guardado
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  // ── Carga de la biblioteca al montar ──
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingExercises(true);
      setExercisesError(null);
      try {
        const data = await getExercises();
        if (active) setAvailable(data);
      } catch (e: any) {
        if (active)
          setExercisesError(e?.message ?? "No se pudieron cargar los ejercicios");
      } finally {
        if (active) setLoadingExercises(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // ── Builder helpers ──
  const isAdded = (id: string) => selected.some((s) => s.exercise_id === id);

  const handleAdd = (ex: Exercise) => {
    if (isAdded(ex.id)) return;
    setSelected((prev) => [
      ...prev,
      {
        exercise_id: ex.id,
        name: ex.name,
        level: 1,
        total_series: 3,
        total_reps: 10,
        rest_time_seconds: 30,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setSelected((prev) => prev.filter((s) => s.exercise_id !== id));
  };

  const updateItem = <K extends keyof BuilderItem>(
    id: string,
    field: K,
    value: BuilderItem[K]
  ) => {
    setSelected((prev) =>
      prev.map((s) => (s.exercise_id === id ? { ...s, [field]: value } : s))
    );
  };

  // ── Guardar ──
  const handleSave = async () => {
    setSaveError(null);

    if (!patientId) return setSaveError("No se recibió el paciente.");
    if (!name.trim()) return setSaveError("Ingresá un nombre para la rutina.");
    if (selected.length === 0)
      return setSaveError("Agregá al menos un ejercicio.");
    if (!startDate.trim() || !endDate.trim())
      return setSaveError("Completá las fechas (YYYY-MM-DD).");
    if (!scheduledTime)
      return setSaveError("Seleccioná la hora de la rutina.");

    const payload: RoutineCreate = {
      patient_id: patientId,
      name: name.trim(),
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      day_of_week: dayOfWeek,
      scheduled_time: formatBackendTime(scheduledTime),
      exercises: selected.map((s, index) => ({
        exercise_id: s.exercise_id,
        order_index: index,
        level: s.level,
        total_series: s.total_series,
        total_reps: s.total_reps,
        rest_time_seconds: s.rest_time_seconds,
      })),
    };

    setSaving(true);
    try {
      await createRoutine(payload);
      router.replace({
        pathname: routes.routineList as any,
        params: { patientId },
      });
    } catch (e: any) {
      setSaveError(e?.message ?? "No se pudo guardar la rutina");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => router.push(routes.patientList as any);

  if (!fontsLoaded) {
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
        <Text style={styles.bannerTitle}>Crear Rutina</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Datos de la rutina ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos de la rutina</Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Rehabilitación lumbar"
            placeholderTextColor="rgba(39,105,90,0.4)"
          />

          <View style={styles.rowBlock}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Inicio (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-06-13"
                placeholderTextColor="rgba(39,105,90,0.4)"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Fin (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-07-13"
                placeholderTextColor="rgba(39,105,90,0.4)"
                autoCapitalize="none"
              />
            </View>
          </View>

          <Text style={styles.label}>Hora</Text>
          <TouchableOpacity
            style={styles.timeInput}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.timeInputText,
                !scheduledTime && styles.timeInputPlaceholder,
              ]}
            >
              {scheduledTime ? formatDisplayTime(scheduledTime) : "Seleccionar hora"}
            </Text>
            <MaterialCommunityIcons
              name="clock-outline"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={scheduledTime ?? new Date()}
              mode="time"
              is24Hour
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                // En Android el picker se cierra solo tras la interacción.
                if (Platform.OS !== "ios") setShowTimePicker(false);
                if (event.type === "set" && date) setScheduledTime(date);
              }}
            />
          )}

          <Text style={styles.label}>Día de la semana</Text>
          <View style={styles.daysRow}>
            {DAYS.map((d) => {
              const active = dayOfWeek === d.value;
              return (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.dayBtn, active && styles.dayBtnActive]}
                  onPress={() => setDayOfWeek(d.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayText, active && styles.dayTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Ejercicios disponibles ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ejercicios disponibles</Text>

          {loadingExercises ? (
            <ActivityIndicator
              size="large"
              color={Colors.textPrimary}
              style={{ marginTop: 16 }}
            />
          ) : exercisesError ? (
            <Text style={styles.errorText}>{exercisesError}</Text>
          ) : available.length === 0 ? (
            <Text style={styles.mutedText}>No hay ejercicios en la biblioteca.</Text>
          ) : (
            available.map((ex) => {
              const added = isAdded(ex.id);
              return (
                <View key={ex.id} style={styles.libraryRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.libraryName}>{ex.name}</Text>
                    {ex.description ? (
                      <Text style={styles.libraryDesc}>{ex.description}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, added && styles.addBtnDisabled]}
                    onPress={() => handleAdd(ex)}
                    disabled={added}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name={added ? "check" : "plus"}
                      size={16}
                      color={Colors.textOnDark}
                    />
                    <Text style={styles.addText}>
                      {added ? "Agregado" : "Agregar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* ── Rutina en construcción ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Rutina en construcción ({selected.length})
          </Text>

          {selected.length === 0 ? (
            <Text style={styles.mutedText}>
              Agregá ejercicios desde la lista de arriba.
            </Text>
          ) : (
            selected.map((item) => (
              <View key={item.exercise_id} style={styles.builderCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleRemove(item.exercise_id)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={18}
                      color={Colors.textOnDark}
                    />
                  </TouchableOpacity>
                </View>

                {/* Nivel */}
                <Text style={styles.label}>Nivel</Text>
                <View style={styles.levelRow}>
                  {LEVELS.map((lvl) => {
                    const active = item.level === lvl;
                    return (
                      <TouchableOpacity
                        key={lvl}
                        style={[styles.levelBtn, active && styles.levelBtnActive]}
                        onPress={() => updateItem(item.exercise_id, "level", lvl)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.levelText,
                            active && styles.levelTextActive,
                          ]}
                        >
                          {lvl}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Series + Reps */}
                <View style={styles.rowBlock}>
                  <Counter
                    label="Series"
                    value={item.total_series}
                    onChange={(v) =>
                      updateItem(item.exercise_id, "total_series", v)
                    }
                  />
                  <Counter
                    label="Repeticiones"
                    value={item.total_reps}
                    onChange={(v) =>
                      updateItem(item.exercise_id, "total_reps", v)
                    }
                  />
                </View>

                {/* Descanso */}
                <Counter
                  label="Descanso (seg)"
                  value={item.rest_time_seconds}
                  step={5}
                  onChange={(v) =>
                    updateItem(item.exercise_id, "rest_time_seconds", v)
                  }
                />
              </View>
            ))
          )}
        </View>

        {/* ── Error de guardado ── */}
        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        {/* ── Acciones ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnDark} />
            ) : (
              <Text style={styles.saveText}>Guardar rutina</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Counter({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <View style={styles.fieldHalf}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.counterBox}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(0, value - step))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="minus" size={20} color={Colors.textOnDark} />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity
          onPress={() => onChange(value + step)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="plus" size={20} color={Colors.textOnDark} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, paddingBottom: 32 },

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

  // ── Section ──
  section: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.btnTeal,
    padding: 14,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },

  // ── Inputs ──
  label: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    marginBottom: 12,
  },

  // ── Time input ──
  timeInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  timeInputText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  timeInputPlaceholder: {
    color: "rgba(39,105,90,0.4)",
  },

  // ── Day selector ──
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.cardBgAlt,
    alignItems: "center",
  },
  dayBtnActive: { backgroundColor: Colors.btnPrimary },
  dayText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  dayTextActive: { fontFamily: Fonts.bold, color: Colors.textOnDark },

  // ── Library row ──
  libraryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBgAlt,
  },
  libraryName: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  libraryDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.btnTeal,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 10,
  },
  addBtnDisabled: { opacity: 0.5 },
  addText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },

  // ── Builder card ──
  builderCard: {
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  deleteBtn: {
    backgroundColor: Colors.btnDanger,
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Level ──
  levelRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  levelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.btnTeal,
  },
  levelBtnActive: { backgroundColor: Colors.btnPrimary, borderColor: Colors.btnPrimary },
  levelText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  levelTextActive: { color: Colors.textOnDark },

  // ── Counter ──
  rowBlock: { flexDirection: "row", gap: 12, marginBottom: 12 },
  fieldHalf: { flex: 1 },
  counterBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.btnTeal,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  counterValue: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
    minWidth: 24,
    textAlign: "center",
  },

  // ── Estados ──
  errorText: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.btnDanger,
  },
  mutedText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },

  // ── Actions ──
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.btnDanger,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.btnPrimary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },
});
