// screens/specialist/MedicalRecordScreen.tsx — ficha del paciente: header de
// acciones (Agendar · Rutinas · Deshabilitar) (BT-16), estado de bienestar de la
// última sesión con encuesta (alerta si hay métricas en rojo), métricas reales
// de la semana (HC-08), tendencia de cómo se ha sentido e historial con las
// encuestas antes/después (UX-07). "Deshabilitar" bloquea la CUENTA (R-01 a).
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Badge, InfoRow, LoadingView, ErrorView, SectionTitle, confirm, useToast } from "../../components/ui";
import { SurveyComparison } from "../../components/SurveyComparison";
import { WellbeingTrend, trendSessions } from "../../components/WellbeingTrend";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { getPatientById, setPatientAccountStatus, Patient, SessionItem, WellbeingStatus } from "../../services/patientService";
import { formatDateTime } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";
import { sessionHasRedMetric } from "../../utils/wellbeing";

function WellbeingCard({ wellbeing }: { wellbeing: WellbeingStatus | null }) {
  if (!wellbeing) {
    return (
      <Card>
        <View style={styles.wbHead}>
          <MaterialCommunityIcons name="clipboard-text-clock-outline" size={28} color={Colors.btnTeal} />
          <Text style={styles.wbTitle}>Sin encuestas todavía</Text>
        </View>
        <Text style={styles.meta}>Cuando el paciente responda las encuestas de una sesión verás aquí cómo se sintió.</Text>
      </Card>
    );
  }
  const alert = wellbeing.hasAlert;
  return (
    <Card style={alert ? styles.wbAlert : undefined}>
      <View style={styles.wbHead} accessibilityRole="alert">
        <MaterialCommunityIcons name={alert ? "alert-circle" : "check-circle"} size={30} color={alert ? Colors.btnDanger : Colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.wbTitle, alert && { color: Colors.dangerText }]}>{alert ? "Requiere atención" : "Sin señales de alerta"}</Text>
          <Text style={styles.meta}>Según la última sesión · {formatDateTime(wellbeing.date)}</Text>
        </View>
      </View>
      {alert && (
        <View style={styles.reasons}>
          {wellbeing.reasons.map((r) => (
            <Badge key={r} label={r} tone="danger" icon="alert-outline" />
          ))}
        </View>
      )}
      <SurveyComparison pre={wellbeing.preSurvey} post={wellbeing.postSurvey} />
    </Card>
  );
}

function SessionRow({ s }: { s: SessionItem }) {
  const red = sessionHasRedMetric(s);
  return (
    <View style={styles.session}>
      <View style={styles.sessionHead}>
        <Text style={styles.sessionName}>{s.name}</Text>
        <Badge label={s.completed ? "Completada" : "Incompleta"} tone={s.completed ? "success" : "neutral"} />
      </View>
      <Text style={styles.sessionMeta}>
        {formatDateTime(s.date)} · {s.durationMinutes != null ? `${s.durationMinutes} min · ` : ""}
        {s.exercisesDone}/{s.exercisesTotal} ejercicios
      </Text>
      {red && (
        <View style={{ marginTop: 6 }}>
          <Badge label="Métricas en rojo" tone="danger" icon="alert-outline" />
        </View>
      )}
      <SurveyComparison pre={s.preSurvey} post={s.postSurvey} />
    </View>
  );
}

