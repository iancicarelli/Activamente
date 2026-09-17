// components/ui/Button.tsx — botón con variantes y tamaño "patient" (≥ 56 dp).
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize, Radius, Touch } from "../../constants/theme";

type Variant = "primary" | "danger" | "outline" | "teal" | "dark" | "ghost";
type Size = "sm" | "md" | "patient";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  testID?: string;
};

const BG: Record<Variant, string> = {
  primary: Colors.btnPrimary,
  danger: Colors.btnDanger,
  outline: Colors.cardBgAlt,
  teal: Colors.btnTeal,
  dark: Colors.btnDark,
  ghost: "transparent",
};

const FG: Record<Variant, string> = {
  primary: Colors.textOnDark,
  danger: Colors.textOnDark,
  outline: Colors.textPrimary,
  teal: Colors.textOnDark,
  dark: Colors.textOnDark,
  ghost: Colors.textPrimary,
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: Props) {
  const isDisabled = disabled || loading;
  const height = size === "patient" ? 64 : size === "sm" ? 40 : Touch.staff;
  const fontSize = size === "patient" ? FontSize.patient.button : size === "sm" ? FontSize.sm : FontSize.md;
  const fg = FG[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled }}
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: BG[variant], minHeight: height },
        variant === "outline" && styles.outline,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={size === "patient" ? 28 : 20} color={fg} /> : null}
          <Text style={[styles.text, { color: fg, fontSize }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  outline: { borderWidth: 1.5, borderColor: Colors.border },
  disabled: { opacity: 0.55 },
  text: { fontFamily: Fonts.bold, textAlign: "center" },
});
