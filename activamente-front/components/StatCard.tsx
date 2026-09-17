import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize } from "../constants/theme";

export function StatCard({
  icon,
  iconColor = Colors.btnTeal,
  value,
  label,
  alert,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconColor?: string;
  value: string;
  label: string;
  alert?: boolean;
}) {
  return (
    <View style={styles.card} accessibilityLabel={`${label}: ${value}`}>
      {alert && <View style={styles.alertDot} />}
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "47%", backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  iconWrap: { backgroundColor: Colors.cardBgAlt, padding: 8, borderRadius: 10, alignSelf: "flex-start" },
  alertDot: { position: "absolute", top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.btnDanger },
  value: { fontSize: 32, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: 10 },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textPrimary },
});
