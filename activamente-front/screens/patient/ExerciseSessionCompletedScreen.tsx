// screens/patient/ExerciseSessionCompletedScreen.tsx — resumen final (UX-16):
// celebración, "Hiciste 3 de 4 ejercicios", series, duración y un solo botón.
// Ya NO llama a /complete (lo hace la encuesta final una sola vez).
import React, { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Screen, Banner, Card, Button, LoadingView } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { getSessionById, SessionResponse } from "../../services/sessionService";

export default function ExerciseSessionCompletedScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [scale]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    getSessionById(sessionId)
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const total = session?.session_exercises.length ?? 0;
  const done = session?.session_exercises.filter((se) => se.reps_completed > 0).length ?? 0;
  const series = session?.session_exercises.reduce((s, se) => s + (se.series_completed ?? 0), 0) ?? 0;
  const reps = session?.session_exercises.reduce((s, se) => s + (se.reps_completed ?? 0), 0) ?? 0;

  return (
    <Screen>
      <Banner title="Sesión completada" subtitle="Tu esfuerzo de hoy quedó registrado" big />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <Animated.View style={[styles.trophy, { transform: [{ scale }] }]}>
            <MaterialCommunityIcons name="trophy" size={84} color="#E0A800" />
          </Animated.View>
          <Text style={styles.heroTitle}>¡Excelente trabajo!</Text>
          {loading ? (
            <LoadingView />
          ) : session ? (
            <Text style={styles.heroBody}>
              Hiciste {done} de {total} {total === 1 ? "ejercicio" : "ejercicios"}.
            </Text>
          ) : (
            <Text style={styles.heroBody}>Terminaste tu sesión de hoy.</Text>
          )}
        </Card>

        {session && (
          <Card>
            <Stat icon="repeat-variant" label="Series realizadas" value={String(series)} />
            <View style={styles.divider} />
            <Stat icon="counter" label="Repeticiones" value={String(reps)} />
            <View style={styles.divider} />
            <Stat icon="clock-outline" label="Duración" value={session.duration_minutes != null ? `${session.duration_minutes} min` : "—"} />
          </Card>
        )}

        <Card alt style={styles.quote}>
          <MaterialCommunityIcons name="heart-pulse" size={32} color={Colors.btnTeal} />
          <Text style={styles.quoteText}>Cada sesión te acerca un paso más a tu objetivo. ¡Sigue así!</Text>
        </Card>

        <Button title="Listo" size="patient" icon="check" onPress={() => router.replace(routes.patientHistory)} testID="completed-done" />
      </ScrollView>
    </Screen>
  );
}

function Stat({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={30} color={Colors.btnTeal} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  hero: { alignItems: "center", paddingVertical: 28 },
  trophy: { width: 130, height: 130, borderRadius: 65, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  heroTitle: { fontSize: FontSize.hero, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: "center" },
  heroBody: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary, textAlign: "center", marginTop: 8, lineHeight: 30 },
  stat: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  statLabel: { flex: 1, fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary },
  statValue: { fontSize: FontSize.xxl, fontFamily: Fonts.bold, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.divider },
  quote: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  quoteText: { flex: 1, fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary, lineHeight: 28 },
});
