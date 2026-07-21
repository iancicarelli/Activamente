import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useLocalSearchParams, useRouter } from "expo-router";
import SpecialistNavbar from "../../components/SpecialistNavbar";
import { BannerStyle, Colors, Fonts, GradientColors } from "../../constants/theme";
import { routes } from "../../router/routes";
import {
  deleteRoutine,
  getRoutinesByPatient,
  RoutineWithExercises,
} from "../../services/routineService";

// ─── Helpers ───────────────────────────────────────────────────────────────────

// day_of_week del backend: 1 → Lunes … 7 → Domingo.
const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const dayName = (d: number): string => WEEKDAYS[d - 1] ?? "—";

// start_date / end_date llegan como "YYYY-MM-DD"; se formatea sin construir un
// Date para evitar corrimientos por zona horaria.
const formatDate = (iso: string): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoutineListScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();

  const [routines, setRoutines] = useState<RoutineWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  const loadRoutines = useCallback(async () => {
    if (!patientId) {
      setError("No se recibió el paciente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getRoutinesByPatient(patientId);
      setRoutines(data);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar las rutinas");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  if (!fontsLoaded) return null;

  const handleCreate = () => {
    router.push({ pathname: routes.createRutine as any, params: { patientId } });
  };

  const handleDelete = (routine: RoutineWithExercises) => {
    Alert.alert("¿Eliminar rutina?", `Se eliminará "${routine.name}".`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setDeletingId(routine.id);
          try {
            await deleteRoutine(routine.id);
            await loadRoutines();
          } catch (e: any) {
            Alert.alert(
              "Error",
              e?.message ?? "No se pudo eliminar la rutina."
            );
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={GradientColors as any} style={styles.container}>
      {/* ── Banner ── */}
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerSubtitle}>Panel Profesional</Text>
            <Text style={styles.bannerTitle}>Rutinas del Paciente</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator
            size="large"
            color={Colors.textPrimary}
            style={{ marginTop: 40 }}
          />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : routines.length === 0 ? (
          <Text style={styles.emptyText}>
            Este paciente aún no tiene rutinas asignadas.
          </Text>
        ) : (
          routines.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              deleting={deletingId === r.id}
              onDelete={() => handleDelete(r)}
            />
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.primaryCta}
        onPress={handleCreate}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name="plus-circle-outline"
          size={20}
          color={Colors.textOnDark}
        />
        <Text style={styles.primaryCtaText}>Crear rutina</Text>
      </TouchableOpacity>

      <SpecialistNavbar active="patients" />
    </LinearGradient>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoutineCard({
  routine,
  deleting,
  onDelete,
}: {
  routine: RoutineWithExercises;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardIconWrap}>
          <MaterialCommunityIcons
            name="clipboard-list-outline"
            size={22}
            color={Colors.btnTeal}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{routine.name}</Text>
          <Text style={styles.cardMeta}>
            {routine.exercises.length} ejercicios
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          disabled={deleting}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={Colors.textOnDark} />
          ) : (
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color={Colors.textOnDark}
            />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.cardInfoRow}>
        <View style={styles.infoChip}>
          <MaterialCommunityIcons
            name="calendar-week-outline"
            size={14}
            color={Colors.btnTeal}
          />
          <Text style={styles.infoChipText}>{dayName(routine.day_of_week)}</Text>
        </View>
        <View style={styles.infoChip}>
          <MaterialCommunityIcons
            name="calendar-range"
            size={14}
            color={Colors.btnTeal}
          />
          <Text style={styles.infoChipText}>
            {formatDate(routine.start_date)} – {formatDate(routine.end_date)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  // ── Banner ──
  banner: { ...BannerStyle },
  bannerRow: { flexDirection: "row", alignItems: "center" },
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

  // ── Card ──
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.btnTeal,
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.cardBgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  deleteBtn: {
    backgroundColor: Colors.btnDanger,
    borderRadius: 8,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  infoChipText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },

  // ── Estados ──
  errorText: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.btnDanger,
  },
  emptyText: {
    marginTop: 40,
    textAlign: "center",
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },

  // ── Primary CTA ──
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.btnPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  primaryCtaText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },
});
