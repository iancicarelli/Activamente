// components/ui/Screen.tsx — fondo con gradiente + safe area (UX-02).
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GradientColors } from "../../constants/theme";

type Props = {
  children: React.ReactNode;
  // Sin padding superior cuando la pantalla arranca con un Banner (él lo aplica).
  withTopInset?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, withTopInset = false, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={GradientColors as unknown as [string, string]} style={styles.container}>
      <View style={[styles.container, withTopInset && { paddingTop: insets.top }, style]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
