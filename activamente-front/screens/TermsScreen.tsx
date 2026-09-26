// screens/TermsScreen.tsx — términos de uso y privacidad (Ley 21.719). Dos modos:
//   * pendiente: primer ingreso o versión nueva. El root layout no deja salir de aquí hasta
//     aceptar; "No acepto" cierra la sesión.
//   * ya aceptados: se abre desde el perfil para releerlos; solo "Volver".
// El texto viene del backend (GET /api/me/terms), así la versión que se lee es la que se registra.
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen, Banner, Card, Button, LoadingView, ErrorView, confirm, useToast } from "../components/ui";
import { Colors, Fonts, FontSize } from "../constants/theme";
import { HOME_BY_ROLE } from "../router/routes";
import { logout } from "../services/authService";
import { getSession } from "../services/authStore";
import { acceptTerms, getMyTerms, TermsStatus } from "../services/privacyService";
import { ApiError } from "../services/apiClient";
import { formatLongDate, toDateString } from "../utils/dates";
import { getErrorMessage } from "../utils/errors";

export default function TermsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [terms, setTerms] = useState<TermsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTerms(await getMyTerms());
      setChecked(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const goHome = () => {
    const session = getSession();
    if (session) router.replace(HOME_BY_ROLE[session.role]);
  };

  const accept = async () => {
    if (!terms) return;
    setSaving(true);
    try {
      await acceptTerms(terms.version);
      goHome();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast(e.message, "error");
        await load();
      } else {
        toast(getErrorMessage(e), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const decline = async () => {
    const ok = await confirm(
      "¿No aceptas los términos?",
      "Sin aceptarlos no puedes usar ActivaMente. Se cerrará tu sesión. Si tienes dudas, habla con tu especialista.",
      { confirmText: "Cerrar sesión", destructive: true }
    );
    if (ok) logout();
  };

  const alreadyAccepted = terms?.accepted === true;

  return (
    <Screen>
      <Banner
        title="Términos de uso y privacidad"
        subtitle={alreadyAccepted && terms?.accepted_at ? `Aceptados el ${formatLongDate(toDateString(new Date(terms.accepted_at)))}` : "Léelos antes de continuar"}
        showBack={alreadyAccepted}
        onBack={() => (router.canGoBack() ? router.back() : goHome())}
        big
      />
      {loading ? (
        <LoadingView />
      ) : error || !terms ? (
        <ErrorView message={error ?? "No pudimos cargar los términos."} onRetry={load} big />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {terms.sections.map((s) => (
            <Card key={s.title}>
              <Text style={styles.title} accessibilityRole="header">
                {s.title}
              </Text>
              <Text style={styles.body}>{s.body}</Text>
            </Card>
          ))}
          <Text style={styles.version}>Versión {terms.version}</Text>

          {!alreadyAccepted && (
            <>
              <TouchableOpacity
                style={styles.check}
                onPress={() => setChecked((c) => !c)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                testID="terms-check"
              >
                <MaterialCommunityIcons name={checked ? "checkbox-marked" : "checkbox-blank-outline"} size={40} color={Colors.btnTeal} />
                <Text style={styles.checkText}>Leí los términos y acepto que mis datos se usen como se explica aquí.</Text>
              </TouchableOpacity>
              <Button title="Aceptar y continuar" size="patient" variant="teal" icon="check" onPress={accept} disabled={!checked} loading={saving} testID="terms-accept" />
              <Button title="No acepto" size="patient" variant="ghost" onPress={decline} style={{ marginTop: 8 }} testID="terms-decline" />
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: FontSize.patient.body, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6 },
  body: { fontSize: FontSize.patient.label, fontFamily: Fonts.regular, color: Colors.textPrimary, lineHeight: 26 },
  version: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textMuted, textAlign: "center", marginVertical: 8 },
  check: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 },
  checkText: { flex: 1, fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary },
});
