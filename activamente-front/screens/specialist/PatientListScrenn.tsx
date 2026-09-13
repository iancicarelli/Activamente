import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import SpecialistNavbar from "../../components/SpecialistNavbar";
import { getPatients, PatientListItem } from "../../services/patientService";
import { routes } from "../../router/routes";

// ─── Patient card ─────────────────────────────────────────────────────────────

function PatientCard({
  patient,
  onViewInfo,
  onAssignRoutine,
}: {
  patient: PatientListItem;
  onViewInfo: (id: string) => void;
  onAssignRoutine: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      {/* ── Top: avatar + info + alert badge ── */}
      <View style={styles.cardTop}>
        <View style={styles.avatarWrap}>
          <MaterialCommunityIcons
            name="account-outline"
            size={24}
            color="#49A2A5"
          />
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{patient.fullName}</Text>
        </View>

        {patient.hasAlert && (
          <View style={styles.alertBadge}>
            <MaterialCommunityIcons
              name="alert-outline"
              size={13}
              color="#92400E"
            />
            <Text style={styles.alertBadgeText}>Alerta</Text>
          </View>
        )}
      </View>

      {/* ── Alert sub-message ── */}
      {patient.alertMessage && (
        <Text style={styles.alertMessage}>{patient.alertMessage}</Text>
      )}

      {/* ── Divider ── */}
      <View style={styles.cardDivider} />

      {/* ── Action buttons ── */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.btnInfo}
          onPress={() => onViewInfo(patient.id)}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons
            name="account-details-outline"
            size={15}
            color="#49A2A5"
          />
          <Text style={styles.btnInfoText}>Ver información</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnRoutine}
          onPress={() => onAssignRoutine(patient.id)}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons
            name="clipboard-list-outline"
            size={15}
            color="#27695A"
          />
          <Text style={styles.btnRoutineText}>Asignar rutina</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PatientListScreen() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  useEffect(() => {
    getPatients()
      .then(setPatients)
      .catch((err) => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((p) =>
    p.fullName.toLowerCase().includes(query.toLowerCase())
  );

  const handleViewInfo = (id: string) => {
    router.push({ pathname: routes.medicalRecord as any, params: { patientId: id } });
  };

  const handleAssignRoutine = (id: string) => {
    router.push({ pathname: routes.routineList as any, params: { patientId: id } });
  };

  const handleAddPatient = () => {
    router.push(routes.registerPatient as any);
  };

  if (!fontsLoaded || loading) {
    return (
      <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.centered}>
        <ActivityIndicator size="large" color="#49A2A5" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerSubtitle}>Panel Profesional</Text>
            <Text style={styles.bannerTitle}>Mis pacientes</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={handleAddPatient}>
            <MaterialCommunityIcons name="plus" size={20} color="#27695A" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Search bar ── */}
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color="#27695A"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar Pacientes..."
            placeholderTextColor="#7BB899"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* ── Patient list ── */}
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No se encontraron pacientes.</Text>
        ) : (
          filtered.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              onViewInfo={handleViewInfo}
              onAssignRoutine={handleAssignRoutine}
            />
          ))
        )}
      </ScrollView>

      <SpecialistNavbar active="patients" />
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  // Banner
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
  bannerSubtitle: {
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#DEEDE6",
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#7BB899",
    alignItems: "center",
    justifyContent: "center",
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderColor: "#49A2A5",
    borderWidth: 1,
    backgroundColor: "#EAF4F0",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
    padding: 0,
  },

  // Patient card
  card: {
    backgroundColor: "#DEEDE6",
    borderWidth: 1,
    borderColor: "#49A2A5",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EAF4F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontFamily: "PromptBold",
    color: "#27695A",
  },

  // Alert badge
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
    marginLeft: 8,
  },
  alertBadgeText: {
    fontSize: 11,
    fontFamily: "PromptBold",
    color: "#92400E",
  },

  // Alert sub-text
  alertMessage: {
    fontSize: 11,
    fontFamily: "PromptRegular",
    color: "#92400E",
    marginTop: 8,
    marginLeft: 54,
  },

  // Divider between info and buttons
  cardDivider: {
    height: 1,
    backgroundColor: "#49A2A5",
    marginVertical: 12,
  },

  // Action buttons row
  cardActions: {
    flexDirection: "row",
    gap: 10,
  },

  // "Ver información" — teal outline
  btnInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#49A2A5",
    borderRadius: 10,
    paddingVertical: 9,
    backgroundColor: "#EAF4F0",
  },
  btnInfoText: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "#27695A",
  },

  // "Asignar rutina" — primary filled
  btnRoutine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#7BB899",
    borderRadius: 10,
    paddingVertical: 9,
  },
  btnRoutineText: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },

  emptyText: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
    marginTop: 40,
  },
});