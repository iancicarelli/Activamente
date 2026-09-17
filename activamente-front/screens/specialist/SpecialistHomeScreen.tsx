// screens/specialist/SpecialistHomeScreen.tsx — dashboard del especialista.
import React, { useCallback, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, LoadingView, ErrorView } from "../../components/ui";
import { StatCard } from "../../components/StatCard";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { getDashboard, DashboardResponse } from "../../services/specialistService";
import { getErrorMessage } from "../../utils/errors";

function MetricRow({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <View style={{ marginTop: 12 }}>
      <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
      </View>
    </View>
  );
}

export default function SpecialistHomeScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else if (!loaded.current) setLoading(true);
    setError(null);
    try {
      setData(await getDashboard());
      loaded.current = true;
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const stats = data?.stats;
  const progress = data?.progress;
  const sessionsProgress = progress && progress.sessions_total_today > 0 ? (progress.sessions_completed_today / progress.sessions_total_today) * 100 : 0;

  return (
    <Screen>
      <Banner overline="Panel profesional" title={data ? `Hola, ${data.specialist.full_name}` : "Resumen"} subtitle={data?.specialist.specialty ?? "Estado de tus pacientes para hoy"} />
      {loading ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={error} onRetry={() => load()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.btnTeal]} />}
        >
          <View style={styles.grid}>
            <StatCard icon="account-group-outline" value={String(stats?.total_patients ?? 0)} label="Pacientes" />
            <StatCard icon="run-fast" value={String(stats?.active_today ?? 0)} label="Activos hoy" />
            <StatCard icon="alert-outline" iconColor={Colors.btnDanger} value={String(stats?.alerts ?? 0)} label="Alertas" alert={(stats?.alerts ?? 0) > 0} />
            <StatCard icon="trending-up" value={`${stats?.avg_adherence ?? 0}%`} label="Adherencia prom." />
          </View>

          <Card>
            <View style={styles.metricsHeader}>
              <Text style={styles.metricsTitle}>Métricas de hoy</Text>
              <MaterialCommunityIcons name="chart-bar" size={22} color={Colors.btnTeal} />
            </View>
            {progress && progress.sessions_total_today === 0 ? <Text style={styles.metricHint}>Hoy ningún paciente tiene rutina programada.</Text> : null}
            <MetricRow label="Pacientes que completaron su sesión" value={progress ? `${progress.sessions_completed_today}/${progress.sessions_total_today}` : "—"} progress={sessionsProgress} />
            <MetricRow label="Cumplimiento diario" value={progress ? `${progress.daily_compliance}%` : "—"} progress={progress?.daily_compliance ?? 0} />
          </Card>

          <View style={styles.actions}>
            <Button title="Mis pacientes" icon="account-group-outline" variant="dark" onPress={() => router.push(routes.patientList)} style={{ flex: 1 }} />
            <Button title="Agregar paciente" icon="account-plus-outline" onPress={() => router.push(routes.assignPatient)} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  metricsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricsTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary },
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricLabel: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textPrimary },
  metricValue: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.btnTeal },
  metricHint: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 6 },
  track: { width: "100%", height: 8, borderRadius: 4, backgroundColor: "#90C0C1", marginTop: 6, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: Colors.textPrimary },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
