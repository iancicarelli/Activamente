import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import SpecialistNavbar from "../../components/SpecialistNavbar";
import { getDashboard, DashboardResponse } from "../../services/specialistService";

type StatCardProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconColor: string;
  value: string;
  label: string;
  alert?: boolean;
};

function StatCard({ icon, iconColor, value, label, alert }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      {alert && <View style={styles.alertDot} />}
      <View style={styles.statIconWrap}>
        <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type MetricRowProps = {
  label: string;
  value: string;
  progress: number;
  topMargin?: number;
};

function MetricRow({ label, value, progress, topMargin }: MetricRowProps) {
  return (
    <View style={{ marginTop: topMargin ?? 0 }}>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

// "—" cuando no hay dato real (cargando o error de red).
const fmt = (n: number | null | undefined) => (n != null ? `${n}` : "—");

export default function SpecialistHomeScreen() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  useEffect(() => {
    getDashboard()
      .then(setDashboardData)
      .catch((e) => console.error("Error cargando dashboard:", e))
      .finally(() => setLoading(false));
  }, []);

  if (!fontsLoaded) return null;

  const stats = dashboardData?.stats;
  const progress = dashboardData?.progress;

  // Barras de progreso en [0,100] para el ancho del fill; "—" si no hay datos.
  const sessionsValue =
    progress != null
      ? `${progress.sessions_completed_today}/${progress.sessions_total_today}`
      : "—";
  const sessionsProgress =
    progress != null && progress.sessions_total_today > 0
      ? (progress.sessions_completed_today / progress.sessions_total_today) * 100
      : 0;
  const compliance = progress?.daily_compliance;

  return (
    <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Dashboard de Resumen</Text>
        <Text style={styles.bannerSubtitle}>
          {dashboardData
            ? `Hola, ${dashboardData.specialist.full_name}`
            : "Estado general de su red de atención para hoy."}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#27695A" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.grid}>
            <StatCard
              icon="account-group-outline"
              iconColor="#49A2A5"
              value={fmt(stats?.total_patients)}
              label="Pacientes"
            />
            <StatCard
              icon="run-fast"
              iconColor="#49A2A5"
              value={fmt(stats?.active_today)}
              label="Activos Hoy"
            />
            <StatCard
              icon="alert-outline"
              iconColor="#E75756"
              value={fmt(stats?.alerts)}
              label="Alertas"
              alert={(stats?.alerts ?? 0) > 0}
            />
            <StatCard
              icon="trending-up"
              iconColor="#49A2A5"
              value={stats != null ? `${stats.avg_adherence}%` : "—"}
              label="Progreso Prom."
            />
          </View>

          <View style={styles.metricsCard}>
            <View style={styles.metricsHeader}>
              <Text style={styles.metricsTitle}>Métricas de Hoy</Text>
              <MaterialCommunityIcons name="chart-bar" size={22} color="#49A2A5" />
            </View>

            <MetricRow
              label="Sesiones completadas"
              value={sessionsValue}
              progress={sessionsProgress}
            />
            <MetricRow
              label="Cumplimiento diario"
              value={compliance != null ? `${compliance}%` : "—"}
              progress={compliance ?? 0}
              topMargin={16}
            />
          </View>
        </ScrollView>
      )}

      <SpecialistNavbar active="home" />

      <TouchableOpacity style={styles.backToSplash} onPress={() => router.replace("/" as any)}>
        <MaterialCommunityIcons name="home-outline" size={18} color="#27695A" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 20,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    width: "100%",
    backgroundColor: "#49A2A5",
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },
  bannerSubtitle: {
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#DEEDE6",
    marginTop: 4,
  },
  backToSplash: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(222,237,230,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginHorizontal: 16,
  },
  statCard: {
    width: "47%",
    backgroundColor: "#DEEDE6",
    borderWidth: 1,
    borderColor: "#49A2A5",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: "relative",
  },
  statIconWrap: {
    backgroundColor: "#EAF4F0",
    padding: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  alertDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E75756",
  },
  statValue: {
    fontSize: 32,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginTop: 10,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
  metricsCard: {
    backgroundColor: "#DEEDE6",
    borderWidth: 1,
    borderColor: "#49A2A5",
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 4,
    padding: 20,
  },
  metricsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  metricsTitle: {
    fontSize: 18,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
  metricValue: {
    fontSize: 14,
    fontFamily: "PromptBold",
    color: "#49A2A5",
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "#90C0C1",
    marginTop: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#27695A",
  },
});
