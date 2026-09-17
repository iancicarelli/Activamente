// screens/patient/PostExerciseSurveyScreen.tsx — encuesta final (ánimo + dolor
// opcional) con 5 opciones grandes y UN solo botón que guarda la encuesta y
// completa la sesión una única vez (BT-04 / EP-08). Reintento explícito.
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Banner, Button, InlineError } from "../../components/ui";
import { MOOD_SCALE, NEGATIVE_SCALE, ScaleOptions } from "../../components/ScaleOptions";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { completeSession } from "../../services/sessionService";
import { submitPostSurvey } from "../../services/surveyService";
import { getErrorMessage } from "../../utils/errors";

export default function PostExerciseSurveyScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<number | null>(null);
  const [pain, setPain] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    if (!sessionId || mood == null) return;
    setLoading(true);
    setError(null);
    try {
      await submitPostSurvey({ session_id: sessionId, mood_level: mood, pain_level: pain ?? undefined });
      await completeSession(sessionId);
      router.replace({ pathname: routes.sessionCompleted, params: { sessionId } });
    } catch (e) {
      setError(getErrorMessage(e, "No pudimos guardar la sesión. Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Banner title="¡Terminaste!" subtitle={`Pregunta ${step + 1} de 2`} big />
      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 0 ? (
          <>
            <Text style={styles.question}>¿Cómo te sientes después del ejercicio?</Text>
            <ScaleOptions options={MOOD_SCALE} value={mood} onChange={setMood} />
            <Button title="Siguiente" size="patient" icon="arrow-right" onPress={() => setStep(1)} disabled={mood == null} style={styles.cta} testID="post-next" />
          </>
        ) : (
          <>
            <Text style={styles.question}>¿Sientes dolor ahora?</Text>
            <ScaleOptions options={NEGATIVE_SCALE("dolor")} value={pain} onChange={setPain} />
            <InlineError message={error} />
            <Button title={error ? "Reintentar" : "Terminar"} size="patient" icon="check" onPress={finish} loading={loading} disabled={pain == null} style={styles.cta} testID="post-submit" />
            <Button title="Volver" size="patient" variant="ghost" onPress={() => setStep(0)} style={{ marginTop: 8 }} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  question: { fontSize: FontSize.patient.title, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: "center", marginBottom: 20, lineHeight: 36 },
  cta: { marginTop: 24 },
});
