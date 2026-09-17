// screens/patient/ActiveExerciseScreen.tsx — ejercicio activo con cámara.
//
// Usa la rutina REAL (HC-01/HC-02): nivel, series, reps y descanso vienen de
// useSessionPlan; el flujo (countdown → activo → descanso → siguiente serie →
// fin del ejercicio) lo lleva useExerciseSession (EX-10). Además:
//   - encuadre guiado antes de empezar (EX-51: no arranca hasta que se ven los
//     puntos que usa el ejercicio; avisos "aléjate…" según nariz/tobillos), el
//     preview no queda tapado por los paneles y el esqueleto respeta el recorte
//     de la cámara,
//   - cuenta regresiva 3-2-1, contador enorme, voz
//     (expo-speech) y vibración (expo-haptics) por rep (UX-12),
//   - feedback estable ≥ 1.5 s (EX-33), pausa real (BT-01), descanso con
//     "Saltar", salida con confirmación (BT-02), pantalla siempre encendida,
//   - persistencia por serie y al salir con reintento (EX-11), accuracy y
//     feedback por rep (EX-35 / EP-15),
//   - HUD de rendimiento (encendido por defecto), log automático de cada
//     ejercicio (validation/exerciseLog.ts) y grabador de fixtures, solo en
//     __DEV__ (EX-03 / EX-34).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission, useFrameProcessor, VisionCameraProxy } from "react-native-vision-camera";
import { Worklets, useSharedValue } from "react-native-worklets-core";
import { Screen, Banner, Button, LoadingView, ErrorView, confirm } from "../../components/ui";
import { PoseSkeleton, PoseSkeletonHandle } from "../../components/PoseSkeleton";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { ExercisePlan, useExerciseSession, SessionState } from "../../hooks/useExerciseSession";
import { buildExercisePlan, useSessionPlan } from "../../hooks/useSessionPlan";
import { useStableFeedback } from "../../hooks/useStableFeedback";
import { updateExerciseProgress } from "../../services/sessionService";
import { useExerciseValidator } from "../../validation/useExerciseValidator";
import { RepQualityTracker } from "../../validation/quality";
import { assessFraming, framingIndicesFor, viewFor, FramingStatus } from "../../validation/framing";
import { isBetaExercise } from "../../validation/validators/exerciseRegistry";
import { ExerciseLogger, parsePluginResult } from "../../validation/exerciseLog";

const FRAME_INTERVAL = 3; // procesa 1 de cada 3 frames
const FRAMING_HOLD_MS = 1200; // encuadre correcto sostenido antes de arrancar
const FRAMING_SKIP_AFTER_MS = 12000; // pasado esto se ofrece "Empezar igual"
const RETRY_DELAY_MS = 4000;
const MAX_RECORD_FRAMES = 1200;

const posePlugin = VisionCameraProxy.initFrameProcessorPlugin("detectPose", { model: "lite" });

const speak = (text: string) => {
  try {
    Speech.stop();
    Speech.speak(text, { language: "es-CL", rate: 1.0 });
  } catch {
    // sin TTS disponible
  }
};

const buzz = (kind: "rep" | "series" | "done") => {
  void Haptics.notificationAsync(
    kind === "rep" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
  ).catch(() => {});
};

// ─── Wrapper: carga el plan y monta la pantalla real ─────────────────────────

export default function ActiveExerciseScreen() {
  const router = useRouter();
  const { sessionId, index } = useLocalSearchParams<{ sessionId?: string; index?: string }>();
  const idx = Number(index ?? 0);
  const { plan, loading, error, reload } = useSessionPlan({ sessionId });
  const exercise = plan ? buildExercisePlan(plan, idx) : null;

  if (loading) {
    return (
      <Screen>
        <Banner title="Preparando ejercicio" big />
        <LoadingView label="Cargando tu rutina…" />
      </Screen>
    );
  }
  if (error || !exercise || !sessionId) {
    return (
      <Screen>
        <Banner title="Ejercicio" big showBack onBack={() => router.replace(routes.patientHome)} />
        <ErrorView message={error ?? "No se encontró el ejercicio de esta sesión."} onRetry={reload} big />
      </Screen>
    );
  }
  return <ActiveExercise exercise={exercise} sessionId={sessionId} />;
}

