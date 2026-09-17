// components/WellbeingTrend.tsx — "Cómo se ha sentido": últimas sesiones con
// encuesta (más antigua → más reciente) y un punto con semáforo por métrica,
// para ver de un vistazo si el dolor o el ánimo van mejorando.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Fonts, FontSize } from "../constants/theme";
import type { SessionItem } from "../services/patientService";
import { hasSurvey, MetricKey, MetricTone, metricTone } from "../utils/wellbeing";

const MAX_SESSIONS = 7;

const TONE_BG: Record<MetricTone, string> = { good: Colors.metricGoodBg, warn: Colors.metricWarnBg, bad: Colors.metricBadBg };
const TONE_FG: Record<MetricTone, string> = { good: Colors.textPrimary, warn: Colors.warningText, bad: Colors.dangerText };

type Row = { label: string; metric: MetricKey; pick: (s: SessionItem) => number | null | undefined };

const ROWS: Row[] = [
  { label: "Dolor antes", metric: "pain", pick: (s) => s.preSurvey?.pain_level },
  { label: "Dolor después", metric: "pain", pick: (s) => s.postSurvey?.pain_level },
  { label: "Cansancio", metric: "fatigue", pick: (s) => s.preSurvey?.fatigue_level },
  { label: "Estrés", metric: "stress", pick: (s) => s.preSurvey?.stress_level },
  { label: "Ánimo", metric: "mood", pick: (s) => s.postSurvey?.mood_level },
];

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

// `sessions` llega del backend de la más reciente a la más antigua.
export const trendSessions = (sessions: SessionItem[]): SessionItem[] => sessions.filter(hasSurvey).slice(0, MAX_SESSIONS).reverse();

export function WellbeingTrend({ sessions }: { sessions: SessionItem[] }) {
  const items = trendSessions(sessions);
  if (items.length < 2) return null;
  const rows = ROWS.filter((r) => items.some((s) => r.pick(s) != null));

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.labelCol} />
        {items.map((s) => (
          <Text key={s.id} style={styles.date}>
            {shortDate(s.date)}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.label} style={[styles.row, styles.bodyRow]}>
          <Text style={[styles.label, styles.labelCol]} numberOfLines={1}>
            {r.label}
          </Text>
          {items.map((s) => {
            const value = r.pick(s);
            const tone = metricTone(r.metric, value);
            return (
              <View key={s.id} style={styles.cell}>
                {tone ? (
                  <View style={[styles.dot, { backgroundColor: TONE_BG[tone] }]} accessibilityLabel={`${r.label} ${shortDate(s.date)}: ${value} de 5`}>
                    <Text style={[styles.dotText, { color: TONE_FG[tone] }]}>{value}</Text>
                  </View>
                ) : (
                  <Text style={styles.none}>·</Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.legend}>Escala 1 a 5. Dolor, cansancio y estrés: más alto es peor. Ánimo: más alto es mejor.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  bodyRow: { paddingVertical: 4, borderTopWidth: 1, borderTopColor: Colors.divider },
  labelCol: { width: 92 },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.bold, color: Colors.textPrimary },
  date: { flex: 1, textAlign: "center", fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary, paddingBottom: 4 },
  cell: { flex: 1, alignItems: "center" },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  dotText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  none: { fontSize: FontSize.md, color: Colors.textMuted },
  legend: { marginTop: 8, fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
