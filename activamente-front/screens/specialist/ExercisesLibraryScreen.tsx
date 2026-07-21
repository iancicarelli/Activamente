import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useLocalSearchParams, useRouter } from "expo-router";
import { routes } from "../../router/routes";
import { getExercises, Exercise } from "../../services/exerciseService";

export default function ExercisesLibraryScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  // ─── Carga de ejercicios al montar ───────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getExercises();
        if (active) setExercises(data);
      } catch (e: any) {
        if (active)
          setError(e?.message ?? "No se pudieron cargar los ejercicios");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = exercises.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleAdd = (exercise: Exercise) => {
    router.push({
      pathname: routes.createRutine as any,
      params: {
        patientId,
        selectedExercise: JSON.stringify(exercise),
      },
    });
  };

  const handleCancel = () => {
    router.push(routes.patientList as any);
  };

  // ─── Card de ejercicio ───────────────────────────────
  const ExerciseCard = ({
    exercise,
    onAdd,
  }: {
    exercise: Exercise;
    onAdd: (exercise: Exercise) => void;
  }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <MaterialCommunityIcons name="run" size={24} color="#49A2A5" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.cardName}>{exercise.name}</Text>
          {exercise.description ? (
            <Text style={styles.cardMeta}>{exercise.description}</Text>
          ) : null}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(exercise)}>
          <MaterialCommunityIcons name="plus" size={20} color="#DEEDE6" />
        </TouchableOpacity>
      </View>

      {exercise.multimedia_url ? (
        <View style={styles.videoPlaceholder}>
          <MaterialCommunityIcons
            name="play-circle-outline"
            size={20}
            color="#27695A"
          />
          <Text style={styles.videoText}>Video disponible</Text>
        </View>
      ) : null}
    </View>
  );

  if (!fontsLoaded) return null;

  // ─── Pantalla principal ──────────────────────────────
  return (
    <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
      {/* Banner */}
      <View style={styles.banner}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerSubtitle}>Panel Profesional</Text>
            <Text style={styles.bannerTitle}>Biblioteca de Ejercicios</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {patientId ? (
          <Text style={styles.assignText}>
            Asignando rutina al paciente: {patientId}
          </Text>
        ) : null}

        {/* Buscador */}
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color="#27695A"
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar Ejercicio..."
            placeholderTextColor="#7BB899"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#27695A"
            style={{ marginTop: 32 }}
          />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No hay ejercicios para mostrar.</Text>
        ) : (
          filtered.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onAdd={handleAdd}
            />
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 80, paddingHorizontal: 16, paddingTop: 16 },
  banner: {
    width: "100%",
    backgroundColor: "#49A2A5",
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
    color: "#27695A",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  assignText: {
    marginBottom: 10,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
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
  card: {
    backgroundColor: "#DEEDE6",
    borderWidth: 1,
    borderColor: "#49A2A5",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center" },
  cardName: { fontSize: 15, fontFamily: "PromptBold", color: "#27695A" },
  cardMeta: {
    fontSize: 12,
    fontFamily: "PromptRegular",
    color: "#27695A",
    marginTop: 2,
  },
  videoPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#EAF4F0",
  },
  videoText: {
    marginLeft: 8,
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
  errorText: {
    marginTop: 32,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#E75756",
  },
  emptyText: {
    marginTop: 32,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#7BB899",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#E75756",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    margin: 19,
    marginBottom: 129,
  },
  cancelText: { fontSize: 16, fontFamily: "PromptBold", color: "#DEEDE6" },
});
