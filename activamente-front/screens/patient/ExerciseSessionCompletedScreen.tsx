import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter, useLocalSearchParams } from "expo-router";
import { BannerStyle, Colors, Fonts, GradientColors } from "../../constants/theme";
import { routes } from "../../router/routes";
import { completeSession, getSessionById } from "../../services/sessionService";

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ExerciseSessionCompletedScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Resumen real de la sesión. La sesión ya viene completada desde
  // PostExerciseSurveyScreen, así que GET /api/sessions/{id} ya trae
  // duration_minutes y los session_exercises con series_completed.
  const [loadingStats, setLoadingStats] = useState(true);
  const [exercisesCount, setExercisesCount] = useState<number | null>(null);
  const [seriesCount, setSeriesCount] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  useEffect(() => {
    if (!sessionId) {
      setLoadingStats(false);
      return;
    }
    getSessionById(sessionId)
      .then((s) => {
        setExercisesCount(s.session_exercises.length);
        setSeriesCount(
          s.session_exercises.reduce((sum, se) => sum + (se.series_completed ?? 0), 0)
        );
        setDurationMin(s.duration_minutes);
      })
      .catch((e) => console.error("Error cargando resumen de sesión:", e))
      .finally(() => setLoadingStats(false));
  }, [sessionId]);

  if (!fontsLoaded) return null;

  // "—" cuando no hay dato real (sin sessionId o fallo de carga).
  const fmt = (n: number | null) => (n != null ? `${n}` : "—");

  const handleComplete = async () => {
    setCompleteError(null);

    // Sin session_id no hay nada que completar en el backend: solo navegamos.
    if (!sessionId) {
      router.replace(routes.patientHistory as any);
      return;
    }

    setCompleting(true);
    try {
      await completeSession(sessionId);
      router.replace(routes.patientHistory as any);
    } catch (e: any) {
      setCompleteError(e?.message ?? "No se pudo completar la sesión");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <LinearGradient colors={GradientColors as any} style={styles.container}>
      {/* ── Banner ── */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Sesión completada</Text>
        <Text style={styles.bannerSubtitle}>Tu esfuerzo de hoy quedó registrado</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="trophy-outline" size={72} color={Colors.btnTeal} />
          </View>
          <Text style={styles.heroTitle}>¡Excelente trabajo!</Text>
          <Text style={styles.heroSubtitle}>
            Terminaste tu sesión de ejercicios y eso ya es un gran logro.
          </Text>
        </View>

        {/* ── Stats ── */}
        <Text style={styles.sectionTitle}>Resumen de la sesión</Text>
        <View style={styles.statsCard}>
          {loadingStats ? (
            <ActivityIndicator color={Colors.btnTeal} style={{ paddingVertical: 24 }} />
          ) : (
            <>
              <StatRow
                icon="dumbbell"
                label="Ejercicios completados"
                value={fmt(exercisesCount)}
              />
              <View style={styles.divider} />
              <StatRow
                icon="repeat-variant"
                label="Series realizadas"
                value={fmt(seriesCount)}
              />
              <View style={styles.divider} />
              <StatRow
                icon="clock-outline"
                label="Duración total"
                value={durationMin != null ? `${durationMin} min` : "—"}
              />
              <View style={styles.divider} />
              <StatRow
                icon="check-circle-outline"
                label="Estado"
                value="Completada"
                highlight
              />
            </>
          )}
        </View>

        {/* ── Motivational ── */}
        <View style={styles.quoteCard}>
          <MaterialCommunityIcons name="heart-pulse" size={28} color={Colors.btnTeal} />
          <Text style={styles.quoteText}>
            Cada sesión te acerca un paso más a tu objetivo. ¡Sigue así!
          </Text>
        </View>

        {/* ── Error de completado ── */}
        {completeError && (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={26} color="#E75756" />
            <Text style={styles.errorText}>{completeError}</Text>
          </View>
        )}

        {/* ── CTA ── */}
        <TouchableOpacity
          style={[styles.cta, completing && styles.ctaDisabled]}
          onPress={handleComplete}
          disabled={completing}
          activeOpacity={0.85}
        >
          {completing ? (
            <ActivityIndicator color={Colors.textOnDark} />
          ) : (
            <Text style={styles.ctaText}>{completeError ? "Reintentar  →" : "Completar  →"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statIconBg}>
        <MaterialCommunityIcons name={icon} size={28} color={Colors.btnTeal} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  // ── Banner ──
  banner: { ...BannerStyle },
  bannerTitle: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.bannerTitle,
  },
  bannerSubtitle: {
    fontSize: 18,
    fontFamily: Fonts.regular,
    color: Colors.bannerSubtitle,
    marginTop: 6,
  },

  // ── Hero ──
  heroCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 22,
    borderWidth: 1,
    borderColor: Colors.btnTeal,
  },
  heroIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.cardBgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 30,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 20,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 28,
  },

  // ── Stats ──
  sectionTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 14,
    marginLeft: 4,
  },
  statsCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: Colors.btnTeal,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  statIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.cardBgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  statLabel: {
    flex: 1,
    fontSize: 20,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  statValue: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  statValueHighlight: {
    color: Colors.btnPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(39, 105, 90, 0.15)",
  },

  // ── Quote ──
  quoteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.btnTeal,
  },
  quoteText: {
    flex: 1,
    fontSize: 20,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    lineHeight: 28,
  },

  // ── CTA ──
  cta: {
    backgroundColor: Colors.btnPrimary,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },
  ctaDisabled: {
    opacity: 0.6,
  },

  // ── Error ──
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E75756",
  },
  errorText: {
    flex: 1,
    fontSize: 18,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
});