export default function MedicalRecordScreen() {
  const router = useRouter();
  const toast = useToast();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) {
      setError("No se indicó el paciente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPatient(await getPatientById(patientId));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleStatus = async () => {
    if (!patient) return;
    const next = !patient.active;
    const ok = await confirm(
      next ? "¿Habilitar cuenta?" : "¿Deshabilitar cuenta?",
      next ? `${patient.fullName} podrá volver a ingresar a la app.` : `${patient.fullName} no podrá ingresar a la app hasta que la habilites de nuevo.`,
      { confirmText: next ? "Habilitar" : "Deshabilitar", destructive: !next }
    );
    if (!ok) return;
    try {
      const updated = await setPatientAccountStatus(patient.id, next);
      setPatient({ ...patient, active: updated.active });
      toast(next ? "Cuenta habilitada" : "Cuenta deshabilitada");
    } catch (e) {
      toast(getErrorMessage(e), "error");
    }
  };

  const metrics = patient?.metrics;

  return (
    <Screen>
      <Banner title="Ficha del paciente" showBack />
      {loading ? (
        <LoadingView />
      ) : error || !patient ? (
        <ErrorView message={error ?? "Paciente no encontrado."} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.header}>
              <MaterialCommunityIcons name="account-circle-outline" size={56} color={Colors.btnTeal} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{patient.fullName}</Text>
                <Text style={styles.meta}>{[patient.rut, patient.age != null ? `${patient.age} años` : null, patient.gender].filter(Boolean).join(" · ")}</Text>
                <View style={{ marginTop: 6 }}>{!patient.active && <Badge label="Cuenta deshabilitada" tone="danger" icon="cancel" />}</View>
              </View>
            </View>
            <View style={styles.actionsRow}>
              <Button title="Agendar" icon="calendar-plus" size="sm" variant="teal" onPress={() => router.push({ pathname: routes.scheduleAppointment, params: { patientId: patient.id } })} style={{ flex: 1 }} />
              <Button title="Rutinas" icon="clipboard-list-outline" size="sm" onPress={() => router.push({ pathname: routes.routineList, params: { patientId: patient.id } })} style={{ flex: 1 }} />
              <Button title={patient.active ? "Deshabilitar" : "Habilitar"} icon={patient.active ? "account-off-outline" : "account-check-outline"} size="sm" variant={patient.active ? "danger" : "dark"} onPress={toggleStatus} style={{ flex: 1 }} />
            </View>
          </Card>

          <SectionTitle>Cómo se sintió</SectionTitle>
          <WellbeingCard wellbeing={patient.wellbeing} />

          <SectionTitle>Contacto</SectionTitle>
          <Card>
            <InfoRow icon="email-outline" label="Correo" value={patient.email} />
            <InfoRow icon="phone-outline" label="Teléfono" value={patient.phone || "No registrado"} />
            <InfoRow icon="map-marker-outline" label="Dirección" value={patient.address || "No registrada"} />
          </Card>

          {metrics && (
            <>
              <SectionTitle>Cumplimiento</SectionTitle>
              <Card>
                <View style={styles.metricsGrid}>
                  <Metric value={String(metrics.sessionsCompletedThisWeek)} label="esta semana" />
                  <Metric value={`${metrics.sessionsCompleted}/${metrics.sessionsTotal}`} label="completadas / total" />
                  <Metric value={`${metrics.currentStreakDays}`} label="días seguidos" />
                </View>
                <Text style={styles.metricLabel}>{metrics.adherencePercent}% de adherencia</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${metrics.adherencePercent}%` }]} />
                </View>
              </Card>
            </>
          )}

          {trendSessions(patient.sessions).length >= 2 && (
            <>
              <SectionTitle>Evolución</SectionTitle>
              <Card>
                <WellbeingTrend sessions={patient.sessions} />
              </Card>
            </>
          )}

          <SectionTitle>Historial de sesiones</SectionTitle>
          <Card>
            {patient.sessions.length === 0 ? (
              <Text style={styles.meta}>Este paciente aún no tiene sesiones.</Text>
            ) : (
              patient.sessions.map((s, i) => (
                <React.Fragment key={s.id}>
                  <SessionRow s={s} />
                  {i < patient.sessions.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))
            )}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSub}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  metricsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: FontSize.title, fontFamily: Fonts.bold, color: Colors.textPrimary },
  metricSub: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: "center" },
  metricLabel: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6 },
  track: { width: "100%", height: 8, borderRadius: 4, backgroundColor: Colors.cardBgAlt, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: Colors.textPrimary },
  wbAlert: { borderWidth: 2, borderColor: Colors.alertBorder },
  wbHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  wbTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  session: { paddingVertical: 12 },
  sessionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  sessionName: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  sessionMeta: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.divider },
});
