// screens/specialist/AssignPatientScreen.tsx — agregar un paciente existente a
// mi lista buscándolo por RUT (validación de dígito verificador en el cliente).
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Field, InfoRow, InlineError, SectionTitle, useToast } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { assignPatientToSpecialist, getPatientByRut, Patient } from "../../services/patientService";
import { getErrorMessage } from "../../utils/errors";
import { formatRut, isValidRut, normalizeRut } from "../../utils/rut";

export default function AssignPatientScreen() {
  const router = useRouter();
  const toast = useToast();
  const [rut, setRut] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rutError = rut.length > 0 && normalizeRut(rut).length >= 8 && !isValidRut(rut) ? "El RUT no es válido (revisa el dígito verificador)." : null;
  const canSearch = isValidRut(rut) && !searching;

  const search = async () => {
    if (!canSearch) return;
    setSearching(true);
    setError(null);
    setPatient(null);
    try {
      setPatient(await getPatientByRut(rut));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const assign = async () => {
    if (!patient) return;
    setAssigning(true);
    try {
      await assignPatientToSpecialist(patient.rut);
      toast(`${patient.fullName} ahora está en tu lista`);
      router.back();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Screen>
      <Banner title="Agregar paciente" subtitle="Busca por RUT a un paciente ya registrado" showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field
            label="RUT del paciente"
            icon="card-account-details-outline"
            value={rut}
            onChangeText={(t) => setRut(formatRut(t))}
            placeholder="12.345.678-9"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            keyboardType={Platform.OS === "android" ? "visible-password" : "default"}
            maxLength={12}
            error={rutError}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          <Button title="Buscar" icon="magnify" variant="teal" onPress={search} disabled={!canSearch} loading={searching} />
          <InlineError message={error} />

          {patient && (
            <View style={{ marginTop: 16 }}>
              <Card>
                <View style={styles.profileRow}>
                  <View style={styles.avatar}>
                    <MaterialCommunityIcons name="account-outline" size={36} color={Colors.textPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{patient.fullName}</Text>
                    <Text style={styles.rut}>{patient.rut}</Text>
                    <Text style={styles.meta}>{[patient.age != null ? `${patient.age} años` : null, patient.gender].filter(Boolean).join(" · ")}</Text>
                  </View>
                </View>
              </Card>
              <SectionTitle>Contacto</SectionTitle>
              <Card>
                <InfoRow icon="email-outline" label="Correo" value={patient.email} />
                <InfoRow icon="phone-outline" label="Teléfono" value={patient.phone || "No registrado"} />
                <InfoRow icon="map-marker-outline" label="Dirección" value={patient.address || "No registrada"} />
              </Card>
              {patient.assignedToMe ? (
                <Button title="Ya está en tu lista" icon="check" variant="outline" disabled />
              ) : !patient.active ? (
                <Button title="Cuenta deshabilitada" icon="cancel" variant="outline" disabled />
              ) : (
                <Button title="Agregar a mi lista" icon="account-plus" onPress={assign} loading={assigning} />
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.btnPrimary },
  name: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary },
  rut: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  meta: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textPrimary, marginTop: 4 },
});
