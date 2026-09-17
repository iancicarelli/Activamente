// screens/specialist/CreateRoutineScreen.tsx — crear o editar (`routineId`)
// una rutina: DateTimePicker para fechas y hora (HC-11 / UX-05), varios días de
// la semana, niveles limitados a los que existen por ejercicio (max_level,
// EX-32), validación inline, botón deshabilitado hasta que el formulario sea
// válido y Cancelar = volver (BT-11).
import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Field, InlineError, KeyboardAwareScrollView, LoadingView, ErrorView, SectionTitle, useToast } from "../../components/ui";
import { Colors, Fonts, FontSize, Radius } from "../../constants/theme";
import { getExercises, Exercise } from "../../services/exerciseService";
import { createRoutine, getRoutineById, updateRoutine, RoutineCreate, RoutineWithExercises } from "../../services/routineService";
import { formatNumericDate, formatWeekdays, parseLocalDate, toDateString } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";

type BuilderItem = { exercise_id: string; name: string; maxLevel: number; level: number; total_series: number; total_reps: number; rest_time_seconds: number };

const DAYS = [
  { value: 1, label: "Lun" }, { value: 2, label: "Mar" }, { value: 3, label: "Mié" }, { value: 4, label: "Jue" },
  { value: 5, label: "Vie" }, { value: 6, label: "Sáb" }, { value: 7, label: "Dom" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");
const timeLabel = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const timeBackend = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;

type PickerTarget = "start" | "end" | "time" | null;

const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

// "HH:MM:SS" del backend → Date de hoy a esa hora (solo se usan horas y minutos).
const parseTime = (value: string | null): Date | null => {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

const toBuilderItems = (routine: RoutineWithExercises, catalog: Exercise[]): BuilderItem[] =>
  routine.exercises.map((e) => {
    const ex = catalog.find((c) => c.id === e.exercise_id);
    return {
      exercise_id: e.exercise_id,
      name: ex?.name ?? e.exercise_id.replace(/_/g, " "),
      maxLevel: ex?.max_level ?? Math.max(1, e.level),
      level: e.level,
      total_series: e.total_series,
      total_reps: e.total_reps,
      rest_time_seconds: e.rest_time_seconds ?? 0,
    };
  });

export function buildRoutinePayload(input: {
  patientId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  daysOfWeek: number[];
  time: Date | null;
  items: BuilderItem[];
}): RoutineCreate {
  return {
    patient_id: input.patientId,
    name: input.name.trim(),
    start_date: toDateString(input.startDate),
    end_date: toDateString(input.endDate),
    days_of_week: [...new Set(input.daysOfWeek)].sort((a, b) => a - b),
    scheduled_time: input.time ? timeBackend(input.time) : null,
    exercises: input.items.map((s, index) => ({
      exercise_id: s.exercise_id,
      order_index: index,
      level: s.level,
      total_series: s.total_series,
      total_reps: s.total_reps,
      rest_time_seconds: s.rest_time_seconds,
    })),
  };
}

export default function CreateRoutineScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ patientId?: string; routineId?: string }>();
  const routineId = params.routineId || undefined;
  const editing = !!routineId;
  const [patientId, setPatientId] = useState<string | undefined>(params.patientId || undefined);

  const [available, setAvailable] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [exercisesError, setExercisesError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(new Date(today.getTime() + 30 * 86_400_000));
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([isoWeekday(today)]);
  // Al editar, una rutina que ya empezó puede conservar su fecha de inicio pasada.
  const [minStart, setMinStart] = useState<Date>(today);
  const [time, setTime] = useState<Date | null>(null);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [touched, setTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadExercises = async () => {
    setLoadingExercises(true);
    setExercisesError(null);
    try {
      const [catalog, routine] = await Promise.all([getExercises(), routineId ? getRoutineById(routineId) : Promise.resolve(null)]);
      setAvailable(catalog);
      if (routine) {
        const start = parseLocalDate(routine.start_date);
        setPatientId(routine.patient_id);
        setName(routine.name);
        setStartDate(start);
        setEndDate(parseLocalDate(routine.end_date));
        setMinStart(start < today ? start : today);
        setDaysOfWeek(routine.days_of_week);
        setTime(parseTime(routine.scheduled_time));
        setItems(toBuilderItems(routine, catalog));
      }
    } catch (e) {
      setExercisesError(getErrorMessage(e));
    } finally {
      setLoadingExercises(false);
    }
  };
  useEffect(() => {
    void loadExercises();
  }, []);

  const errors = {
    name: !name.trim() ? "Escribe un nombre para la rutina." : null,
    dates: endDate < startDate ? "La fecha de fin no puede ser anterior a la de inicio." : null,
    days: daysOfWeek.length === 0 ? "Elige al menos un día." : null,
    items: items.length === 0 ? "Agrega al menos un ejercicio." : null,
  };
  const valid = !errors.name && !errors.dates && !errors.days && !errors.items && !!patientId;

  const toggleDay = (day: number) =>
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));

  const add = (ex: Exercise) => {
    if (items.some((i) => i.exercise_id === ex.id)) return;
    setItems((prev) => [...prev, { exercise_id: ex.id, name: ex.name, maxLevel: ex.max_level ?? 1, level: 1, total_series: 3, total_reps: 10, rest_time_seconds: 30 }]);
  };
  const update = <K extends keyof BuilderItem>(id: string, field: K, value: BuilderItem[K]) =>
    setItems((prev) => prev.map((s) => (s.exercise_id === id ? { ...s, [field]: value } : s)));
  const move = (index: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const onPick = (event: DateTimePickerEvent, date?: Date) => {
    const target = picker;
    if (Platform.OS !== "ios") setPicker(null);
    if (event.type !== "set" || !date || !target) return;
    if (target === "start") {
      setStartDate(date);
      if (endDate < date) setEndDate(date);
    } else if (target === "end") setEndDate(date);
    else setTime(date);
  };

  const save = async () => {
    setTouched(true);
    if (!valid || !patientId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildRoutinePayload({ patientId, name, startDate, endDate, daysOfWeek, time, items });
      if (routineId) {
        const { patient_id: _ignored, ...update } = payload;
        await updateRoutine(routineId, update);
        toast("Rutina actualizada");
      } else {
        await createRoutine(payload);
        toast("Rutina creada");
      }
      router.back();
    } catch (e) {
      setSaveError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Banner overline="Panel profesional" title={editing ? "Editar rutina" : "Crear rutina"} showBack />
      {editing && loadingExercises ? (
        <LoadingView />
      ) : editing && exercisesError ? (
        <ErrorView message={exercisesError} onRetry={loadExercises} />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card>
            <SectionTitle>Datos de la rutina</SectionTitle>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Rehabilitación lumbar" error={touched ? errors.name : null} icon="clipboard-text-outline" />

            <View style={styles.row}>
              <DateButton label="Inicio" value={formatNumericDate(toDateString(startDate))} onPress={() => setPicker("start")} />
              <DateButton label="Fin" value={formatNumericDate(toDateString(endDate))} onPress={() => setPicker("end")} />
            </View>
            {errors.dates ? <Text style={styles.error}>{errors.dates}</Text> : null}
            <DateButton label="Hora (opcional)" value={time ? timeLabel(time) : "Sin hora"} onPress={() => setPicker("time")} icon="clock-outline" />

            {picker && (
              <DateTimePicker
                value={picker === "start" ? startDate : picker === "end" ? endDate : (time ?? new Date())}
                mode={picker === "time" ? "time" : "date"}
                is24Hour
                minimumDate={picker === "end" ? startDate : picker === "start" ? minStart : undefined}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onPick}
              />
            )}

            <Text style={styles.label}>Días de la semana</Text>
            <View style={styles.days}>
              {DAYS.map((d) => {
                const active = daysOfWeek.includes(d.value);
                return (
                  <TouchableOpacity key={d.value} testID={`day-${d.value}`} style={[styles.day, active && styles.dayActive]} onPress={() => toggleDay(d.value)} accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={d.label}>
                    <Text style={[styles.dayText, active && styles.dayTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.dayShortcuts}>
              <Button title="Lun a Vie" size="sm" variant="outline" onPress={() => setDaysOfWeek([1, 2, 3, 4, 5])} />
              <Button title="Todos" size="sm" variant="outline" onPress={() => setDaysOfWeek([1, 2, 3, 4, 5, 6, 7])} />
            </View>
            <Text style={errors.days ? styles.error : styles.muted}>{errors.days ?? formatWeekdays(daysOfWeek)}</Text>
          </Card>

          <Card>
            <SectionTitle>Ejercicios disponibles</SectionTitle>
            {loadingExercises ? (
              <LoadingView />
            ) : exercisesError ? (
              <ErrorView message={exercisesError} onRetry={loadExercises} />
            ) : (
              available.map((ex) => {
                const added = items.some((i) => i.exercise_id === ex.id);
                return (
                  <View key={ex.id} style={styles.libraryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.libraryName}>{ex.name}</Text>
                      {ex.description ? <Text style={styles.libraryDesc}>{ex.description}</Text> : null}
                    </View>
                    <Button title={added ? "Agregado" : "Agregar"} icon={added ? "check" : "plus"} size="sm" variant="teal" onPress={() => add(ex)} disabled={added} />
                  </View>
                );
              })
            )}
          </Card>

          <Card>
            <SectionTitle>{`Rutina en construcción (${items.length})`}</SectionTitle>
            {items.length === 0 ? (
              <Text style={styles.muted}>Agrega ejercicios desde la lista de arriba.</Text>
            ) : (
              items.map((item, index) => (
                <View key={item.exercise_id} style={styles.builder}>
                  <View style={styles.builderHead}>
                    <Text style={styles.builderTitle}>{index + 1}. {item.name}</Text>
                    <View style={styles.builderActions}>
                      <IconBtn icon="arrow-up" onPress={() => move(index, -1)} disabled={index === 0} label="Subir" />
                      <IconBtn icon="arrow-down" onPress={() => move(index, 1)} disabled={index === items.length - 1} label="Bajar" />
                      <IconBtn icon="trash-can-outline" danger onPress={() => setItems((p) => p.filter((s) => s.exercise_id !== item.exercise_id))} label="Quitar" />
                    </View>
                  </View>

                  <Text style={styles.label}>Nivel</Text>
                  <View style={styles.levels}>
                    {Array.from({ length: item.maxLevel }, (_, i) => i + 1).map((lvl) => {
                      const active = item.level === lvl;
                      return (
                        <TouchableOpacity key={lvl} testID={`level-${lvl}`} style={[styles.level, active && styles.levelActive]} onPress={() => update(item.exercise_id, "level", lvl)} accessibilityRole="radio" accessibilityState={{ selected: active }}>
                          <Text style={[styles.levelText, active && styles.levelTextActive]}>{lvl}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.row}>
                    <Counter label="Series" value={item.total_series} min={1} max={10} onChange={(v) => update(item.exercise_id, "total_series", v)} />
                    <Counter label="Repeticiones" value={item.total_reps} min={1} max={50} onChange={(v) => update(item.exercise_id, "total_reps", v)} />
                  </View>
                  <Counter label="Descanso (segundos)" value={item.rest_time_seconds} min={0} max={300} step={5} onChange={(v) => update(item.exercise_id, "rest_time_seconds", v)} />
                </View>
              ))
            )}
            {touched && errors.items ? <Text style={styles.error}>{errors.items}</Text> : null}
          </Card>

          <InlineError message={saveError} />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="outline" onPress={() => router.back()} style={{ flex: 1 }} disabled={saving} />
            <Button title={editing ? "Guardar cambios" : "Guardar rutina"} onPress={save} style={{ flex: 1 }} loading={saving} disabled={!valid} testID="save-routine" />
          </View>
        </KeyboardAwareScrollView>
      )}
    </Screen>
  );
}

function DateButton({ label, value, onPress, icon = "calendar-outline" }: { label: string; value: string; onPress: () => void; icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"] }) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateBtn} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
        <Text style={styles.dateText}>{value}</Text>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

function IconBtn({ icon, onPress, disabled, danger, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; onPress: () => void; disabled?: boolean; danger?: boolean; label: string }) {
  return (
    <TouchableOpacity style={[styles.iconBtn, danger && { backgroundColor: Colors.btnDanger }, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon} size={18} color={danger ? Colors.textOnDark : Colors.textPrimary} />
    </TouchableOpacity>
  );
}

function Counter({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.counter}>
        <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={styles.counterBtn} accessibilityRole="button" accessibilityLabel={`Menos ${label}`}>
          <MaterialCommunityIcons name="minus" size={22} color={Colors.textOnDark} />
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={styles.counterBtn} accessibilityRole="button" accessibilityLabel={`Más ${label}`}>
          <MaterialCommunityIcons name="plus" size={22} color={Colors.textOnDark} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: "row", gap: 12 },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6, letterSpacing: 0.3 },
  error: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.btnDanger, marginBottom: 10 },
  muted: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  dateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.cardBgAlt, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, minHeight: 48 },
  dateText: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textPrimary },
  days: { flexDirection: "row", gap: 6 },
  dayShortcuts: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 8 },
  day: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center" },
  dayActive: { backgroundColor: Colors.btnPrimary },
  dayText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textPrimary },
  dayTextActive: { fontFamily: Fonts.bold, color: Colors.textOnDark },
  libraryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  libraryName: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  libraryDesc: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  builder: { backgroundColor: Colors.cardBgAlt, borderRadius: 12, padding: 12, marginBottom: 12 },
  builderHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 },
  builderTitle: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  builderActions: { flexDirection: "row", gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.cardBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  levels: { flexDirection: "row", gap: 8, marginBottom: 12 },
  level: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: Colors.cardBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border },
  levelActive: { backgroundColor: Colors.btnPrimary, borderColor: Colors.btnPrimary },
  levelText: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  levelTextActive: { color: Colors.textOnDark },
  counter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.btnTeal, borderRadius: 10, paddingHorizontal: 6, minHeight: 48 },
  counterBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  counterValue: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textOnDark, minWidth: 32, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
});
