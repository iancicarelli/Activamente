// app/create-user.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { createUserApi, CreateUserPayload } from "../services/userService";

const GENDERS = ["Masculino", "Femenino", "Otro"] as const;

// Formatea el RUT chileno a medida que se escribe (12.345.678-9).
const formatRut = (value: string) => {
  const cleanValue = value.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
  if (cleanValue.length === 0) return "";
  if (cleanValue.length === 1) return cleanValue;
  const dv = cleanValue.slice(-1);
  const body = cleanValue.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${dv}`;
};

export default function CreateUserScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"paciente" | "especialista">("paciente");

  // Campos por rol (se guardan en patients / specialists en el backend).
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string>("");
  const [address, setAddress] = useState("");
  const [specialty, setSpecialty] = useState("");

  const [loading, setLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  // Acordeón: los datos opcionales arrancan colapsados (E1 — divulgación progresiva).
  const [showMore, setShowMore] = useState(false);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../assets/fonts/Prompt-SemiBold.ttf"),
  });

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert("Atención", "Ingrese el nombre y el correo.");
      return;
    }

    if (age.trim() && Number.isNaN(Number(age))) {
      Alert.alert("Atención", "La edad debe ser un número.");
      return;
    }

    // Solo enviamos los campos con valor; los vacíos quedan NULL en el backend.
    const payload: CreateUserPayload = {
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      rut: rut.trim() || undefined,
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
    try {
      const created = await createUserApi(payload);

      // Mostrar el mensaje de éxito
      setShowSuccessToast(true);

      const goBack = () => {
        setShowSuccessToast(false);
        router.back(); // Vuelve a la pantalla anterior
      };

      // Surface the one-time temporary password so the admin can share it.
      if (created.temp_password) {
        setTimeout(() => {
          Alert.alert(
            "Usuario creado",
            `Contraseña temporal para ${created.email}:\n\n${created.temp_password}\n\nCompártela con el usuario; no se volverá a mostrar.`,
            [{ text: "Entendido", onPress: goBack }]
          );
        }, 600);
      } else {
        setTimeout(goBack, 3000);
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "No se pudo crear el usuario.");
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
      {/* Banner */}
      <View style={styles.banner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#DEEDE6" />
        </TouchableOpacity>
        <Text style={styles.bannerTitle}>Crear Usuario</Text>
        <Text style={styles.bannerSubtitle}>
          Registra un nuevo perfil en el sistema
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Nombre */}
            <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons
                name="account-outline"
                size={20}
                color="#49A2A5"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej. Ana María Silva"
                placeholderTextColor="#7BB899"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* Correo */}
            <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color="#49A2A5"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.fieldInput}
                placeholder="ana.silva@ejemplo.com"
                placeholderTextColor="#7BB899"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Rol */}
            <Text style={styles.fieldLabel}>ROL DEL USUARIO</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, role === "paciente" && styles.pillActive]}
                onPress={() => setRole("paciente")}
              >
                <MaterialCommunityIcons
                  name="account-outline"
                  size={18}
                  color={role === "paciente" ? "#DEEDE6" : "#27695A"}
                />
                <Text
                  style={[
                    styles.pillText,
                    role === "paciente" && styles.pillTextActive,
                  ]}
                >
                  Paciente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pill, role === "especialista" && styles.pillActive]}
                onPress={() => setRole("especialista")}
              >
                <MaterialCommunityIcons
                  name="medical-bag"
                  size={18}
                  color={role === "especialista" ? "#DEEDE6" : "#27695A"}
                />
                <Text
                  style={[
                    styles.pillText,
                    role === "especialista" && styles.pillTextActive,
                  ]}
                >
                  Especialista
                </Text>
              </TouchableOpacity>
            </View>

            {/* RUT */}
            <Text style={styles.fieldLabel}>RUT</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons
                name="card-account-details-outline"
                size={20}
                color="#49A2A5"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej. 12.345.678-9"
                placeholderTextColor="#7BB899"
                value={rut}
                onChangeText={(text) => setRut(formatRut(text))}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                keyboardType={Platform.OS === "android" ? "visible-password" : "default"}
                maxLength={12}
              />
            </View>

            {/* ── Acordeón: datos adicionales (opcional) ── */}
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => setShowMore((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.accordionTitle}>Datos adicionales (opcional)</Text>
              <MaterialCommunityIcons
                name={showMore ? "chevron-up" : "chevron-down"}
                size={22}
                color="#27695A"
              />
            </TouchableOpacity>

            {showMore && (
              <>
            {/* Teléfono */}
            <Text style={styles.fieldLabel}>TELÉFONO</Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={20}
                color="#49A2A5"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.fieldInput}
                placeholder="Ej. +56912345678"
                placeholderTextColor="#7BB899"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Campos según el rol */}
            {role === "paciente" ? (
              <>
                {/* Edad */}
                <Text style={styles.fieldLabel}>EDAD</Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="calendar-outline"
                    size={20}
                    color="#49A2A5"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Ej. 34"
                    placeholderTextColor="#7BB899"
                    value={age}
                    onChangeText={(text) => setAge(text.replace(/\D/g, ""))}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>

                {/* Género */}
                <Text style={styles.fieldLabel}>GÉNERO</Text>
                <View style={styles.pillRow}>
                  {GENDERS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.pill, gender === g && styles.pillActive]}
                      onPress={() => setGender(g)}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          gender === g && styles.pillTextActive,
                        ]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Dirección */}
                <Text style={styles.fieldLabel}>DIRECCIÓN</Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={20}
                    color="#49A2A5"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Ej. Av. Ficticia 123, Santiago"
                    placeholderTextColor="#7BB899"
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </>
            ) : (
              <>
                {/* Especialidad */}
                <Text style={styles.fieldLabel}>ESPECIALIDAD</Text>
                <View style={styles.inputRow}>
                  <MaterialCommunityIcons
                    name="medal-outline"
                    size={20}
                    color="#49A2A5"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Ej. Kinesiología"
                    placeholderTextColor="#7BB899"
                    value={specialty}
                    onChangeText={setSpecialty}
                  />
                </View>
              </>
            )}
              </>
            )}
          </View>

          {/* Botón Guardar */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#DEEDE6" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toast de Éxito Flotante */}
      {showSuccessToast && (
        <View style={styles.toastContainer}>
          <View style={styles.toastIconCircle}>
            <MaterialCommunityIcons name="check" size={16} color="#DEEDE6" />
          </View>
          <View style={styles.toastTextContainer}>
            <Text style={styles.toastTitle}>Éxito</Text>
            <Text style={styles.toastMessage}>
              Usuario guardado correctamente.
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowSuccessToast(false)}>
            <MaterialCommunityIcons name="close" size={20} color="#27695A" />
          </TouchableOpacity>
        </View>
      )}
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
  backBtn: {
    alignSelf: "flex-start",
    padding: 4,
    marginBottom: 6,
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#DEEDE6",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 6,
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
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
  pillRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#EAF4F0",
    borderWidth: 1.5,
    borderColor: "#49A2A5",
    marginBottom: 16,
  },
  accordionTitle: {
    fontSize: 13,
    fontFamily: "PromptBold",
    color: "#27695A",
    letterSpacing: 0.3,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#49A2A5",
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#EAF4F0",
  },
  pillActive: {
    backgroundColor: "#7BB899",
    borderColor: "#7BB899",
  },
  pillText: {
    fontSize: 13,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  pillTextActive: {
    color: "#DEEDE6",
  },
  submitBtn: {
    backgroundColor: "#7BB899",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },
  toastContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#DEEDE6",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#49A2A5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  toastIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#7BB899",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  toastTextContainer: { flex: 1 },
  toastTitle: {
    fontSize: 14,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  toastMessage: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.7)",
    marginTop: 2,
  },
});
