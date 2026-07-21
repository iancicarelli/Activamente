import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import PatientNavbar from "../../components/PatientNavbar";
import { BannerStyle, Colors, Fonts, GradientColors } from "../../constants/theme";
import { getPatientById, Session } from "../../services/patientService";
import { getSession } from "../../services/authStore";

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PatientHistoryScreen() {
  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userSession = getSession();
    const patientId = userSession?.patient?.id;

    if (patientId) {
      getPatientById(patientId)
        .then((data) => {
          setSessions(data.sessions || []);
        })
        .catch((error) => {
          console.error("Error fetching history:", error);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (!fontsLoaded) return null;

  return (
    <LinearGradient colors={GradientColors as any} style={styles.container}>
      {/* ── Banner ── */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Historial de sesiones</Text>
        <Text style={styles.bannerSubtitle}>
          Revisa tu progreso y celebra tus logros diarios.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Tus sesiones recientes</Text>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.btnTeal} style={{ marginTop: 40 }} />
        ) : sessions.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 40, fontFamily: Fonts.regular, color: Colors.textSecondary }}>
            Aún no tienes sesiones registradas.
          </Text>
        ) : (
          sessions.map((s) => <SessionCard key={s.id} session={s} />)
        )}
      </ScrollView>

      <PatientNavbar active="history" />
    </LinearGradient>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionCard({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded((v) => !v)}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="run-fast" size={38} color={Colors.btnTeal} />
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {session.name}
          </Text>
        </View>

        {session.completed && (
          <View style={styles.checkWrap}>
            <MaterialCommunityIcons name="check-circle" size={34} color={Colors.btnPrimary} />
          </View>
        )}

        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={28}
          color={Colors.textPrimary}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="calendar" size={24} color={Colors.btnTeal} />
            <Text style={styles.detailText}>{session.date}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={Colors.btnTeal} />
            <Text style={styles.detailText}>Duración: {session.duration}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },

  // ── Banner ──
  banner: { ...BannerStyle },
  bannerTitle: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.bannerTitle,
  },
  bannerSubtitle: {
    fontSize: 18,
    fontFamily: Fonts.regular,
    color: Colors.bannerSubtitle,
    marginTop: 6,
  },

  // ── Section ──
  sectionTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
    marginLeft: 4,
  },

  // ── Card ──
  cardWrapper: {
    marginBottom: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.btnTeal,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.cardBgAlt,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardContent: { flex: 1, paddingRight: 8 },
  cardTitle: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  checkWrap: {
    marginRight: 6,
  },
  chevron: {
    marginLeft: 2,
  },

  // ── Expanded details ──
  details: {
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 16,
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.btnTeal,
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailText: {
    fontSize: 20,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
});
