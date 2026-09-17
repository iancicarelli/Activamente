// components/ui/Banner.tsx — cabecera teal con safe area, título, subtítulo,
// botón atrás opcional y acción a la derecha.
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BannerStyle, Colors, Fonts, FontSize, Touch } from "../../constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  overline?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  big?: boolean; // escala paciente
};

export function Banner({ title, subtitle, overline, showBack, onBack, right, big }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={big ? 34 : 28} color={Colors.bannerTitle} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          {overline ? <Text style={styles.overline}>{overline}</Text> : null}
          <Text style={[styles.title, big && styles.titleBig]} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={[styles.subtitle, big && styles.subtitleBig]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { ...BannerStyle },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: Touch.staff,
    height: Touch.staff,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  overline: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.bannerSubtitle, marginBottom: 2 },
  title: { fontSize: FontSize.xxl, fontFamily: Fonts.bold, color: Colors.bannerTitle },
  titleBig: { fontSize: FontSize.title },
  subtitle: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.bannerSubtitle, marginTop: 4 },
  subtitleBig: { fontSize: FontSize.lg },
});
