// components/SurveyComparison.tsx — encuestas de UNA sesión en dos columnas
// (Antes | Después) con semáforo por métrica y cómo cambió el dolor.
// `big` = escala de paciente.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize } from "../constants/theme";
import type { SurveySummary } from "../services/patientService";
import { METRIC_LABEL, MetricKey, MetricTone, metricTone, metricWord, painChange } from "../utils/wellbeing";

const TONE_BG: Record<MetricTone, string> = { good: Colors.metricGoodBg, warn: Colors.metricWarnBg, bad: Colors.metricBadBg };
const TONE_FG: Record<MetricTone, string> = { good: Colors.textPrimary, warn: Colors.warningText, bad: Colors.dangerText };

export function MetricChip({ metric, value, big }: { metric: MetricKey; value: number | null | undefined; big?: boolean }) {
  const tone = metricTone(metric, value);
  if (!tone) return <Text style={[styles.empty, big && styles.textBig]}>—</Text>;
  return (
    <View style={[styles.chip, { backgroundColor: TONE_BG[tone] }]} accessibilityLabel={`${METRIC_LABEL[metric]}: ${metricWord(metric, value)}`}>
      {tone === "bad" && <MaterialCommunityIcons name="alert" size={big ? 18 : 14} color={TONE_FG[tone]} />}
      <Text style={[styles.chipText, big && styles.textBig, { color: TONE_FG[tone] }]} numberOfLines={1}>
        {metricWord(metric, value)}
      </Text>
    </View>
  );
}

const CHANGE = {
  better: { icon: "arrow-down-bold", text: "El dolor bajó después de la sesión", color: Colors.success },
  same: { icon: "equal", text: "El dolor se mantuvo igual", color: Colors.textSecondary },
  worse: { icon: "arrow-up-bold", text: "El dolor subió después de la sesión", color: Colors.btnDanger },
} as const;

export function SurveyComparison({ pre, post, big }: { pre: SurveySummary | null; post: SurveySummary | null; big?: boolean }) {
  if (!pre && !post) {
    return <Text style={[styles.empty, big && styles.textBig]}>Sin encuestas en esta sesión.</Text>;
  }
  const rows: { metric: MetricKey; before?: number | null; after?: number | null }[] = [
    { metric: "pain", before: pre?.pain_level, after: post?.pain_level },
    { metric: "fatigue", before: pre?.fatigue_level },
    { metric: "stress", before: pre?.stress_level },
    { metric: "mood", after: post?.mood_level },
  ];
  const visible = rows.filter((r) => r.before != null || r.after != null);
  const change = painChange(pre, post);
  const comments = [pre?.comments, post?.comments].filter((c): c is string => !!c?.trim());

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.head, styles.labelCol, big && styles.textBig]} />
        <Text style={[styles.head, big && styles.textBig]}>Antes</Text>
        <Text style={[styles.head, big && styles.textBig]}>Después</Text>
      </View>
      {visible.map((r) => (
        <View key={r.metric} style={[styles.row, styles.bodyRow]}>
          <Text style={[styles.label, styles.labelCol, big && styles.textBig]}>{METRIC_LABEL[r.metric]}</Text>
          <View style={styles.cell}>{r.metric === "mood" ? <Text style={[styles.empty, big && styles.textBig]}>—</Text> : <MetricChip metric={r.metric} value={r.before} big={big} />}</View>
          <View style={styles.cell}>{r.metric === "fatigue" || r.metric === "stress" ? <Text style={[styles.empty, big && styles.textBig]}>—</Text> : <MetricChip metric={r.metric} value={r.after} big={big} />}</View>
        </View>
      ))}
      {change && (
        <View style={styles.change}>
          <MaterialCommunityIcons name={CHANGE[change].icon} size={big ? 22 : 16} color={CHANGE[change].color} />
          <Text style={[styles.changeText, big && styles.textBig, { color: CHANGE[change].color }]}>{CHANGE[change].text}</Text>
        </View>
      )}
      {comments.map((c, i) => (
        <Text key={i} style={[styles.comment, big && styles.textBig]}>
          “{c}”
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, backgroundColor: Colors.cardBgAlt, borderRadius: 12, padding: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  bodyRow: { paddingVertical: 5, borderTopWidth: 1, borderTopColor: Colors.divider },
  labelCol: { flex: 0.9 },
  head: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, paddingBottom: 4 },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textPrimary },
  cell: { flex: 1, alignItems: "flex-start" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, maxWidth: "100%" },
  chipText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  empty: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  change: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  changeText: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.bold },
  comment: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, fontStyle: "italic", marginTop: 6 },
  textBig: { fontSize: FontSize.lg },
});
