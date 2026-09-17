// screens/admin/CreateUserScreen.tsx — alta de usuarios (admin). Muestra la
// contraseña temporal UNA vez. RUT con validación de DV, placeholders chilenos.
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Field, InlineError } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { createUserApi, CreateUserPayload } from "../../services/userService";
import { getErrorMessage } from "../../utils/errors";
import { formatRut, isValidRut, normalizeRut } from "../../utils/rut";

const GENDERS = ["Masculino", "Femenino", "Otro"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CreateUserScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"paciente" | "especialista">("paciente");
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const errors = {
    name: fullName.trim().length < 2 ? "Escribe el nombre completo." : null,
    email: !EMAIL_RE.test(email.trim()) ? "Escribe un correo válido." : null,
    rut: normalizeRut(rut).length > 0 && !isValidRut(rut) ? "El RUT no es válido." : null,
  };
  const valid = !errors.name && !errors.email && !errors.rut;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    const payload: CreateUserPayload = {
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      rut: normalizeRut(rut) ? rut : undefined,
      phone: phone.trim() || undefined,
    };
    if (role === "paciente") {
      payload.age = age.trim() ? Number(age) : undefined;
      payload.gender = gender || undefined;
      payload.address = address.trim() || undefined;
    } else {
      payload.specialty = specialty.trim() || undefined;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createUserApi(payload);
      Alert.alert(
        "Usuario creado",
        `Contraseña temporal para ${created.email}:\n\n${created.temp_password}\n\nCompártela con la persona; no se volverá a mostrar.`,
        [{ text: "Entendido", onPress: () => router.back() }]
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Banner title="Crear usuario" subtitle="Registra un nuevo perfil en el sistema" showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Card>
            <Field label="Nombre completo" icon="account-outline" value={fullName} onChangeText={setFullName} placeholder="Ej: Ana María Silva" error={touched ? errors.name : null} />
            <Field label="Correo electrónico" icon="email-outline" value={email} onChangeText={setEmail} placeholder="ana.silva@ejemplo.cl" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={touched ? errors.email : null} />

            <Text style={styles.label}>Rol</Text>
            <View style={styles.pills}>
              {(["paciente", "especialista"] as const).map((r) => (
                <TouchableOpacity key={r} style={[styles.pill, role === r && styles.pillActive]} onPress={() => setRole(r)} accessibilityRole="radio" accessibilityState={{ selected: role === r }}>
                  <MaterialCommunityIcons name={r === "paciente" ? "account-outline" : "medical-bag"} size={18} color={role === r ? Colors.textOnDark : Colors.textPrimary} />
                  <Text style={[styles.pillText, role === r && styles.pillTextActive]}>{r === "paciente" ? "Paciente" : "Especialista"}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field
              label="RUT"
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
              error={errors.rut}
              hint="Permite ingresar con RUT en vez de correo"
            />

            <TouchableOpacity style={styles.accordion} onPress={() => setShowMore((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showMore }}>
              <Text style={styles.accordionTitle}>Datos adicionales (opcional)</Text>
              <MaterialCommunityIcons name={showMore ? "chevron-up" : "chevron-down"} size={22} color={Colors.textPrimary} />
            </TouchableOpacity>

            {showMore && (
              <>
                <Field label="Teléfono" icon="phone-outline" value={phone} onChangeText={setPhone} placeholder="+56 9 1234 5678" keyboardType="phone-pad" />
                {role === "paciente" ? (
                  <>
                    <Field label="Edad" icon="calendar-outline" value={age} onChangeText={(t) => setAge(t.replace(/\D/g, ""))} placeholder="Ej: 68" keyboardType="number-pad" maxLength={3} />
                    <Text style={styles.label}>Género</Text>
                    <View style={styles.pills}>
                      {GENDERS.map((g) => (
                        <TouchableOpacity key={g} style={[styles.pill, gender === g && styles.pillActive]} onPress={() => setGender(g)} accessibilityRole="radio" accessibilityState={{ selected: gender === g }}>
                          <Text style={[styles.pillText, gender === g && styles.pillTextActive]}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Field label="Dirección" icon="map-marker-outline" value={address} onChangeText={setAddress} placeholder="Ej: Av. Alemania 123, Temuco" />
                  </>
                ) : (
                  <Field label="Especialidad" icon="medal-outline" value={specialty} onChangeText={setSpecialty} placeholder="Ej: Kinesiología" />
                )}
              </>
            )}
          </Card>
          <InlineError message={error} />
          <Button title="Crear usuario" icon="account-plus" onPress={submit} loading={loading} disabled={touched && !valid} testID="create-user-submit" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 6, letterSpacing: 0.3 },
  pills: { flexDirection: "row", gap: 10, marginBottom: 14 },
  pill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, minHeight: 48, backgroundColor: Colors.cardBgAlt },
  pillActive: { backgroundColor: Colors.btnPrimary, borderColor: Colors.btnPrimary },
  pillText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textPrimary },
  pillTextActive: { color: Colors.textOnDark },
  accordion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.cardBgAlt, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 14 },
  accordionTitle: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textPrimary },
});