// ─── Pantalla real ───────────────────────────────────────────────────────────

type HudStats = { fps: number; jsMs: number; convMs: number; detMs: number; phase: string; metrics: Record<string, number>; logFrames: number };
const EMPTY_HUD: HudStats = { fps: 0, jsMs: 0, convMs: 0, detMs: 0, phase: "", metrics: {}, logFrames: 0 };

function ActiveExercise({ exercise, sessionId }: { exercise: ExercisePlan; sessionId: string }) {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");
  const format = useCameraFormat(device, [{ videoResolution: { width: 640, height: 480 } }]);

  const [cameraSize, setCameraSize] = useState({ width: 0, height: 0 });
  const [panels, setPanels] = useState({ top: 0, bottom: 0 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [framing, setFraming] = useState<FramingStatus>({ ok: false, message: "Buscando tu cuerpo…", hint: null });
  const [framed, setFramed] = useState(false);
  const [canSkipFraming, setCanSkipFraming] = useState(false);
  const framingOkSince = useRef<number | null>(null);
  const framingIndices = useMemo(() => framingIndicesFor(exercise.exerciseId), [exercise.exerciseId]);
  const frameAspect = format ? Math.min(format.videoWidth, format.videoHeight) / Math.max(format.videoWidth, format.videoHeight) : 0.75;
  const [hud, setHud] = useState<HudStats | null>(__DEV__ ? EMPTY_HUD : null);
  const [recording, setRecording] = useState(false);

  const skeletonRef = useRef<PoseSkeletonHandle>(null);
  const quality = useRef(new RepQualityTracker()).current;
  const { feedback, push: pushFeedback, reset: resetFeedback } = useStableFeedback();

  // Log automático del ejercicio (solo dev): un archivo por ejercicio, se escribe
  // al cerrar cada serie, al terminar y al salir.
  const logger = useRef<ExerciseLogger | null>(null);
  if (__DEV__ && logger.current === null) {
    logger.current = new ExerciseLogger({
      exerciseId: exercise.exerciseId,
      level: exercise.level,
      totalSeries: exercise.totalSeries,
      totalReps: exercise.totalReps,
      sessionId,
    });
  }

  // ── Persistencia con reintento (EX-11) ──
  const pendingRef = useRef<{ series: number; reps: number; final: boolean } | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (series: number, reps: number, final = false): Promise<boolean> => {
      if (!exercise.sessionExerciseId) return true;
      pendingRef.current = { series, reps, final };
      const summary = quality.summary();
      try {
        await updateExerciseProgress(sessionId, exercise.sessionExerciseId, {
          series_completed: series,
          reps_completed: reps,
          accuracy_score: final ? summary.accuracy : undefined,
          feedback: final ? summary.feedback : undefined,
        });
        pendingRef.current = null;
        setSaveError(null);
        return true;
      } catch {
        setSaveError("No se pudo guardar el progreso. Reintentando…");
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => {
          const p = pendingRef.current;
          if (p) void persist(p.series, p.reps, p.final);
        }, RETRY_DELAY_MS);
        return false;
      }
    },
    [exercise.sessionExerciseId, sessionId, quality]
  );

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    Speech.stop();
    logger.current?.flush("unmount");
  }, []);

  // ── Navegación al terminar ──
  const navigatingRef = useRef(false);
  const goNext = useCallback(async (state: SessionState) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    speak("¡Muy bien! Ejercicio terminado");
    buzz("done");
    logger.current?.event("exerciseDone", { series: state.seriesCompleted, reps: state.totalRepsDone });
    logger.current?.flush("exerciseDone");
    await persist(state.seriesCompleted, state.totalRepsDone, true);
    if (exercise.exerciseIdx + 1 < exercise.totalExercises) {
      router.replace({ pathname: routes.instruction, params: { sessionId, index: String(exercise.exerciseIdx + 1) } });
    } else {
      router.replace({ pathname: routes.surveyPost, params: { sessionId } });
    }
  }, [exercise.exerciseIdx, exercise.totalExercises, persist, router, sessionId]);

  const session = useExerciseSession(exercise, {
    onSeriesDone: (series, reps) => {
      logger.current?.event("seriesDone", { series, reps });
      logger.current?.flush("seriesDone");
      void persist(series, reps);
    },
    onExerciseDone: (state) => {
      void goNext(state);
    },
  });
  const { state } = session;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Validador: se resetea entero al empezar cada serie (EX-06).
  const validator = useExerciseValidator(exercise.exerciseId, exercise.level, `${exercise.exerciseIdx}-${state.series}`);

  // Arranque automático cuando hay permiso y el encuadre está bien (o se saltó).
  useEffect(() => {
    if (hasPermission && state.phase === "idle" && framed) session.start();
  }, [hasPermission, state.phase, framed, session]);

  useEffect(() => {
    if (state.phase !== "idle") return;
    const t = setTimeout(() => setCanSkipFraming(true), FRAMING_SKIP_AFTER_MS);
    return () => clearTimeout(t);
  }, [state.phase]);

  // Voz por fase.
  const lastSpoken = useRef<string>("");
  useEffect(() => {
    const key = `${state.phase}-${state.countdown}-${state.series}-${state.restRemaining}`;
    if (key === lastSpoken.current) return;
    lastSpoken.current = key;
    if (state.phase === "countdown") speak(state.countdown > 0 ? String(state.countdown) : "¡Ahora!");
    else if (state.phase === "active" && state.reps === 0) speak("¡Ahora!");
    else if (state.phase === "rest" && state.restRemaining === exercise.restSeconds) {
      speak(`¡Muy bien! Descansa ${exercise.restSeconds} segundos`);
      buzz("series");
    } else if (state.phase === "rest" && state.restRemaining === 3) speak("Prepárate");
  }, [state.phase, state.countdown, state.series, state.restRemaining, state.reps, exercise.restSeconds]);

  useEffect(() => {
    if (state.phase !== "active") resetFeedback();
    logger.current?.event("sessionPhase", { phase: state.phase, series: state.series, reps: state.reps });
  }, [state.phase, state.series, resetFeedback, state.reps]);

  // ── HUD / grabador (solo dev) ──
  const hudRef = useRef({ frames: 0, jsMs: 0, convMs: 0, detMs: 0, windowStart: Date.now(), phase: "", metrics: {} as Record<string, number> });
  const recordRef = useRef<{ t: number; lms: number[][] }[]>([]);
  const recordingRef = useRef(false);

  const toggleRecording = useCallback(async () => {
    if (!__DEV__) return;
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
      const payload = { exerciseId: exercise.exerciseId, level: exercise.level, fps: hud?.fps ?? null, frames: recordRef.current };
      recordRef.current = [];
      try {
        await Share.share({ title: `fixture-${exercise.exerciseId}.json`, message: JSON.stringify(payload) });
      } catch {
        // cancelado
      }
    } else {
      recordRef.current = [];
      recordingRef.current = true;
      setRecording(true);
    }
  }, [exercise.exerciseId, exercise.level, hud?.fps]);

  // ── Callback JS por frame ──
  const onLandmarksDetected = useCallback(
    (raw: unknown) => {
      const { lms, native } = parsePluginResult(raw);
      skeletonRef.current?.update(lms);
      const s = stateRef.current;

      if (recordingRef.current && recordRef.current.length < MAX_RECORD_FRAMES) {
        recordRef.current.push({ t: Date.now(), lms: lms.map((l) => [+l.x.toFixed(3), +l.y.toFixed(3), +l.z.toFixed(3), +l.visibility.toFixed(2)]) });
      }

      if (s.phase === "idle") {
        const status = assessFraming(lms, framingIndices);
        setFraming((prev) => (prev.ok === status.ok && prev.message === status.message && prev.hint === status.hint ? prev : status));
        const now = Date.now();
        if (!status.ok) framingOkSince.current = null;
        else if (framingOkSince.current === null) framingOkSince.current = now;
        else if (now - framingOkSince.current >= FRAMING_HOLD_MS) {
          logger.current?.event("framed", {});
          setFramed(true);
        }
        logger.current?.frame({ lms, native, sessionPhase: s.phase });
        return;
      }
      if (s.phase === "countdown") {
        logger.current?.frame({ lms, native, sessionPhase: s.phase });
        return;
      }
      if (s.phase !== "active") {
        logger.current?.frame({ lms, native, sessionPhase: s.phase });
        return;
      }

      const t0 = Date.now();
      const result = validator.evaluate(lms);
      const jsMs = Date.now() - t0;
      quality.frame(result);
      logger.current?.frame({ lms, native, sessionPhase: s.phase, jsMs, result });

      if (lms.length === 0) pushFeedback({ text: "No te vemos. Ponte frente a la cámara", ok: false });
      else pushFeedback({ text: result.feedback, ok: result.ok }, result.repCompleted);

      if (result.repCompleted) {
        const n = s.reps + 1;
        logger.current?.event("rep", { n, series: s.series });
        session.rep();
        speak(n >= exercise.totalReps ? `${n}. ¡Serie completa!` : String(n));
        buzz("rep");
      }

      if (__DEV__) {
        const h = hudRef.current;
        h.frames += 1;
        h.jsMs = h.jsMs * 0.8 + jsMs * 0.2;
        if (native) {
          h.convMs = h.convMs * 0.8 + native.convMs * 0.2;
          h.detMs = h.detMs * 0.8 + native.detMs * 0.2;
        }
        h.phase = result.phase;
        h.metrics = result.metrics ?? {};
        const now = Date.now();
        if (now - h.windowStart >= 1000) {
          const fps = h.frames / ((now - h.windowStart) / 1000);
          h.frames = 0;
          h.windowStart = now;
          setHud((prev) =>
            prev
              ? { fps: +fps.toFixed(1), jsMs: +h.jsMs.toFixed(1), convMs: +h.convMs.toFixed(0), detMs: +h.detMs.toFixed(0), phase: h.phase, metrics: h.metrics, logFrames: logger.current?.frameCount ?? 0 }
              : prev
          );
        }
      }
    },
    [validator, quality, pushFeedback, session, exercise.totalReps, framingIndices]
  );

  const onLandmarksJS = useMemo(() => Worklets.createRunOnJS(onLandmarksDetected), [onLandmarksDetected]);
  const frameCount = useSharedValue(0);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      frameCount.value += 1;
      if (frameCount.value % FRAME_INTERVAL !== 0) return;
      if (posePlugin == null) return;
      const result = posePlugin.call(frame);
      onLandmarksJS(result ?? []);
    },
    [onLandmarksJS]
  );

  const onCameraLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCameraSize({ width, height });
  }, []);

  // Leer la altura ANTES de entrar al actualizador de estado: React lo ejecuta
  // más tarde y para entonces `nativeEvent` del evento ya fue reciclado (null).
  const onTopLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    setPanels((p) => (p.top === height ? p : { ...p, top: height }));
  }, []);
  const onBottomLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    setPanels((p) => (p.bottom === height ? p : { ...p, bottom: height }));
  }, []);

  // ── Acciones ──
  const exit = async () => {
    const wasActive = state.phase === "active" || state.phase === "countdown" || state.phase === "rest";
    if (wasActive) session.pause();
    const ok = await confirm(
      "¿Salir del entrenamiento?",
      `Llevas ${state.seriesCompleted} ${state.seriesCompleted === 1 ? "serie" : "series"} y ${state.totalRepsDone} repeticiones. Se guardará ese avance, pero la sesión de hoy quedará incompleta.`,
      { confirmText: "Salir", destructive: true }
    );
    if (!ok) {
      if (wasActive) session.resume();
      return;
    }
    navigatingRef.current = true;
    logger.current?.event("exit", { series: state.seriesCompleted, reps: state.totalRepsDone });
    logger.current?.flush("exit");
    await persist(state.seriesCompleted, state.totalRepsDone, true);
    router.replace(routes.patientHome);
  };

  const finishExercise = async () => {
    const done = state.seriesCompleted >= exercise.totalSeries;
    if (!done) {
      const ok = await confirm("¿Saltar este ejercicio?", "Pasarás al siguiente sin completar todas las series.", { confirmText: "Saltar" });
      if (!ok) return;
    }
    session.finish();
  };

  // ── Render ──
  if (!hasPermission) {
    return (
      <Screen>
        <Banner title="Necesitamos la cámara" big showBack onBack={() => router.replace(routes.patientHome)} />
        <View style={styles.permission}>
          <MaterialCommunityIcons name="camera-outline" size={72} color={Colors.btnTeal} />
          <Text style={styles.permissionText}>Para contar tus repeticiones necesitamos ver tus movimientos con la cámara.</Text>
          <Button title="Permitir cámara" size="patient" onPress={requestPermission} />
        </View>
      </Screen>
    );
  }
  if (device == null) {
    return (
      <Screen>
        <LoadingView label="Buscando la cámara…" />
      </Screen>
    );
  }

  const cameraActive = state.phase === "idle" || state.phase === "countdown" || state.phase === "active";
  const beta = isBetaExercise(exercise.exerciseId);
  const view = viewFor(exercise.exerciseId);
  const progress = Math.min(1, state.reps / exercise.totalReps);

  return (
    <View style={styles.root}>
      {/* La cámara ocupa solo el hueco entre los paneles: así el paciente ve si sus pies salen. */}
      <View style={[styles.cameraWrap, { top: panels.top, bottom: panels.bottom }]} onLayout={onCameraLayout}>
        <Camera style={StyleSheet.absoluteFill} device={device} format={format} isActive={cameraActive} frameProcessor={frameProcessor} pixelFormat="yuv" />
        <PoseSkeleton ref={skeletonRef} width={cameraSize.width} height={cameraSize.height} frameAspect={frameAspect} />
      </View>

      {/* ── Top bar ── */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} onLayout={onTopLayout}>
        <TouchableOpacity style={styles.iconBtn} onPress={exit} accessibilityRole="button" accessibilityLabel="Salir del entrenamiento">
          <MaterialCommunityIcons name="close" size={30} color={Colors.textOnDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle} numberOfLines={1}>{exercise.name}{beta ? " · Beta" : ""}</Text>
          <Text style={styles.topSub}>
            Ejercicio {exercise.exerciseIdx + 1} de {exercise.totalExercises} · Serie {Math.min(state.series, exercise.totalSeries)} de {exercise.totalSeries}
          </Text>
        </View>
        {__DEV__ && (
          <TouchableOpacity style={[styles.iconBtn, recording && { backgroundColor: Colors.btnDanger }]} onPress={toggleRecording} accessibilityLabel="Grabar fixture">
            <MaterialCommunityIcons name={recording ? "stop" : "record"} size={26} color={Colors.textOnDark} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Encuadre (antes de empezar): overlay translúcido que NO tapa el preview ── */}
      {state.phase === "idle" && (
        <View style={[styles.framing, { top: panels.top, bottom: panels.bottom }]} pointerEvents="box-none">
          <View style={styles.framingTop}>
            <Text style={styles.framingTitle}>{view === "side" ? "Ponte de perfil al teléfono" : "Ponte de frente al teléfono"}</Text>
            <Text style={styles.framingSub}>{view === "side" ? "Que se vea tu cuerpo entero, de lado" : framingIndices.length > 9 ? "Que se vea tu cuerpo entero" : "Que se vean tus brazos y tu cadera"}</Text>
          </View>
          <View style={styles.framingBottom}>
            <View style={[styles.visibilityPill, { backgroundColor: framing.ok ? Colors.success : Colors.btnDanger }]} accessibilityLiveRegion="polite">
              <MaterialCommunityIcons name={framing.ok ? "check-circle" : "alert-circle"} size={26} color={Colors.textOnDark} />
              <Text style={styles.visibilityText}>{framing.message}</Text>
            </View>
            {framing.hint ? <Text style={styles.framingHint}>{framing.hint}</Text> : null}
            {canSkipFraming && !framing.ok ? (
              <Button title="Empezar igual" size="patient" variant="outline" onPress={() => setFramed(true)} style={{ marginTop: 10, minWidth: 240 }} testID="skip-framing" />
            ) : null}
          </View>
        </View>
      )}

      {/* ── Overlays de fase ── */}
      {state.phase === "countdown" && (
        <View style={styles.overlay}>
          <Text style={styles.countdown}>{state.countdown}</Text>
          <Text style={styles.overlayBody}>Prepárate</Text>
        </View>
      )}

      {state.phase === "rest" && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Descanso</Text>
          <Text style={styles.countdown}>{state.restRemaining}</Text>
          <Text style={styles.overlayBody}>Siguiente: serie {state.series} de {exercise.totalSeries}</Text>
          <Button title="Saltar descanso" size="patient" variant="outline" onPress={session.skipRest} style={{ marginTop: 20, minWidth: 260 }} />
        </View>
      )}

      {state.phase === "paused" && (
        <View style={styles.overlay}>
          <MaterialCommunityIcons name="pause-circle-outline" size={96} color={Colors.textOnDark} />
          <Text style={styles.overlayTitle}>En pausa</Text>
          <Text style={styles.overlayBody}>Tómate tu tiempo. Cuando quieras, continúa.</Text>
          <Button title="Continuar" size="patient" icon="play" onPress={session.resume} style={{ marginTop: 20, minWidth: 260 }} testID="resume" />
          <Button title="Salir" size="patient" variant="outline" onPress={exit} style={{ marginTop: 12, minWidth: 260 }} />
        </View>
      )}

      {state.phase === "exerciseDone" && (
        <View style={styles.overlay}>
          <MaterialCommunityIcons name="check-decagram" size={96} color={Colors.btnPrimary} />
          <Text style={styles.overlayTitle}>¡Ejercicio terminado!</Text>
          <Text style={styles.overlayBody}>Guardando tu progreso…</Text>
        </View>
      )}

      {/* ── Controles inferiores ── */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]} onLayout={onBottomLayout}>
        {saveError && (
          <View style={[styles.feedback, { backgroundColor: Colors.btnDanger }]}>
            <MaterialCommunityIcons name="cloud-off-outline" size={24} color={Colors.textOnDark} />
            <Text style={styles.feedbackText}>{saveError}</Text>
          </View>
        )}
        {state.phase === "active" && feedback.text ? (
          <View style={[styles.feedback, { backgroundColor: feedback.ok ? Colors.btnDark : Colors.btnDanger }]} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name={feedback.ok ? "check-circle-outline" : "alert-outline"} size={26} color={Colors.textOnDark} />
            <Text style={styles.feedbackText} numberOfLines={2}>{feedback.text}</Text>
          </View>
        ) : null}

        <TouchableOpacity onLongPress={() => __DEV__ && setHud((h) => (h ? null : EMPTY_HUD))} activeOpacity={1} accessibilityLabel={`${state.reps} de ${exercise.totalReps} repeticiones`}>
          <Text style={styles.counter}>
            {state.reps}
            <Text style={styles.counterTotal}> / {exercise.totalReps}</Text>
          </Text>
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.actions}>
          {state.phase === "active" || state.phase === "countdown" ? (
            <Button title="Pausar" size="patient" variant="outline" icon="pause" onPress={session.pause} style={{ flex: 1 }} testID="pause" />
          ) : null}
          <Button
            title={state.seriesCompleted >= exercise.totalSeries ? "Terminar" : "Saltar ejercicio"}
            size="patient"
            variant={state.seriesCompleted >= exercise.totalSeries ? "primary" : "danger"}
            onPress={finishExercise}
            style={{ flex: 1 }}
            disabled={state.phase === "exerciseDone"}
          />
        </View>
      </View>

      {__DEV__ && hud && (
        <View style={[styles.hud, { top: insets.top + 84 }]} pointerEvents="none">
          <Text style={styles.hudText}>det {hud.fps} fps · js {hud.jsMs} ms</Text>
          <Text style={styles.hudText}>nativo conv {hud.convMs} ms · det {hud.detMs} ms</Text>
          <Text style={styles.hudText}>fase {hud.phase} · nivel {exercise.level} · log {hud.logFrames} fr</Text>
          {Object.entries(hud.metrics).map(([k, v]) => (
            <Text key={k} style={styles.hudText}>{k}: {typeof v === "number" ? v.toFixed(1) : String(v)}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B2F27" },
  cameraWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  framing: { position: "absolute", left: 0, right: 0, justifyContent: "space-between", alignItems: "center" },
  framingTop: { alignItems: "center", paddingHorizontal: 20, paddingTop: 12, backgroundColor: "rgba(11,47,39,0.55)", width: "100%", paddingBottom: 12 },
  framingTitle: { fontSize: FontSize.title, fontFamily: Fonts.bold, color: Colors.textOnDark, textAlign: "center" },
  framingSub: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textOnDark, textAlign: "center", marginTop: 4 },
  framingBottom: { alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, width: "100%" },
  framingHint: { fontSize: FontSize.lg, fontFamily: Fonts.regular, color: Colors.textOnDark, textAlign: "center", marginTop: 6, backgroundColor: "rgba(11,47,39,0.55)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.35)" },
  iconBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: FontSize.xxl, fontFamily: Fonts.bold, color: Colors.textOnDark },
  topSub: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textOnDark },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,47,39,0.78)", padding: 24 },
  overlayTitle: { fontSize: FontSize.hero, fontFamily: Fonts.bold, color: Colors.textOnDark, textAlign: "center", marginTop: 8 },
  overlayBody: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textOnDark, textAlign: "center", marginTop: 8, lineHeight: 30 },
  countdown: { fontSize: 120, fontFamily: Fonts.bold, color: Colors.textOnDark, lineHeight: 130 },
  visibilityPill: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, marginTop: 12, maxWidth: "92%" },
  visibilityText: { fontSize: FontSize.patient.body, fontFamily: Fonts.bold, color: Colors.textOnDark, flexShrink: 1 },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  feedback: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, width: "100%", marginBottom: 10 },
  feedbackText: { color: Colors.textOnDark, fontFamily: Fonts.bold, fontSize: FontSize.patient.body, flexShrink: 1 },
  counter: { fontSize: FontSize.counter, fontFamily: Fonts.bold, color: Colors.textOnDark, lineHeight: 72 },
  counterTotal: { fontSize: FontSize.title, color: "rgba(222,237,230,0.8)" },
  progressTrack: { height: 14, width: "100%", backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8, overflow: "hidden", marginVertical: 12 },
  progressFill: { height: "100%", backgroundColor: Colors.btnPrimary, borderRadius: 8 },
  actions: { flexDirection: "row", gap: 12, width: "100%" },
  permission: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 20 },
  permissionText: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary, textAlign: "center", lineHeight: 30 },
  hud: { position: "absolute", left: 12, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 8 },
  hudText: { color: "#76FF03", fontSize: 12, fontFamily: "monospace" },
});
