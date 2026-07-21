import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { loginApi } from "../services/authService";
import type { UserRole } from "../services/authStore";

// Where each role lands after a successful login.
const HOME_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "/admin-main",
  SPECIALIST: "/specialist-home",
  PATIENT: "/patient-home",
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../assets/fonts/Prompt-SemiBold.ttf"),
  });

  // Email is always normalised to lowercase so logins are case-insensitive.
  const handleEmailChange = (text: string) => {
    setEmail(text.toLowerCase());
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert("Error", "Ingrese su correo y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const { role } = await loginApi(normalizedEmail, password);

      // Route by role. Use replace so "Atrás" no longer returns to login.
      const destination = HOME_BY_ROLE[role] ?? "/";
      router.replace(destination as any);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ocurrió un error inesperado";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Iniciar Sesión</Text>
        <Text style={styles.bannerSubtitle}>
          Ingrese sus credenciales para continuar.
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={require("../assets/logo.png")} style={styles.logo} />
          <Text style={styles.appName}>ActivaMente</Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Correo</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color="#49A2A5"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={handleEmailChange}
                placeholder="Ingrese su correo..."
                placeholderTextColor="#7BB899"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Contraseña</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color="#49A2A5"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.fieldInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Ingrese su contraseña..."
                placeholderTextColor="#7BB899"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#49A2A5"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#DEEDE6" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Iniciar Sesión</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    width: "100%",
    backgroundColor: "#49A2A5",
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },
  bannerSubtitle: {
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#DEEDE6",
    marginTop: 4,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 70,
  },
  logo: {
    width: "40%",
    height: "40%",
    aspectRatio: 1,
    alignSelf: "center",
    resizeMode: "contain",
    padding: 0,
    margin: 0,
  },
  appName: {
    fontSize: 28,
    fontFamily: "PromptBold",
    color: "#27695A",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#DEEDE6",
    borderRadius: 16,
    padding: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#49A2A5",
    borderRadius: 10,
    backgroundColor: "#EAF4F0",
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
  submitBtn: {
    backgroundColor: "#7BB899",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },
});
