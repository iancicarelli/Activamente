// components/ScaleOptions.tsx — 5 opciones grandes con cara + texto para las
// encuestas del paciente (UX-13). Escala 1-5 directa al backend (R-02).
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize } from "../constants/theme";

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export type ScaleOption = { value: number; label: string; icon: Icon; color: string };

// Escalas donde 1 = "nada/bien" y 5 = "mucho/mal" (dolor, cansancio, estrés).
export const NEGATIVE_SCALE = (thing: string): ScaleOption[] => [
  { value: 1, label: `Nada de ${thing}`, icon: "emoticon-happy-outline", color: "#BFE3CE" },
  { value: 2, label: `Poco ${thing}`, icon: "emoticon-outline", color: "#D6EBD9" },
  { value: 3, label: `Algo de ${thing}`, icon: "emoticon-neutral-outline", color: "#EDE9C8" },
  { value: 4, label: `Bastante ${thing}`, icon: "emoticon-sad-outline", color: "#F4D3B3" },
  { value: 5, label: `Mucho ${thing}`, icon: "emoticon-cry-outline", color: "#F1BDB9" },
];

// Ánimo: 1 = muy mal … 5 = muy bien.
export const MOOD_SCALE: ScaleOption[] = [
  { value: 1, label: "Muy mal", icon: "emoticon-cry-outline", color: "#F1BDB9" },
  { value: 2, label: "Mal", icon: "emoticon-sad-outline", color: "#F4D3B3" },
  { value: 3, label: "Regular", icon: "emoticon-neutral-outline", color: "#EDE9C8" },
  { value: 4, label: "Bien", icon: "emoticon-happy-outline", color: "#D6EBD9" },
  { value: 5, label: "Muy bien", icon: "emoticon-excited-outline", color: "#BFE3CE" },
];

export function ScaleOptions({ options, value, onChange }: { options: ScaleOption[]; value: number | null; onChange: (v: number) => void }) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, { backgroundColor: opt.color }, selected && styles.selected]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            testID={`scale-option-${opt.value}`}
          >
            <MaterialCommunityIcons name={opt.icon} size={44} color={Colors.textPrimary} />
            <Text style={styles.label}>{opt.label}</Text>
            {selected ? <MaterialCommunityIcons name="check-circle" size={30} color={Colors.textPrimary} /> : <View style={{ width: 30 }} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 72,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: "transparent",
  },
  selected: { borderColor: Colors.textPrimary },
  label: { flex: 1, fontSize: FontSize.patient.body, fontFamily: Fonts.bold, color: Colors.textPrimary },
});
