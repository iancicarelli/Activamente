import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import SpecialistNavbar from "../../components/SpecialistNavbar";
import { routes } from "../../router/routes";
import { Colors, GradientColors, BannerStyle } from "../../constants/theme";
import {
  getPatientById,
  togglePatientStatus,
  Patient,
} from "../../services/patientService";

// ─── Sub-components ──────────────────────────────────────────────────────────

function ContactRow({
  icon,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  value: string;
}) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIconWrap}>
        <MaterialCommunityIcons name={icon} size={18} color="#49A2A5" />
      </View>
      <Text style={styles.contactText}>{value}</Text>
    </View>
  );
}

function MetricBar({
  label,
  progress,
  topMargin,
}: {
  label: string;
  progress: number;
  topMargin?: number;
}) {
  return (
    <View style={{ marginTop: topMargin ?? 0 }}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

function SessionItem({
  name,
  duration,
  date,
  completed,
}: {
  name: string;
  duration: string;
  date: string;
  completed: boolean;
}) {
  return (
    <View style={styles.sessionItem}>
      <View style={styles.sessionLeft}>
        <Text style={styles.sessionName}>{name}</Text>
        <Text style={styles.sessionDuration}>{duration}</Text>
      </View>
      <View style={styles.sessionRight}>
        <Text style={styles.sessionDate}>{date}</Text>
        {completed && (
          <View style={styles.sessionBadge}>
            <Text style={styles.sessionBadgeText}>Completado</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MedicalRecordScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  useEffect(() => {
    if (!patientId) {
      Alert.alert("Error", "No se indicó el paciente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getPatientById(patientId)
      .then(setPatient)
      .catch((err) => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  const handleToggleStatus = () => {
    if (!patient) return;
    const next = !patient.active;
    const label = next ? "habilitar" : "deshabilitar";
    Alert.alert("Confirmar", `¿Desea ${label} a este paciente?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: () =>
          togglePatientStatus(patient.id, next)
            .then(setPatient)
            .catch((err) => Alert.alert("Error", err.message)),
      },
    ]);
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#49A2A5" />
      </View>
    );
  }

  if (!patient) return null;

  const { metrics, sessions } = patient;

  return (
    <LinearGradient colors={GradientColors as unknown as [string, string]} style={styles.container}>
      {/* ── Header banner ── */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Ficha Medica Paciente</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Patient card ── */}
        <View style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.avatarWrap}>
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={48}
                color="#49A2A5"
              />
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{patient.fullName}</Text>
              <Text style={styles.patientRut}>{patient.rut}</Text>
              <View style={styles.patientMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaKey}>Edad</Text>
                  <Text style={styles.metaVal}>{patient.age} años</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaKey}>Genero</Text>
                  <Text style={styles.metaVal}>{patient.gender}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Contact info ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Información de Contacto</Text>
        </View>
        <View style={styles.card}>
          <ContactRow icon="email-outline" value={patient.email} />
          <ContactRow icon="phone-outline" value={patient.phone} />
          <ContactRow icon="map-marker-outline" value={patient.address} />
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity
          style={styles.agendarBtn}
          onPress={() =>
            router.push({
              pathname: routes.scheduleAppointment as any,
              params: { patientId: patient.id },
            })
          }
        >
          <Text style={styles.agendarText}>Agendar Hora</Text>
        </TouchableOpacity>

        {/* ── Compliance metrics ── */}
        <View style={styles.card}>
          <View style={styles.metricsHeader}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={20}
              color="#49A2A5"
            />
            <Text style={styles.metricsTitle}>Métricas de Cumplimiento</Text>
          </View>
          <Text style={styles.bigNumber}>{metrics.sessionsCompleted}</Text>
          <Text style={styles.bigNumberSub}>/ {metrics.sessionsTotal}</Text>
          <Text style={styles.metricsSubLabel}>
            Sesiones completadas esta semana
          </Text>
          <MetricBar
            label={`${metrics.adherencePercent}% Adherencia`}
            progress={metrics.adherencePercent}
            topMargin={12}
          />
        </View>

        {/* ── Session history ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Historial de Sesiones</Text>
        </View>
        <View style={styles.card}>
          {sessions.map((s, i) => (
            <React.Fragment key={s.id}>
              <SessionItem
                name={s.name}
                duration={s.duration}
                date={s.date}
                completed={s.completed}
              />
              {i < sessions.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Disable / Enable ── */}
        <TouchableOpacity
          style={[styles.disableBtn, !patient.active && styles.enableBtn]}
          onPress={handleToggleStatus}
        >
          <Text style={styles.disableBtnText}>
            {patient.active ? "Deshabilitar" : "Habilitar"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <SpecialistNavbar active="patients" />
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.cardBg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  banner: {
    ...BannerStyle,
  },
  bannerTitle: {
    fontSize: 22,
    fontFamily: "PromptBold",
    color: Colors.bannerTitle,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    marginTop: 12,
  },
  sectionLabel: {
    marginHorizontal: 16,
    marginBottom: 6,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "PromptBold",
    color: Colors.textPrimary,
  },
  // Patient
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 50,
    padding: 6,
    marginRight: 14,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontFamily: "PromptBold",
    color: Colors.textPrimary,
  },
  patientRut: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  patientMeta: {
    flexDirection: "row",
    marginTop: 8,
    gap: 20,
  },
  metaItem: {},
  metaKey: {
    fontSize: 11,
    fontFamily: "PromptRegular",
    color: Colors.textMuted,
  },
  metaVal: {
    fontSize: 13,
    fontFamily: "PromptBold",
    color: Colors.textPrimary,
  },
  // Contact
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  contactIconWrap: {
    backgroundColor: Colors.cardBgAlt,
    padding: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  contactText: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: Colors.textPrimary,
    flex: 1,
  },
  // Agendar
  agendarBtn: {
    backgroundColor: Colors.btnPrimary,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  agendarText: {
    fontSize: 15,
    fontFamily: "PromptBold",
    color: Colors.bannerTitle,
  },
  // Metrics
  metricsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  metricsTitle: {
    fontSize: 15,
    fontFamily: "PromptBold",
    color: Colors.textPrimary,
  },
  bigNumber: {
    fontSize: 48,
    fontFamily: "PromptBold",
    color: Colors.textPrimary,
    lineHeight: 54,
  },
  bigNumberSub: {
    fontSize: 18,
    fontFamily: "PromptRegular",
    color: Colors.textMuted,
    marginTop: -4,
  },
  metricsSubLabel: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.cardBg,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textPrimary,
  },
  // Sessions
  sessionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  sessionLeft: {
    flex: 1,
  },
  sessionName: {
    fontSize: 14,
    fontFamily: "PromptBold",
    color: Colors.textPrimary,
  },
  sessionDuration: {
    fontSize: 12,
    fontFamily: "PromptRegular",
    color: Colors.textSecondary,
    marginTop: 3,
  },
  sessionRight: {
    alignItems: "flex-end",
    marginLeft: 10,
  },
  sessionDate: {
    fontSize: 12,
    fontFamily: "PromptRegular",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  sessionBadge: {
    backgroundColor: Colors.cardBgAlt,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sessionBadgeText: {
    fontSize: 11,
    fontFamily: "PromptBold",
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBgAlt,
  },
  // Disable/Enable
  disableBtn: {
    backgroundColor: Colors.btnDanger,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 14,
    alignItems: "center",
  },
  enableBtn: {
    backgroundColor: Colors.btnTeal,
  },
  disableBtnText: {
    fontSize: 15,
    fontFamily: "PromptBold",
    color: Colors.bannerTitle,
  },
});