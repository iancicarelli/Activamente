// screens/patient/InstructionScreen.tsx — instrucciones del ejercicio actual de
// la rutina REAL (HC-01): video con Play/Ver de nuevo que se pausa al perder
// foco (EX-04) y botón para verlo a pantalla completa, 3-4 pasos, series/reps/descanso en tarjetas grandes y
// botón Iniciar fijo abajo (UX-15). `preview=1` permite repasar sin sesión.
import React, { useCallback, useRef, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Screen, Banner, Card, Button, LoadingView, ErrorView, confirm } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { buildExercisePlan, useSessionPlan } from "../../hooks/useSessionPlan";
import { splitSentences } from "../../utils/text";

const VIDEO_MAP: Record<string, any> = {
  toe_touch: require("../../assets/videos/toe_touch.mp4"),
  leg_raise: require("../../assets/videos/leg_raise.mp4"),
  shoulder_raises: require("../../assets/videos/shoulder_raises.mp4"),
  squat: require("../../assets/videos/squat.mp4"),
};

const FALLBACK_INSTRUCTIONS = [
  "Colócate en la posición inicial del ejercicio",
  "Haz el movimiento lento y controlado",
  "Mantén la postura correcta en toda la repetición",
  "Vuelve a la posición inicial y repite",
];

export default function InstructionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ index?: string; sessionId?: string; routineId?: string; preview?: string }>();
  const index = Number(params.index ?? 0);
  const preview = params.preview === "1" || !params.sessionId;
  const { plan, loading, error, reload } = useSessionPlan({ sessionId: params.sessionId, routineId: params.routineId });

  const videoRef = useRef<Video>(null);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const openFullscreen = () => {
    void videoRef.current?.pauseAsync().catch(() => {});
    setPlaying(false);
    setFullscreen(true);
  };

  // Pausar el video al salir de la pantalla (EX-04).
  useFocusEffect(
    useCallback(() => {
      return () => {
        void videoRef.current?.pauseAsync().catch(() => {});
      };
    }, [])
  );

  const exercise = plan ? buildExercisePlan(plan, index) : null;
  const catalog = exercise && plan ? plan.catalog[exercise.exerciseId] : null;
  const instructions = catalog?.instructions?.trim() ? splitSentences(catalog.instructions).slice(0, 4) : FALLBACK_INSTRUCTIONS;

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (finished) {
      await v.replayAsync();
      setFinished(false);
      setPlaying(true);
      return;
    }
    if (playing) await v.pauseAsync();
    else await v.playAsync();
    setPlaying(!playing);
  };

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      setFinished(true);
      setPlaying(false);
    }
  };

  const exit = async () => {
    if (preview) {
      router.back();
      return;
    }
    const ok = await confirm("¿Salir del entrenamiento?", "Lo que ya hiciste queda guardado, pero la sesión quedará incompleta.", {
      confirmText: "Salir",
      destructive: true,
    });
    if (ok) router.replace(routes.patientHome);
  };

  const start = () => {
    if (!exercise) return;
    if (preview) {
      // En repaso, "siguiente" pasa al ejercicio siguiente sin cámara.
      if (index + 1 < exercise.totalExercises) {
        router.replace({ pathname: routes.instruction, params: { routineId: plan?.routine.id ?? "", index: String(index + 1), preview: "1" } });
      } else {
        router.back();
      }
      return;
    }
    router.replace({ pathname: routes.activeExercise, params: { sessionId: params.sessionId ?? "", index: String(index) } });
  };

  return (
    <Screen>
      <Banner
        title={exercise ? `Ejercicio ${index + 1} de ${exercise.totalExercises}` : "Ejercicio"}
        subtitle={preview ? "Modo repaso" : undefined}
        big
        showBack
        onBack={exit}
      />
      {loading ? (
        <LoadingView />
      ) : error || !exercise ? (
        <ErrorView message={error ?? "No se encontró el ejercicio."} onRetry={reload} big />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.name}>{exercise.name}</Text>

            <View style={styles.videoCard}>
              {VIDEO_MAP[exercise.exerciseId] ? (
                <Video
                  ref={videoRef}
                  style={StyleSheet.absoluteFill}
                  source={VIDEO_MAP[exercise.exerciseId]}
                  resizeMode={ResizeMode.COVER}
                  onPlaybackStatusUpdate={onStatus}
                  isMuted
                />
              ) : null}
              {!playing && (
                <TouchableOpacity style={styles.playOverlay} onPress={togglePlay} accessibilityRole="button" accessibilityLabel={finished ? "Ver de nuevo" : "Ver el video"}>
                  <View style={styles.playCircle}>
                    <MaterialCommunityIcons name={finished ? "replay" : "play"} size={56} color={Colors.textOnDark} />
                  </View>
                  <Text style={styles.playLabel}>{finished ? "Ver de nuevo" : "Ver el video"}</Text>
                </TouchableOpacity>
              )}
              {VIDEO_MAP[exercise.exerciseId] ? (
                <TouchableOpacity style={styles.expandBtn} onPress={openFullscreen} accessibilityRole="button" accessibilityLabel="Ver video en pantalla completa" testID="video-fullscreen">
                  <MaterialCommunityIcons name="fullscreen" size={32} color={Colors.textOnDark} />
                </TouchableOpacity>
              ) : null}
              {playing && (
                <TouchableOpacity style={styles.pauseBtn} onPress={togglePlay} accessibilityRole="button" accessibilityLabel="Pausar video">
                  <MaterialCommunityIcons name="pause" size={30} color={Colors.textOnDark} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.pills}>
              <Pill icon="repeat-variant" value={String(exercise.totalSeries)} label={exercise.totalSeries === 1 ? "serie" : "series"} />
              <Pill icon="counter" value={String(exercise.totalReps)} label="repeticiones" />
              <Pill icon="timer-sand" value={`${exercise.restSeconds} s`} label="descanso" />
            </View>

            <Card>
              {instructions.map((text, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{text}</Text>
                </View>
              ))}
            </Card>
          </ScrollView>
          {VIDEO_MAP[exercise.exerciseId] ? (
            <FullscreenVideo visible={fullscreen} source={VIDEO_MAP[exercise.exerciseId]} title={exercise.name} onClose={() => setFullscreen(false)} />
          ) : null}
          <View style={styles.footer}>
            <Button
              title={preview ? (index + 1 < exercise.totalExercises ? "Siguiente ejercicio" : "Volver") : "Iniciar ejercicio"}
              size="patient"
              icon={preview ? "arrow-right" : "play"}
              onPress={start}
              testID="instruction-start"
            />
          </View>
        </>
      )}
    </Screen>
  );
}

