import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize } from "../../constants/theme";

export function InfoRow({
  icon,
  label,
  value,
  big,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconBg, big && { width: 48, height: 48 }]}>
        <MaterialCommunityIcons name={icon} size={big ? 26 : 20} color={Colors.btnTeal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, big && { fontSize: FontSize.patient.label }]}>{label}</Text>
        <Text style={[styles.value, big && { fontSize: FontSize.patient.body }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  iconBg: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center" },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary },
  value: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: 2 },
});
