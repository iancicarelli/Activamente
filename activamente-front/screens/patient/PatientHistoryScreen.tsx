// screens/patient/PatientHistoryScreen.tsx — historial del paciente (UX-17):
// racha y sesiones de la semana arriba, sesiones agrupadas por semana con
// fechas en español, encuestas antes/después al expandir. Datos de /api/patients/me/sessions.
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen, Banner, Card, LoadingView, EmptyState, ErrorView, SectionTitle } from "../../components/ui";
import { SurveyComparison } from "../../components/SurveyComparison";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { getSession } from "../../services/authStore";
import { getMySessions, getPatientById, ComplianceMetrics, SessionItem } from "../../services/patientService";
import { formatDateTime, weekStart } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";

type Group = { title: string; items: SessionItem[] };

const groupByWeek = (items: SessionItem[]): Group[] => {
  const thisWeek = weekStart(new Date()).getTime();
  const lastWeek = thisWeek - 7 * 86_400_000;
  const groups: Record<string, SessionItem[]> = { "Esta semana": [], "Semana pasada": [], Anteriores: [] };
  for (const s of items) {
    const t = weekStart(new Date(s.date)).getTime();
    const key = t >= thisWeek ? "Esta semana" : t >= lastWeek ? "Semana pasada" : "Anteriores";
    groups[key].push(s);
  }
  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([title, items]) => ({ title, items }));
};

export default function PatientHistoryScreen() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = getSession()?.userId;
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [items, me] = await Promise.all([getMySessions({ limit: 50 }), getPatientById(userId)]);
      setSessions(items);
      setMetrics(me.metrics);
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

  return (
    <Screen>
      <Banner title="Mi historial" subtitle="Revisa tu progreso y celebra tus logros" big />
      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={error} onRetry={load} big />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {metrics && (
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <MaterialCommunityIcons name="fire" size={36} color="#E0A800" />
                <Text style={styles.statValue}>{metrics.currentStreakDays}</Text>
                <Text style={styles.statLabel}>{metrics.currentStreakDays === 1 ? "día seguido" : "días seguidos"}</Text>
              </Card>
              <Card style={styles.statCard}>
                <MaterialCommunityIcons name="calendar-check" size={36} color={Colors.btnTeal} />
                <Text style={styles.statValue}>{metrics.sessionsCompletedThisWeek}</Text>
                <Text style={styles.statLabel}>esta semana</Text>
              </Card>
              <Card style={styles.statCard}>
                <MaterialCommunityIcons name="check-all" size={36} color={Colors.btnPrimary} />
                <Text style={styles.statValue}>{metrics.sessionsCompleted}</Text>
                <Text style={styles.statLabel}>en total</Text>
              </Card>
            </View>
          )}

          {sessions.length === 0 ? (
            <EmptyState icon="run-fast" title="Aún no tienes sesiones" message="Cuando completes tu primer entrenamiento aparecerá aquí." big />
          ) : (
            groupByWeek(sessions).map((g) => (
              <View key={g.title}>
                <SectionTitle big>{g.title}</SectionTitle>
                {g.items.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function SessionCard({ session }: { session: SessionItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card padded={false}>
      <TouchableOpacity style={styles.cardHead} onPress={() => setExpanded((v) => !v)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={[styles.statusIcon, { backgroundColor: session.completed ? "rgba(123,184,153,0.35)" : Colors.dangerBg }]}>
          <MaterialCommunityIcons name={session.completed ? "check-circle" : "progress-clock"} size={40} color={session.completed ? Colors.success : Colors.btnDanger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{session.name}</Text>
          <Text style={styles.cardDate}>{formatDateTime(session.date)}</Text>
          <Text style={styles.cardMeta}>{session.completed ? "Completada" : "Incompleta"} · {session.exercisesDone} de {session.exercisesTotal} ejercicios</Text>
        </View>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={32} color={Colors.textPrimary} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.details}>
          <Detail icon="clock-outline" text={session.durationMinutes != null ? `Duración: ${session.durationMinutes} min` : "Duración no registrada"} />
          {(session.preSurvey || session.postSurvey) && (
            <>
              <Detail icon="emoticon-outline" text="Cómo te sentiste" />
              <SurveyComparison pre={session.preSurvey} post={session.postSurvey} big />
            </>
          )}
        </View>
      )}
    </Card>
  );
}

function Detail({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; text: string }) {
  return (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={26} color={Colors.btnTeal} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 6 },
  statValue: { fontSize: FontSize.hero, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: 4 },
  statLabel: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: "center" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  statusIcon: { width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: FontSize.patient.body, fontFamily: Fonts.bold, color: Colors.textPrimary },
  cardDate: { fontSize: FontSize.lg, fontFamily: Fonts.regular, color: Colors.textPrimary, marginTop: 2 },
  cardMeta: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  details: { borderTopWidth: 1, borderTopColor: Colors.divider, padding: 14, gap: 10 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailText: { flex: 1, fontSize: FontSize.lg, fontFamily: Fonts.regular, color: Colors.textPrimary },
});
