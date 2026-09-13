import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
  VisionCameraProxy,
} from 'react-native-vision-camera';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import Svg, { Circle, Line } from 'react-native-svg';
import { useExerciseValidator } from '../../validation/useExerciseValidator';
import { EXERCISES } from '../../constants/exercises';
import { Landmark } from '../../validation/types';
import { MIN_VISIBILITY } from '../../validation/landmarkIndices';
import { updateExerciseProgress } from '../../services/sessionService';

// ─── Constants ────────────────────────────────────────────────────────────────

// MediaPipe BlazePose skeleton: only body joints, skip face/feet noise
const CONNECTIONS: [number, number][] = [
  [11, 12],           // hombros
  [11, 13], [13, 15], // brazo izquierdo
  [12, 14], [14, 16], // brazo derecho
  [11, 23], [12, 24], // tronco
  [23, 24],           // caderas
  [23, 25], [25, 27], // pierna izquierda
  [24, 26], [26, 28], // pierna derecha
];

// Solo dibujamos los landmarks que aportan al esqueleto/feedback: los que aparecen
// en CONNECTIONS (juntas del cuerpo) más NOSE(0) para la referencia de cabeza.
// Evita pintar cara (1-10), manos (17-22) y pies (29-32) que ningún validador usa.
const DRAW_LANDMARK_INDICES: number[] = Array.from(new Set([0, ...CONNECTIONS.flat()]));

const FRAME_INTERVAL = 4; // procesa 1 de cada 4 frames → ~7 fps a 30 fps cámara

// Objetivo de reps por serie (hoy fijo, igual que el "/10" que muestra la UI).
const REP_GOAL = 10;

// Initialized once at module level — cheap, just a JS object
const posePlugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});

// ─── Skeleton overlay ─────────────────────────────────────────────────────────
// Los landmarks viven en el estado INTERNO de este componente y se actualizan vía
// ref (update()), no por props del root. Así, al llegar un frame solo re-renderiza
// el esqueleto y nunca ActiveExerciseScreen. width/height siguen llegando por props
// (cameraSize del root). React.memo evita re-render cuando width/height no cambian.
export type PoseSkeletonHandle = { update: (lms: Landmark[]) => void };

