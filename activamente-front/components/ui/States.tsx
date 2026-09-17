// components/ui/States.tsx — Loading / Empty / Error reutilizables.
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { Button } from "./Button";

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={Colors.btnTeal} />
      {label ? <Text style={styles.text}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = "inbox-outline", title, message, big }: { icon?: Icon; title: string; message?: string; big?: boolean }) {
  return (
    <View style={styles.center}>
      <MaterialCommunityIcons name={icon} size={big ? 64 : 44} color={Colors.textSecondary} />
      <Text style={[styles.title, big && { fontSize: FontSize.patient.title }]}>{title}</Text>
      {message ? <Text style={[styles.text, big && { fontSize: FontSize.patient.body }]}>{message}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry, big }: { message: string; onRetry?: () => void; big?: boolean }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <MaterialCommunityIcons name="alert-circle-outline" size={big ? 64 : 44} color={Colors.btnDanger} />
      <Text style={[styles.text, big && { fontSize: FontSize.patient.body }]}>{message}</Text>
      {onRetry ? <Button title="Reintentar" onPress={onRetry} variant="teal" size={big ? "patient" : "md"} style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.inline} accessibilityLiveRegion="polite">
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color={Colors.btnDanger} />
      <Text style={styles.inlineText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 10 },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: "center" },
  text: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: "center", lineHeight: 24 },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.dangerBg,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: Colors.btnDanger,
  },
  inlineText: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textPrimary },
});