function FullscreenVideo({ visible, source, title, onClose }: { visible: boolean; source: any; title: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const ref = useRef<Video>(null);
  const [paused, setPaused] = useState(false);

  const togglePause = async () => {
    const v = ref.current;
    if (!v) return;
    if (paused) await v.playAsync();
    else await v.pauseAsync();
    setPaused(!paused);
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} onShow={() => setPaused(false)} statusBarTranslucent>
      <View style={[styles.fullWrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.fullTitle} accessibilityRole="header">
          {title}
        </Text>
        <TouchableOpacity style={styles.fullVideo} activeOpacity={1} onPress={togglePause} accessibilityRole="button" accessibilityLabel={paused ? "Reproducir video" : "Pausar video"}>
          {visible && <Video ref={ref} style={StyleSheet.absoluteFill} source={source} resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping isMuted />}
          {paused && (
            <View style={styles.playOverlay}>
              <View style={styles.playCircle}>
                <MaterialCommunityIcons name="play" size={56} color={Colors.textOnDark} />
              </View>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.fullActions}>
          <Button title={paused ? "Reproducir" : "Pausar"} icon={paused ? "play" : "pause"} size="patient" variant="teal" onPress={togglePause} style={{ flex: 1 }} />
          <Button title="Cerrar" icon="close" size="patient" onPress={onClose} style={{ flex: 1 }} testID="video-fullscreen-close" />
        </View>
      </View>
    </Modal>
  );
}

function Pill({ icon, value, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; value: string; label: string }) {
  return (
    <View style={styles.pill} accessibilityLabel={`${value} ${label}`}>
      <MaterialCommunityIcons name={icon} size={26} color={Colors.btnTeal} />
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 24 },
  name: { fontSize: FontSize.hero, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: "center", lineHeight: 42, marginBottom: 14 },
  videoCard: { height: 260, borderRadius: 20, overflow: "hidden", backgroundColor: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  playCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.btnPrimary, alignItems: "center", justifyContent: "center" },
  playLabel: { marginTop: 10, fontSize: FontSize.patient.body, fontFamily: Fonts.bold, color: Colors.textOnDark },
  expandBtn: { position: "absolute", top: 12, right: 12, width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(39,105,90,0.85)", alignItems: "center", justifyContent: "center" },
  fullWrap: { flex: 1, backgroundColor: Colors.videoBg, paddingHorizontal: 16 },
  fullTitle: { fontSize: FontSize.patient.title, fontFamily: Fonts.bold, color: Colors.textOnDark, textAlign: "center", marginBottom: 12 },
  fullVideo: { flex: 1, borderRadius: 16, overflow: "hidden" },
  fullActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  pauseBtn: { position: "absolute", bottom: 12, right: 12, width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(39,105,90,0.85)", alignItems: "center", justifyContent: "center" },
  pills: { flexDirection: "row", gap: 10, marginBottom: 14 },
  pill: { flex: 1, backgroundColor: Colors.cardBg, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", paddingVertical: 12 },
  pillValue: { fontSize: FontSize.title, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: 4 },
  pillLabel: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textSecondary },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  stepNumber: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.textPrimary, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.textOnDark },
  stepText: { flex: 1, fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary, lineHeight: 30 },
  footer: { padding: 16, paddingBottom: 24 },
});
