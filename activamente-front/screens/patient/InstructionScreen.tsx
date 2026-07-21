import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { EXERCISES } from "../../constants/exercises";
import { Video, ResizeMode } from "expo-av";
import { getActiveRoutine, RoutineExercise } from "../../services/routineService";
import { getExercises, Exercise } from "../../services/exerciseService";
import { getSession } from "../../services/authStore";

const VIDEO_MAP: Record<string, any> = {
  toe_touch: require("../../assets/videos/toe_touch.mp4"),
  leg_raise: require("../../assets/videos/leg_raise.mp4"),
  shoulder_raises: require("../../assets/videos/shoulder_raises.mp4"),
  squat: require("../../assets/videos/squat.mp4"),
};

// Pasos genéricos de respaldo SOLO si el ejercicio no tiene `instructions` en el
// backend. El catálogo (GET /api/exercises) sí las trae para los ejercicios
// sembrados; este fallback cubre ejercicios nuevos que aún no tengan texto.
const FALLBACK_INSTRUCTIONS = [
  "Colócate en la posición inicial del ejercicio",
  "Realiza el movimiento de forma lenta y controlada",
  "Mantén la postura correcta durante toda la repetición",
  "Vuelve a la posición inicial y repite",
];

// Las instrucciones del backend vienen como un párrafo; lo partimos en oraciones
// para mostrarlas como lista numerada (misma UI que antes).
const splitInstructions = (text: string): string[] =>
  text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 0);

export default function InstructionScreen() {
  const router = useRouter();
  const videoRef = useRef<Video>(null);

  const { index, sessionId, seIds } = useLocalSearchParams();
  const currentIndex = Number(index ?? 0);

  // Opción B: re-consultamos la rutina activa (mismo patrón que PatientHome) en
  // vez de arrastrar el objeto por params a través de instruction → active →
  // instruction. El índice mapea a routine.exercises ordenado por order_index,
  // igual orden que usa el backend para crear los session_exercises.
  const [routineExercise, setRoutineExercise] = useState<RoutineExercise | null>(null);
  const [catalog, setCatalog] = useState<Exercise | null>(null);
  const [totalExercises, setTotalExercises] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  useEffect(() => {
    const patientId = getSession()?.patient?.id;
    if (!patientId) {
      setLoading(false);
      return;
    }
    Promise.all([getActiveRoutine(patientId), getExercises()])
      .then(([routine, exercises]) => {
        if (!routine) return;
        const ordered = [...routine.exercises].sort(
          (a, b) => a.order_index - b.order_index
        );
        const re = ordered[currentIndex] ?? null;
        setRoutineExercise(re);
        setTotalExercises(ordered.length);
        if (re) {
          setCatalog(exercises.find((e) => e.id === re.exercise_id) ?? null);
        }
      })
      .catch((e) => console.error("Error cargando ejercicio:", e))
      .finally(() => setLoading(false));
  }, [currentIndex]);

  if (!fontsLoaded) return null;

  // exerciseId real para el video (slug toe_touch/leg_raise/...). Cae al
  // constante EXERCISES por índice solo si la rutina aún no cargó.
  const exerciseId = routineExercise?.exercise_id ?? EXERCISES[currentIndex]?.exerciseId;
  const exerciseName =
    catalog?.name ??
    EXERCISES.find((e) => e.exerciseId === exerciseId)?.exerciseName ??
    exerciseId ??
    "Ejercicio";
  const totalSeries = routineExercise?.total_series ?? null;
  const totalReps = routineExercise?.total_reps ?? null;
  const totalCount = totalExercises || EXERCISES.length;
  const instructions =
    catalog?.instructions && catalog.instructions.trim().length > 0
      ? splitInstructions(catalog.instructions)
      : FALLBACK_INSTRUCTIONS;

  return (
    <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={32}
              color="#27695A"
            />
          </TouchableOpacity>
          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>{`Ejercicio ${currentIndex + 1} de ${totalCount}`}</Text>
          </View>
        </View>

        <View style={[styles.videoCard, { overflow: 'hidden' }]}>
          {exerciseId && VIDEO_MAP[exerciseId] && (
            <Video
              ref={videoRef}
              style={{ width: "100%", height: "100%" }}
              source={VIDEO_MAP[exerciseId]}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay
            />
          )}
          <TouchableOpacity
            style={styles.fullscreenButton}
            onPress={() => videoRef.current?.presentFullscreenPlayer()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="fullscreen" size={24} color="#DEEDE6" />
          </TouchableOpacity>
        </View>

        <Text style={styles.exerciseName}>{exerciseName}</Text>

        {loading ? (
          <ActivityIndicator size="small" color="#27695A" style={{ marginTop: 18 }} />
        ) : (
          <View style={styles.pillsRow}>
            <View style={styles.seriePill}>
              <Text style={styles.seriePillText}>
                {totalSeries != null ? `${totalSeries} Series` : "— Series"}
              </Text>
            </View>
            <View style={styles.repsPill}>
              <Text style={styles.repsPillText}>
                {totalReps != null ? `${totalReps} Repeticiones` : "— Repeticiones"}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.instructionsList}>
          {instructions.map((instruction, i) => (
            <View key={i} style={styles.instructionRow}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{instruction}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => router.push(`/active-exercise?index=${currentIndex}&sessionId=${sessionId ?? ""}&seIds=${seIds ?? ""}`)}
      >
        <Text style={styles.startButtonText}>Iniciar Ejercicio</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 50,
    marginHorizontal: 16,
  },
  headerPill: {
    backgroundColor: "#DEEDE6",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 12,
  },
  headerPillText: {
    fontFamily: "PromptBold",
    fontSize: 20,
    color: "#27695A",
  },
  videoCard: {
    backgroundColor: "#DEEDE6",
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 24,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#49A2A5",
  },
  fullscreenButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(39,105,90,0.7)",
    borderRadius: 8,
    padding: 6,
  },
  videoCardText: {
    fontFamily: "PromptBold",
    fontSize: 22,
    color: "#27695A",
    marginTop: 10,
  },
  exerciseName: {
    fontFamily: "PromptBold",
    fontSize: 32,
    color: "#27695A",
    marginTop: 24,
    marginHorizontal: 16,
    textAlign: "center",
    lineHeight: 40,
  },
  pillsRow: {
    flexDirection: "row",
    marginTop: 18,
    marginHorizontal: 16,
    gap: 10,
    flexWrap: 'wrap',
  },
  seriePill: {
    backgroundColor: "#DEEDE6",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#49A2A5',
  },
  seriePillText: {
    fontFamily: "PromptBold",
    fontSize: 22,
    color: "#27695A",
  },
  repsPill: {
    backgroundColor: "#EAF4F0",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#49A2A5',
  },
  repsPillText: {
    fontFamily: "PromptBold",
    fontSize: 22,
    color: "#27695A",
  },
  instructionsList: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  instructionNumber: {
    backgroundColor: "#27695A",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionNumberText: {
    fontFamily: "PromptBold",
    fontSize: 22,
    color: "#DEEDE6",
  },
  instructionText: {
    fontFamily: "PromptRegular",
    fontSize: 22,
    color: "#27695A",
    flex: 1,
    marginLeft: 14,
    lineHeight: 30,
  },
  startButton: {
    backgroundColor: "#7BB899",
    borderRadius: 20,
    marginHorizontal: 25,
    marginBottom: 30,
    marginTop: 16,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  startButtonText: {
    fontFamily: "PromptBold",
    fontSize: 30,
    color: "#DEEDE6",
  },
});
