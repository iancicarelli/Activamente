import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import SurveySlider from "../../components/SurveySlider";
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createSession } from "../../services/sessionService";
import { submitPreSurvey } from "../../services/surveyService";
import { getSession } from "../../services/authStore";

export default function PreviousSurveyScreen() {
  const router = useRouter();
  // routineId llega como query param desde PatientHome; patientId del paciente
  // logueado en el authStore.
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const patientId = getSession()?.patient?.id;

  const [effort, setEffort] = useState(4);
  const [tiredness, setTiredness] = useState(4);
  const [stress, setStress] = useState(4);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  const handleSubmit = async () => {
    if (!patientId || !routineId) {
      console.error("Falta patientId o routineId para crear la sesion");
      return;
    }
    setLoading(true);
    try {
      // 1. Create session first
      const session = await createSession(patientId, routineId);
      
      // 2. Submit pre survey
      await submitPreSurvey({
        session_id: session.id,
        pain_level: effort,
        fatigue_level: tiredness,
        comments: comments || undefined,
      });

      // 3. Navigate to instructions with the sessionId + los ids reales de los
      //    session_exercises (ordenados por order_index). Viajan como CSV por la
      //    cadena instruction → active-exercise, que resuelve seIds[index].
      const seIds = session.session_exercises.map((se) => se.id).join(",");
      router.push(`/instruction?sessionId=${session.id}&index=0&seIds=${seIds}`);
    } catch (e) {
      console.error(e);
      // Fallback navigation even if it fails (optional)
      router.push(`/instruction?index=0`);
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={32} color="#27695A" />
          </TouchableOpacity>

          <View style={styles.title}>
            <Image
              style={styles.logo}
              source={require("../../assets/images/logoActivaMente.png")}
              resizeMode="contain"
            />
            <Text style={styles.name}>¿Cómo te sientes?</Text>
            <Text style={styles.subtitle}>
              Antes de empezar, cuentanos como estas hoy
            </Text>
          </View>

          <View style={styles.slider}>
            <SurveySlider label="Nivel de esfuerzo" value={effort} onChange={setEffort} />
            <SurveySlider label="Nivel de cansancio" value={tiredness} onChange={setTiredness} />
            <SurveySlider label="Nivel de estrés" value={stress} onChange={setStress} />

            <View style={{ marginTop: 24 }}>
              <Text style={styles.label}>Otros (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Escribe aquí cómo te sientes..."
                placeholderTextColor="rgba(39, 105, 90, 0.5)"
                multiline
                value={comments}
                onChangeText={setComments}
              />
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#DEEDE6" size="large" />
            ) : (
              <Text style={styles.buttonText}>Continuar</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  title: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 20,
  },
  name: {
    fontSize: 30,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'PromptRegular',
    color: '#27695A',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 26,
  },
  slider: {
    flex: 1,
    padding: 20,
    backgroundColor: "transparent",
  },
  logo: {
    width: 120,
    height: 120,
    marginTop: 40,
    borderRadius: 100,
  },
  label: {
    fontSize: 22,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#49A2A5",
    borderRadius: 14,
    backgroundColor: "#EAF4F0",
    minHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: "left",
    textAlignVertical: "top",
    fontFamily: "PromptRegular",
    fontSize: 18,
    color: "#27695A",
  },
  button: {
    backgroundColor: "#7BB899",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    borderRadius: 20,
    marginHorizontal: 25,
    marginBottom: 20,
    alignSelf: "stretch",
  },
  buttonText: {
    color: "#DEEDE6",
    fontFamily: "PromptBold",
    fontSize: 28,
  },
  backBtn: {
    marginTop: 50,
    marginLeft: 16,
    alignSelf: "flex-start",
    padding: 8,
  },
});
