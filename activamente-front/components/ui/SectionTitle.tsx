import React from "react";
import { StyleSheet, Text } from "react-native";
import { Colors, Fonts, FontSize } from "../../constants/theme";

export function SectionTitle({ children, big }: { children: string; big?: boolean }) {
  return (
    <Text style={[styles.title, big && { fontSize: FontSize.patient.title }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 10, marginLeft: 4, marginTop: 4 },
});
