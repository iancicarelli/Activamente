// screens/patient/PreviousSurveyScreen.tsx — encuesta previa: una pregunta por
// paso con 5 opciones grandes (UX-13). Crea la sesión y guarda la encuesta; si
// falla muestra el error y permite reintentar SIN navegar (BT-03).
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Banner, Button, InlineError } from "../../components/ui";
import { NEGATIVE_SCALE, ScaleOptions } from "../../components/ScaleOptions";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { createSession } from "../../services/sessionService";
import { submitPreSurvey } from "../../services/surveyService";
import { getErrorMessage } from "../../utils/errors";

const QUESTIONS = [
  { key: "pain", title: "¿Tienes dolor hoy?", options: NEGATIVE_SCALE("dolor") },
  { key: "fatigue", title: "¿Qué tan cansado te sientes?", options: NEGATIVE_SCALE("cansancio") },
  { key: "stress", title: "¿Qué tan estresado te sientes?", options: NEGATIVE_SCALE("estrés") },
] as const;

type Key = (typeof QUESTIONS)[number]["key"];

export default function PreviousSurveyScreen() {
  const router = useRouter();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<Key, number | null>>({ pain: null, fatigue: null, stress: null });
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si la sesión ya se creó y falló la encuesta, reintentamos solo la encuesta.
  const [sessionId, setSessionId] = useState<string | null>(null);

  const isLast = step === QUESTIONS.length; // paso final = comentarios
  const current = QUESTIONS[step];

  const handleNext = () => {
    if (!isLast && answers[current.key] == null) return;
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!routineId) {
      setError("No se encontró la rutina. Vuelve al inicio e inténtalo de nuevo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sid = sessionId ?? (await createSession(routineId)).id;
      setSessionId(sid);
      await submitPreSurvey({
        session_id: sid,
        pain_level: answers.pain ?? 3,
        fatigue_level: answers.fatigue ?? 3,
        stress_level: answers.stress ?? undefined,
        comments: comments.trim() || undefined,
      });
      router.replace({ pathname: routes.instruction, params: { sessionId: sid, index: "0" } });
    } catch (e) {
      setError(getErrorMessage(e, "No pudimos guardar tus respuestas. Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Banner title="¿Cómo te sientes?" subtitle={`Pregunta ${Math.min(step + 1, QUESTIONS.length + 1)} de ${QUESTIONS.length + 1}`} big showBack onBack={() => (step > 0 ? setStep((s) => s - 1) : router.back())} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!isLast ? (
            <>
              <Text style={styles.question}>{current.title}</Text>
              <ScaleOptions options={current.options} value={answers[current.key]} onChange={(v) => setAnswers((a) => ({ ...a, [current.key]: v }))} />
              <Button title="Siguiente" size="patient" icon="arrow-right" onPress={handleNext} disabled={answers[current.key] == null} style={styles.cta} testID="survey-next" />
            </>
          ) : (
            <>
              <Text style={styles.question}>¿Quieres contarnos algo más?</Text>
              <Text style={styles.hint}>Es opcional. Puedes dejarlo en blanco.</Text>
              <TextInput
                style={styles.input}
                placeholder="Escribe aquí cómo te sientes..."
                placeholderTextColor={Colors.textMuted}
                multiline
                value={comments}
                onChangeText={setComments}
                accessibilityLabel="Comentarios opcionales"
              />
              <InlineError message={error} />
              <Button title={error ? "Reintentar" : "Comenzar"} size="patient" icon="play" onPress={handleSubmit} loading={loading} style={styles.cta} testID="survey-submit" />
              <View style={{ height: 24 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  question: { fontSize: FontSize.patient.title, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: "center", marginBottom: 20, lineHeight: 36 },
  hint: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: "center", marginBottom: 14 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.cardBgAlt,
    minHeight: 140,
    padding: 16,
    textAlignVertical: "top",
    fontFamily: Fonts.regular,
    fontSize: FontSize.patient.body,
    color: Colors.textPrimary,
  },
  cta: { marginTop: 24 },
});
