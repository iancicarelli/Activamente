// components/ui/Field.tsx — label + input + error inline (UX-05).
import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize, Radius, Touch } from "../../constants/theme";

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  right?: React.ReactNode;
  big?: boolean; // escala paciente
  hint?: string;
};

export function Field({ label, error, icon, right, big, hint, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, big && styles.labelBig]}>{label}</Text>
      <View style={[styles.row, big && styles.rowBig, !!error && styles.rowError]}>
        {icon ? <MaterialCommunityIcons name={icon} size={big ? 24 : 20} color={Colors.btnTeal} style={{ marginRight: 8 }} /> : null}
        <TextInput
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel={label}
          style={[styles.input, big && styles.inputBig, style]}
          {...input}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6, letterSpacing: 0.3 },
  labelBig: { fontSize: FontSize.patient.label },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardBgAlt,
    paddingHorizontal: 12,
    minHeight: Touch.staff,
  },
  rowBig: { minHeight: Touch.patient, borderRadius: Radius.lg },
  rowError: { borderColor: Colors.btnDanger },
  input: { flex: 1, paddingVertical: 10, fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textPrimary },
  inputBig: { fontSize: FontSize.patient.body },
  error: { marginTop: 6, fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.btnDanger },
  hint: { marginTop: 6, fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
