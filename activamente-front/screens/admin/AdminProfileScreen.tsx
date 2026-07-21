import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Animated,
  ActivityIndicator
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import AdminNavbar from "../../components/AdminNavbar";
import { Colors, GradientColors } from "../../constants/theme";
import { clearAuth } from "../../services/authStore";
import {
  getAdminProfile,
  updateAdminProfile,
  changePassword,
} from "../../services/profileService";

type AdminView = {
  name: string;
  email: string;
  role: string;
  status: string;
  phone: string;
  jobTitle: string;
  avatarUrl: string;
  createdAt: string;
};

const EMPTY_ADMIN: AdminView = {
  name: "",
  email: "",
  role: "Administrador",
  status: "Activo",
  phone: "",
  jobTitle: "",
  avatarUrl: "",
  createdAt: "",
};

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMemberSince(iso: string | null): string {
  if (!iso) return "No disponible";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "No disponible";
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]}, ${d.getFullYear()}`;
}

export default function AdminProfileScreen() {
  const router = useRouter();

  const [adminData, setAdminData] = useState<AdminView>(EMPTY_ADMIN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals state
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({ name: "", phone: "" });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirmPass: "" });

  // Custom Toast state
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastOpacity] = useState(new Animated.Value(0));

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  useEffect(() => {
    let mounted = true;
    getAdminProfile()
      .then((p) => {
        if (!mounted) return;
        setAdminData({
          name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim(),
          email: p.email,
          role: "Administrador",
          status: p.is_active ? "Activo" : "Inactivo",
          phone: p.phone ?? "",
          jobTitle: p.job_title ?? "",
          avatarUrl: "",
          createdAt: formatMemberSince(p.created_at),
        });
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (!fontsLoaded) return null;

  // Show Toast Function
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastMessage(message);
    setToastType(type);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start();
  };

  // Handlers for Edit Profile
  const openEditModal = () => {
    setEditForm({ name: adminData.name, phone: adminData.phone });
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (saving) return;
    if (!editForm.name.trim()) {
      showToast("El nombre no puede estar vacío.", "error");
      return;
    }
    // "Nombre Completo" (un solo campo) → first_name = primer token, last_name = resto.
    const parts = editForm.name.trim().split(/\s+/);
    const first_name = parts.shift() ?? "";
    const last_name = parts.join(" ");
    try {
      setSaving(true);
      const updated = await updateAdminProfile({
        first_name,
        last_name,
        phone: editForm.phone,
      });
      setAdminData((prev) => ({
        ...prev,
        name: [updated.first_name, updated.last_name].filter(Boolean).join(" ").trim(),
        phone: updated.phone ?? "",
      }));
      setEditModalVisible(false);
      showToast("Perfil actualizado correctamente.", "success");
    } catch (e: any) {
      showToast(e?.message ?? "No se pudo actualizar el perfil.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Handlers for Password
  const handleSavePassword = async () => {
    if (saving) return;
    if (!passwordForm.current || !passwordForm.newPass || !passwordForm.confirmPass) {
      showToast("Completa todos los campos.", "error");
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirmPass) {
      showToast("Las contraseñas nuevas no coinciden.", "error");
      return;
    }
    if (passwordForm.newPass.length < 6) {
      showToast("La contraseña debe tener al menos 6 caracteres.", "error");
      return;
    }
    try {
      setSaving(true);
      await changePassword({
        current_password: passwordForm.current,
        new_password: passwordForm.newPass,
      });
      setPasswordModalVisible(false);
      setPasswordForm({ current: "", newPass: "", confirmPass: "" });
      showToast("Contraseña cambiada con éxito.", "success");
    } catch (e: any) {
      showToast(e?.message ?? "No se pudo cambiar la contraseña.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.replace("/" as any); // Redirects to root (login)
  };

  return (
    <LinearGradient colors={GradientColors as any} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>ActivaMente</Text>
        <TouchableOpacity style={styles.profileIconWrap}>
          <MaterialCommunityIcons name="account-circle" size={32} color="#DEEDE6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.btnTeal} />
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.pageTitle}>Mi Perfil</Text>
          <Text style={styles.pageSubtitle}>
            Gestiona tu información personal y seguridad.
          </Text>
        </View>

        {/* Profile Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarContainer}>
              {adminData.avatarUrl ? (
                <Image source={{ uri: adminData.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>
                    {adminData.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerTextInfo}>
              <Text style={styles.adminName}>{adminData.name}</Text>
              <Text style={styles.adminRole}>{adminData.role}</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{adminData.status}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="email-outline" size={20} color="rgba(39, 105, 90, 0.6)" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Correo Electrónico</Text>
              <Text style={styles.infoValue}>{adminData.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="phone-outline" size={20} color="rgba(39, 105, 90, 0.6)" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Teléfono</Text>
              <Text style={styles.infoValue}>{adminData.phone || "No establecido"}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar-account-outline" size={20} color="rgba(39, 105, 90, 0.6)" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Miembro desde</Text>
              <Text style={styles.infoValue}>{adminData.createdAt}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionSubtitle}>Ajustes de cuenta</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={openEditModal}>
            <MaterialCommunityIcons name="pencil-outline" size={20} color="#0D472A" />
            <Text style={styles.actionButtonText}>Editar perfil</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(39, 105, 90, 0.4)" style={{marginLeft: 'auto'}} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => setPasswordModalVisible(true)}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#0D472A" />
            <Text style={styles.actionButtonText}>Cambiar contraseña</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(39, 105, 90, 0.4)" style={{marginLeft: 'auto'}} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color="#E75756" />
            <Text style={[styles.actionButtonText, {color: '#E75756'}]}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
      )}

      {/* Edit Profile Modal */}
      <Modal visible={isEditModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Editar Perfil</Text>

            <Text style={styles.inputLabel}>Nombre Completo *</Text>
            <TextInput
              style={styles.modalInput}
              value={editForm.name}
              onChangeText={(text) => setEditForm({...editForm, name: text})}
              placeholder="Nombre del administrador"
            />

            <Text style={styles.inputLabel}>Correo Electrónico (No editable)</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputDisabled]}
              value={adminData.email}
              editable={false}
            />

            <Text style={styles.inputLabel}>Teléfono (Opcional)</Text>
            <TextInput
              style={styles.modalInput}
              value={editForm.phone}
              onChangeText={(text) => setEditForm({...editForm, phone: text})}
              placeholder="+34 600 000 000"
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSave]} onPress={handleSaveProfile}>
                <Text style={styles.modalButtonTextSave}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={isPasswordModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Cambiar Contraseña</Text>

            <Text style={styles.inputLabel}>Contraseña Actual *</Text>
            <TextInput
              style={styles.modalInput}
              value={passwordForm.current}
              onChangeText={(text) => setPasswordForm({...passwordForm, current: text})}
              secureTextEntry
              placeholder="••••••••"
            />

            <Text style={styles.inputLabel}>Nueva Contraseña *</Text>
            <TextInput
              style={styles.modalInput}
              value={passwordForm.newPass}
              onChangeText={(text) => setPasswordForm({...passwordForm, newPass: text})}
              secureTextEntry
              placeholder="Mínimo 6 caracteres"
            />

            <Text style={styles.inputLabel}>Confirmar Nueva Contraseña *</Text>
            <TextInput
              style={styles.modalInput}
              value={passwordForm.confirmPass}
              onChangeText={(text) => setPasswordForm({...passwordForm, confirmPass: text})}
              secureTextEntry
              placeholder="Vuelve a escribirla"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setPasswordModalVisible(false)}>
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSave]} onPress={handleSavePassword}>
                <Text style={styles.modalButtonTextSave}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Toast Notification */}
      <Animated.View style={[
        styles.toastContainer, 
        { opacity: toastOpacity, backgroundColor: toastType === "success" ? '#49A2A5' : '#E75756' }
      ]}>
        <MaterialCommunityIcons
          name={toastType === "success" ? "check-circle-outline" : "alert-circle-outline"}
          size={20} color={Colors.textOnDark}
        />
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>

      <AdminNavbar active="profile" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 10,
    backgroundColor: '#49A2A5',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  logoText: {
    fontSize: 20,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },
  profileIconWrap: {
    backgroundColor: 'rgba(222,237,230,0.3)',
    borderRadius: 20,
    padding: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginBottom: 20,
    marginTop: 10,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.8)",
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(222,237,230,0.85)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DEEDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  headerTextInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 18,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  adminRole: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.7)",
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(180, 225, 205, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27695A',
  },
  statusText: {
    fontSize: 10,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(39, 105, 90, 0.1)",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.6)",
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginTop: 2,
  },
  actionsContainer: {
    marginBottom: 30,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: "PromptBold",
    color: "rgba(39, 105, 90, 0.8)",
    marginBottom: 12,
    marginLeft: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(222,237,230,0.85)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginLeft: 12,
  },
  logoutButton: {
    marginTop: 10,
    backgroundColor: 'rgba(231, 87, 86, 0.1)',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#DEEDE6',
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "rgba(39, 105, 90, 0.8)",
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#EAF4F0',
    borderWidth: 1,
    borderColor: '#DEEDE6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "PromptRegular",
    fontSize: 14,
    color: "#27695A",
  },
  modalInputDisabled: {
    backgroundColor: '#90C0C1',
    color: '#27695A',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#90C0C1',
    borderWidth: 1,
    borderColor: '#DEEDE6',
  },
  modalButtonSave: {
    backgroundColor: '#286B5A',
  },
  modalButtonTextCancel: {
    fontFamily: "PromptBold",
    color: "rgba(39, 105, 90, 0.7)",
  },
  modalButtonTextSave: {
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },

  // Toast Styles
  toastContainer: {
    position: 'absolute',
    bottom: 90, // Above navbar
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  toastText: {
    fontFamily: "PromptBold",
    color: "#DEEDE6",
    fontSize: 13,
    marginLeft: 8,
  }
});
