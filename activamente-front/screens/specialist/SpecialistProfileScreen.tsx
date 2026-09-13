import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import SpecialistNavbar from "../../components/SpecialistNavbar";
import { BannerStyle, Colors, Fonts, GradientColors } from "../../constants/theme";
import { clearAuth } from "../../services/authStore";
import { getSpecialistProfile, SpecialistProfile } from "../../services/profileService";

// ─── Screen ───────────────────────────────────────────────────────────────────

const PLACEHOLDER = "No establecido";

export default function SpecialistProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<SpecialistProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  useEffect(() => {
    let mounted = true;
    getSpecialistProfile()
      .then((p) => mounted && setProfile(p))
      .catch(() => mounted && setProfile(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (!fontsLoaded) return null;

  const handleLogout = () => {
    clearAuth();
    router.replace("/" as any);
  };

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || PLACEHOLDER;

  return (
    <LinearGradient colors={GradientColors as any} style={styles.container}>
      {/* ── Banner ── */}
      <View style={styles.banner}>
        <Text style={styles.bannerSubtitle}>Panel Profesional</Text>
        <Text style={styles.bannerTitle}>Mi Perfil</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.btnTeal} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── Profile card ── */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <MaterialCommunityIcons name="account-circle-outline" size={72} color={Colors.textPrimary} />
            </View>
            <Text style={styles.profileName}>{fullName}</Text>
            <View style={styles.specialtyPill}>
              <MaterialCommunityIcons name="stethoscope" size={14} color={Colors.textOnDark} />
              <Text style={styles.specialtyText}>{profile?.specialty || "Especialista"}</Text>
            </View>
          </View>

          {/* ── Contact info ── */}
          <Text style={styles.sectionTitle}>Información personal</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="email-outline" label="Correo electrónico" value={profile?.email || PLACEHOLDER} />
            <View style={styles.divider} />
            <InfoRow icon="phone-outline" label="Teléfono" value={profile?.phone || PLACEHOLDER} />
            <View style={styles.divider} />
            <InfoRow icon="card-account-details-outline" label="RUT" value={profile?.rut || PLACEHOLDER} />
          </View>

          {/* ── Logout ── */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <MaterialCommunityIcons name="logout" size={20} color={Colors.textOnDark} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <SpecialistNavbar active="profile" />
    </LinearGradient>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBg}>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.btnTeal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  // ── Banner ──
  banner: { ...BannerStyle },
  bannerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.bannerSubtitle,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.bannerTitle,
  },

  // ── Profile card ──
  profileCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.btnTeal,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.cardBgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  profileName: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  specialtyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.btnTeal,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
  },
  specialtyText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },

  // ── Info ──
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 10,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.cardBgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(39, 105, 90, 0.1)",
    marginVertical: 4,
  },

  // ── Logout ──
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.btnDanger,
    borderRadius: 12,
    paddingVertical: 14,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textOnDark,
  },
});
