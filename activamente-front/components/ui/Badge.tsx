import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize } from "../../constants/theme";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: "rgba(123, 184, 153, 0.35)", fg: Colors.textPrimary },
  warning: { bg: Colors.warningBg, fg: Colors.warningText },
  danger: { bg: Colors.dangerBg, fg: Colors.dangerText },
  neutral: { bg: "rgba(39, 105, 90, 0.12)", fg: Colors.textSecondary },
  info: { bg: Colors.infoBg, fg: Colors.textPrimary },
};

export function Badge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={14} color={t.fg} /> : null}
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  text: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
