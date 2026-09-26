// screens/LoginScreen.tsx — login por correo o RUT (R-05), inputs grandes,
// mensajes humanos (UX-14). La sesión persiste (secure store) y el root layout
// redirige solo; acá solo mostramos el motivo si volvimos por expiración.
import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Field, InlineError } from "../components/ui";
import { Colors, Fonts, FontSize } from "../constants/theme";
import { HOME_BY_ROLE } from "../router/routes";
import { loginApi } from "../services/authService";
import { refreshTermsStatus } from "../services/privacyService";
import { ApiError } from "../services/apiClient";
import { getErrorMessage } from "../utils/errors";
import { formatRut, looksLikeRut } from "../utils/rut";

const REASON_MESSAGE: Record<string, string> = {
  expired: "Tu sesión expiró. Vuelve a ingresar para continuar.",
  forbidden: "Tu cuenta fue desactivada. Contacta a tu especialista o a un administrador.",
};

export default function LoginScreen() {
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(reason ? (REASON_MESSAGE[reason] ?? null) : null);

  const handleIdentifierChange = (text: string) => {
    // Si parece RUT lo formateamos mientras escribe; si no, minúsculas (email).
    setIdentifier(looksLikeRut(text) && !text.includes("@") ? formatRut(text) : text.toLowerCase());
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setError("Escribe tu correo o RUT y tu contraseña.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { role } = await loginApi(identifier, password);
      // Primer ingreso (o términos nuevos): antes de su inicio, la pantalla de términos.
      const accepted = await refreshTermsStatus().catch(() => true);
      router.replace(accepted ? HOME_BY_ROLE[role] : "/terms");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("El usuario o la contraseña no son correctos. Si olvidaste tu contraseña, pide ayuda a tu especialista.");
      } else {
        setError(getErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Banner title="Iniciar sesión" subtitle="Ingresa con tu correo o tu RUT" big />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Image source={require("../assets/logo.png")} style={styles.logo} accessibilityLabel="Logo ActivaMente" />
          <Text style={styles.appName}>ActivaMente</Text>

          <Card>
            <Field
              label="Correo o RUT"
              big
              icon="account-outline"
              value={identifier}
              onChangeText={handleIdentifierChange}
              placeholder="correo@ejemplo.cl o 12.345.678-9"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!loading}
              testID="login-identifier"
            />
            <Field
              label="Contraseña"
              big
              icon="lock-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              testID="login-password"
              right={
                <TouchableOpacity
                  onPress={() => setShowPassword((p) => !p)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={26} color={Colors.btnTeal} />
                </TouchableOpacity>
              }
            />
            <InlineError message={error} />
            <Button title="Ingresar" size="patient" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} testID="login-submit" />
          </Card>

          <View style={styles.help}>
            <MaterialCommunityIcons name="information-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.helpText}>¿Olvidaste tu contraseña? Pídele una nueva a tu especialista o al administrador.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 24 },
  logo: { width: 120, height: 120, alignSelf: "center", resizeMode: "contain" },
  appName: { fontSize: FontSize.title, fontFamily: Fonts.bold, color: Colors.textPrimary, textAlign: "center", marginTop: 8, marginBottom: 20 },
  help: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingHorizontal: 8, marginTop: 8 },
  helpText: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22 },
});
