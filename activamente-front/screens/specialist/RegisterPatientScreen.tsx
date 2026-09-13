import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { getPatientByRut, assignPatientToSpecialist, Patient } from "../../services/patientService";

// ─── Función para formatear el RUT automáticamente ─────────────────────────────
const formatRut = (value: string) => {
  // 1. Remover todo lo que no sea número o la letra K, y limitar a 9 caracteres
  //    (8 del cuerpo + 1 dígito verificador). Limitar aquí evita que el RUT
  //    formateado supere los 12 chars y que maxLength del input lo recorte a
  //    mitad de formateo, lo que desincronizaba el valor nativo del controlado
  //    (origen de los "números de la nada" o repetidos al escribir).
  const cleanValue = value.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);

  if (cleanValue.length === 0) return "";
  if (cleanValue.length === 1) return cleanValue;

  // 2. Separar el dígito verificador del resto (cuerpo)
  const dv = cleanValue.slice(-1);
  let body = cleanValue.slice(0, -1);

  // 3. Agregar los puntos cada 3 números
  body = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  // 4. Retornar unido con el guion
  return `${body}-${dv}`;
};

export default function AssignPatientScreen() {
  const router = useRouter();
  
  // Estados para el flujo
  const [rutInput, setRutInput] = useState("");
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);
  
  // Estados de carga
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  const handleRutChange = (text: string) => {
    setRutInput(formatRut(text));
  };

  const handleSearch = async () => {
    if (!rutInput.trim()) {
      Alert.alert("Atención", "Por favor ingresa un RUT para buscar.");
      return;
    }
    
    setIsSearching(true);
    setFoundPatient(null);
    try {
      const patient = await getPatientByRut(rutInput);
      setFoundPatient(patient);
    } catch (err: any) {
      Alert.alert("No encontrado", err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmAssign = async () => {
    if (!foundPatient) return;
    
    setIsAssigning(true);
    try {
      await assignPatientToSpecialist(foundPatient.rut);
      Alert.alert("Éxito", "Paciente asignado correctamente a tu lista.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", "Ocurrió un problema al asignar el paciente.");
    } finally {
      setIsAssigning(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
      <View style={styles.banner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="#DEEDE6" />
        </TouchableOpacity>
        <Text style={styles.bannerTitle}>Asignar Paciente</Text>
        <Text style={styles.bannerSubtitle}>Añade un paciente existente a tu lista</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Búsqueda por RUT ── */}
          <Text style={styles.fieldLabel}>INGRESE EL RUT DEL PACIENTE</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.fieldInput, styles.searchInput]}
              value={rutInput}
              onChangeText={handleRutChange} // Aquí aplicamos la función
              placeholder="Ej: 12.345.678-9"
              placeholderTextColor="#7BB899"
              autoCapitalize="characters" // El dígito verificador 'K' va en mayúscula
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no" // Evita que el autofill de Android inyecte valores
              textContentType="none"
              // visible-password en Android desactiva la barra de sugerencias/autocompletado
              // (que insertaba números repetidos o "de la nada") y permite la 'K'.
              keyboardType={Platform.OS === "android" ? "visible-password" : "default"}
              maxLength={12} // XX.XXX.XXX-X son 12 chars; el cuerpo ya se limita en formatRut
              editable={!isSearching}
            />
            <TouchableOpacity 
              style={styles.searchBtn} 
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator color="#27695A" size="small" />
              ) : (
                <MaterialCommunityIcons name="magnify" size={24} color="#27695A" />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Información del Paciente Encontrado ── */}
          {foundPatient && (
            <View style={styles.resultContainer}>
              
              {/* Tarjeta de Perfil */}
              <View style={styles.card}>
                <View style={styles.profileRow}>
                  <View style={styles.avatarCircle}>
                    <MaterialCommunityIcons name="account-outline" size={36} color="#27695A" />
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{foundPatient.fullName}</Text>
                    <Text style={styles.profileRut}>{foundPatient.rut}</Text>
                    
                    <View style={styles.statsRow}>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Edad</Text>
                        <Text style={styles.statValue}>{foundPatient.age} años</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Género</Text>
                        <Text style={styles.statValue}>{foundPatient.gender}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Título de Sección de Contacto */}
              <Text style={styles.sectionTitle}>Información de Contacto</Text>

              {/* Tarjeta de Contacto */}
              <View style={styles.card}>
                <View style={styles.contactItem}>
                  <View style={styles.contactIconBg}>
                    <MaterialCommunityIcons name="email-outline" size={20} color="#49A2A5" />
                  </View>
                  <Text style={styles.contactText}>{foundPatient.email}</Text>
                </View>
                
                <View style={styles.contactItem}>
                  <View style={styles.contactIconBg}>
                    <MaterialCommunityIcons name="phone-outline" size={20} color="#49A2A5" />
                  </View>
                  <Text style={styles.contactText}>{foundPatient.phone}</Text>
                </View>
                
                <View style={styles.contactItem}>
                  <View style={styles.contactIconBg}>
                    <MaterialCommunityIcons name="map-marker-outline" size={20} color="#49A2A5" />
                  </View>
                  <Text style={styles.contactText}>{foundPatient.address}</Text>
                </View>
              </View>

              {/* ── Botón Confirmar ── */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmAssign}
                disabled={isAssigning}
              >
                {isAssigning ? (
                  <ActivityIndicator color="#27695A" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Añadir Paciente</Text>
                )}
              </TouchableOpacity>

            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
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

  // ── Búsqueda ──
  fieldLabel: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: "#49A2A5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
    backgroundColor: "#EAF4F0",
  },
  searchInput: {
    flex: 1,
  },
  searchBtn: {
    backgroundColor: "#EAF4F0",
    borderColor: "#49A2A5",
    borderWidth: 1.5,
    height: 48,
    width: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Resultados y Tarjetas ──
  resultContainer: {
    marginTop: 10,
  },
  card: {
    backgroundColor: "#DEEDE6",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  
  // Perfil
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EAF4F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 1.5,
    borderColor: "#7BB899",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 2,
  },
  profileRut: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "#7BB899",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 20,
  },
  statBox: {
    flexDirection: "column",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "PromptRegular",
    color: "rgba(39,105,90,0.6)",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontFamily: "PromptBold",
    color: "#27695A",
  },

  // Contacto
  sectionTitle: {
    fontSize: 16,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 10,
    marginLeft: 4,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  contactIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EAF4F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contactText: {
    fontSize: 14,
    fontFamily: "PromptRegular",
    color: "#27695A",
    flex: 1,
  },

  // ── Botón Confirmar ──
  confirmBtn: {
    backgroundColor: "#7BB899",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },
});