const PoseSkeleton = React.memo(
  forwardRef<PoseSkeletonHandle, { width: number; height: number }>(
    function PoseSkeleton({ width, height }, ref) {
    const [landmarks, setLandmarks] = useState<Landmark[]>([]);

    useImperativeHandle(ref, () => ({
      update: (lms: Landmark[]) => setLandmarks(lms),
    }), []);

    if (landmarks.length === 0 || width === 0) return null;

    // El bitmap ya llega rotado 270° desde Kotlin (portrait nativo), por lo que
    // MediaPipe devuelve coordenadas en portrait y ya NO hay que intercambiar x↔y.
    // Solo se aplica el espejo selfie en X de la cámara frontal.
    const sx = (lm: Landmark) => (1 - lm.x) * width;        // espejo selfie en X
    const sy = (lm: Landmark) => lm.y * height;             // y directo (portrait)

    return (
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        {/* Líneas del esqueleto */}
        {CONNECTIONS.map(([a, b]) => {
          const lA = landmarks[a];
          const lB = landmarks[b];
          if (!lA || !lB || lA.visibility < MIN_VISIBILITY || lB.visibility < MIN_VISIBILITY) {
            return null;
          }
          return (
            <Line
              key={`l-${a}-${b}`}
              x1={sx(lA)} y1={sy(lA)}
              x2={sx(lB)} y2={sy(lB)}
              stroke="#00E5FF"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* Puntos de cada articulación (solo los índices relevantes) */}
        {DRAW_LANDMARK_INDICES.map((i) => {
          const lm = landmarks[i];
          if (!lm || lm.visibility < MIN_VISIBILITY) return null;
          return (
            <Circle
              key={`p-${i}`}
              cx={sx(lm)}
              cy={sy(lm)}
              r={5}
              fill="#76FF03"
              stroke="#fff"
              strokeWidth={1}
            />
          );
        })}
      </Svg>
    );
    },
  ),
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
// La pantalla pide cámara, corre el frame processor con el validador del
// ejercicio activo y muestra reps + feedback. El flujo completo de la rutina
// (series, descanso, avance automático, pausa, salida) está planificado en
// improvements.md (HC-01, HC-02, EX-10..12, BT-01, BT-02).
export default function ActiveExerciseScreen() {
  const router = useRouter();

  // sessionId y seIds vienen de PreviousSurveyScreen (POST /api/sessions) vía
  // InstructionScreen. Sin sessionId el ejercicio corre pero no persiste.
  const { index, sessionId, seIds } = useLocalSearchParams();
  const exercise = EXERCISES[Number(index ?? 0)];

  // seIds = ids reales de session_exercises (CSV, ordenados por order_index)
  // creados en POST /api/sessions. Resolvemos el del ejercicio actual por índice
  // (EXERCISES y session_exercises comparten el mismo orden order_index).
  const sessionExerciseId =
    typeof seIds === 'string' && seIds.length > 0
      ? seIds.split(',')[Number(index ?? 0)]
      : undefined;

  const [fontsLoaded] = useFonts({
    PromptRegular: require('../../assets/fonts/Prompt-Regular.ttf'),
    PromptBold:    require('../../assets/fonts/Prompt-SemiBold.ttf'),
  });

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  // Fijamos el formato más cercano a 640×480: MediaPipe reescala a 256×256 igual,
  // así que convertir frames 1080p sería trabajo desperdiciado en el frame processor.
  const format = useCameraFormat(device, [
    { videoResolution: { width: 640, height: 480 } },
  ]);

  const [cameraSize, setCameraSize] = useState({ width: 0, height: 0 });
  const [poseFeedback, setPoseFeedback] = useState<string | null>(null);
  const [poseFeedbackOk, setPoseFeedbackOk] = useState<boolean>(true);
  const [localReps, setLocalReps]   = useState(0);

  const [progressError, setProgressError]   = useState<string | null>(null);

  // Los landmarks NO viven en el estado del root: se envían directo al esqueleto
  // por ref para que un frame nuevo no re-renderice ActiveExerciseScreen.
  const skeletonRef = useRef<PoseSkeletonHandle>(null);

  // Acumulador autoritativo de reps detectadas: useRef para no disparar render
  // por frame; useState arriba sólo refleja el valor para el badge.
  const localRepsRef = useRef(0);

  // session_id (de los params) y series ya persistidas: en refs para que el
  // callback del frame processor lea siempre el valor vigente sin re-suscribirse.
  const sessionIdRef        = useRef<string | null>(
    typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null,
  );
  const seriesCompletedRef  = useRef(0);

  // Reset de reps locales al cambiar de ejercicio
  useEffect(() => {
    localRepsRef.current = 0;
    setLocalReps(0);
  }, [exercise.exerciseId]);

  // ── Persistir progreso al cerrar una serie (PUT) ────────────────────────────
  const persistProgress = useCallback(
    async (seriesCompleted: number, repsCompleted: number) => {
      const sid = sessionIdRef.current;
      if (!sid || !sessionExerciseId) return;
      try {
        setProgressError(null);
        await updateExerciseProgress(sid, sessionExerciseId, {
          series_completed: seriesCompleted,
          reps_completed: repsCompleted,
        });
      } catch (e: any) {
        setProgressError(e?.message ?? 'No se pudo guardar el progreso');
      }
    },
    [sessionExerciseId],
  );

  const validator = useExerciseValidator(exercise.exerciseId, 1);

  // ── Frame counter (worklet-safe shared value para throttle) ────────────────
  const frameCount = useSharedValue(0);

  // ── Callback JS: actualiza state y deriva feedback ────────────────────────
  const onLandmarksDetected = useCallback((lms: Landmark[]) => {
    skeletonRef.current?.update(lms);

    if (lms.length === 0) {
      setPoseFeedback('No se detecta el cuerpo');
      setPoseFeedbackOk(false);
      return;
    }

    const result = validator.evaluate(lms);
    setPoseFeedback(result.feedback);
    setPoseFeedbackOk(result.ok);

    if (result.repCompleted) {
      localRepsRef.current += 1;
      setLocalReps(localRepsRef.current);

      // ¿Se cerró una serie? Cada REP_GOAL reps cuenta como una serie completada
      // → persistir el progreso acumulado al backend.
      const seriesNow = Math.floor(localRepsRef.current / REP_GOAL);
      if (seriesNow > seriesCompletedRef.current) {
        seriesCompletedRef.current = seriesNow;
        void persistProgress(seriesNow, localRepsRef.current);
      }
    }
  }, [validator, persistProgress]);

  // Bridge worklet → JS (estable entre renders gracias a useMemo)
  const onLandmarksJS = useMemo(
    () => Worklets.createRunOnJS(onLandmarksDetected),
    [onLandmarksDetected],
  );

  // ── Frame processor ────────────────────────────────────────────────────────
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    // Throttle: solo procesa 1 de cada FRAME_INTERVAL frames
    frameCount.value += 1;
    if (frameCount.value % FRAME_INTERVAL !== 0) return;

    if (posePlugin == null) return;
    const result = posePlugin.call(frame) as unknown as Landmark[] | null;
    onLandmarksJS(result ?? []);
  }, [onLandmarksJS]);

  const onCameraLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCameraSize({ width, height });
  }, []);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (!fontsLoaded) return null;

  if (!hasPermission) {
    return (
      <LinearGradient colors={['#DEEDE6', '#90C0C1']} style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Necesitamos acceso a tu cámara para el ejercicio.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Otorgar Permiso</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (device == null) {
    return <View style={styles.container}><ActivityIndicator size="large" /></View>;
  }

  const activeFeedback = poseFeedback ?? null;

  return (
    <LinearGradient colors={['#DEEDE6', '#90C0C1']} style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={30} color="#DEEDE6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {exercise.exerciseName}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      {/* ── Cámara a pantalla completa con controles superpuestos ──────── */}
      <View style={styles.content} onLayout={onCameraLayout}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={true}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
          zoom={0.75}
          onLayout={onCameraLayout}
        />

        {/* Overlay SVG de esqueleto */}
        <PoseSkeleton
          ref={skeletonRef}
          width={cameraSize.width}
          height={cameraSize.height}
        />

        {/* ── Controles superpuestos en la parte inferior ─────────────── */}
        <View style={styles.controlsOverlay}>
          {/* Aviso no bloqueante si falló el guardado de progreso */}
          {progressError && (
            <View style={[styles.feedbackBadge, { backgroundColor: '#E75756' }]}>
              <Ionicons name="cloud-offline-outline" size={26} color="#DEEDE6" style={{ marginRight: 10 }} />
              <Text style={styles.feedbackText}>{progressError}</Text>
            </View>
          )}

          {/* Badge de feedback */}
          {activeFeedback && (
            <View style={[
              styles.feedbackBadge,
              { backgroundColor: poseFeedbackOk ? '#27695A' : '#E75756' },
            ]}>
              <Ionicons
                name={poseFeedbackOk ? 'checkmark-circle-outline' : 'warning-outline'}
                size={26}
                color="#DEEDE6"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.feedbackText}>{activeFeedback}</Text>
            </View>
          )}

          <View style={styles.progressSection}>
            <Text style={styles.seriesText}>
              Serie {1} de {1}
            </Text>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${((0 + localReps) / 10) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.repsBadge}>
            <Text style={styles.repsNumbers}>
              {0 + localReps}/{10}
            </Text>
            <Text style={styles.repsLabel}>Repeticiones</Text>
          </View>

          <TouchableOpacity style={styles.pauseButton}>
            <Text style={styles.pauseButtonText}>Pausar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endButton}
            onPress={() => {
              const currentIndex = Number(index ?? 0);
              if (currentIndex < EXERCISES.length - 1) {
                // Propagar sessionId y seIds al siguiente ejercicio: sin esto el
                // PUT de progreso queda sin ids del 2do ejercicio en adelante.
                const sid = sessionIdRef.current ?? '';
                router.push(
                  `/instruction?index=${currentIndex + 1}&sessionId=${sid}&seIds=${seIds ?? ''}`
                );
              } else {
                // Pasamos el session_id para que la pantalla final pueda
                // llamar a POST /api/sessions/{id}/complete.
                router.push({
                  pathname: '/post-exercise-survey',
                  params: { sessionId: sessionIdRef.current ?? '' },
                });
              }
            }}
          >
            <Text style={styles.endButtonText}>Terminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:           { flex: 1 },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  permissionText: {
    fontSize: 22, textAlign: 'center', marginBottom: 24,
    fontFamily: 'PromptBold', color: '#27695A', lineHeight: 30,
  },
  button: { backgroundColor: '#7BB899', paddingVertical: 18, paddingHorizontal: 28, borderRadius: 16 },
  buttonText: { color: '#DEEDE6', fontFamily: 'PromptBold', fontSize: 22 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 54, paddingHorizontal: 20, paddingBottom: 18,
    backgroundColor: '#49A2A5', borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: {
    flex: 1, textAlign: 'center', color: '#DEEDE6', fontSize: 24, fontFamily: 'PromptBold',
  },
  content: { flex: 1, position: 'relative', backgroundColor: '#27695A' },
  controlsOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 30, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  feedbackBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
    width: '92%', justifyContent: 'center', marginBottom: 12,
  },
  feedbackText:   { color: '#DEEDE6', fontFamily: 'PromptBold', fontSize: 20, flexShrink: 1 },
  progressSection: { width: '100%', marginBottom: 16 },
  seriesText:      { fontSize: 20, color: '#DEEDE6', fontFamily: 'PromptBold', marginBottom: 8 },
  progressBarBackground: { height: 14, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 8, overflow: 'hidden' },
  progressBarFill:       { height: '100%', backgroundColor: '#7BB899', borderRadius: 8 },
  repsBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 2, borderColor: '#DEEDE6',
    borderRadius: 30, paddingVertical: 12, paddingHorizontal: 28, marginBottom: 18,
  },
  repsNumbers:    { fontSize: 36, fontFamily: 'PromptBold', color: '#DEEDE6', marginRight: 12 },
  repsLabel:      { fontSize: 22, color: '#DEEDE6', fontFamily: 'PromptBold' },
  pauseButton: {
    width: '85%', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 2, borderColor: '#DEEDE6',
    paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12,
  },
  pauseButtonText: { color: '#DEEDE6', fontSize: 24, fontFamily: 'PromptBold' },
  endButton:       { width: '85%', backgroundColor: '#E75756', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  endButtonText:   { color: '#DEEDE6', fontSize: 24, fontFamily: 'PromptBold' },
});
