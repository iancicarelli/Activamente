import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { useFocusEffect, useRouter } from "expo-router";
import AdminNavbar from "../../components/AdminNavbar";
import { listUsers, setUserStatus, AdminUser, RoleEs } from "../../services/userService";
import { routes } from "../../router/routes";

const ROLES: RoleEs[] = ["admin", "especialista", "paciente"];

// Left-border accent: grey when inactive, red for admins, teal otherwise.
const borderColorFor = (role: RoleEs, isActive: boolean) => {
  if (!isActive) return "#A9A9A9";
  return role === "admin" ? "#E75756" : "#49A2A5";
};

const initialsFor = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  return (parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : parts[0].substring(0, 2)
  ).toUpperCase();
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  // Fetch users from the backend, debounced on the search box.
  const loadUsers = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers({ search });
      setUsers(data);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => loadUsers(searchQuery), 350);
    return () => clearTimeout(handle);
  }, [searchQuery, loadUsers]);

  if (!fontsLoaded) return null;

  // Toggle user status against the backend, then update the row in place.
  const handleToggleStatus = (user: AdminUser) => {
    const action = user.isActive ? "desactivar" : "activar";
    Alert.alert(
      "Confirmar Acción",
      `¿Estás seguro de que deseas ${action} a ${user.fullName}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          style: action === "desactivar" ? "destructive" : "default",
          onPress: async () => {
            setTogglingId(user.id);
            try {
              const updated = await setUserStatus(user.id, !user.isActive);
              setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "No se pudo actualizar el estado.");
            } finally {
              setTogglingId(null);
            }
          }
        }
      ]
    );
  };

  // Open edit modal (edits are local only — no edit endpoint yet).
  const openEditModal = (user: AdminUser) => {
    setEditingUser({ ...user });
    setEditModalVisible(true);
  };

  // Save changes from modal (updates the local list only for now).
  const handleSaveEdit = () => {
    if (editingUser) {
      setUsers(prevUsers => prevUsers.map(u =>
        u.id === editingUser.id
          ? { ...u, fullName: editingUser.fullName, email: editingUser.email, role: editingUser.role }
          : u
      ));
    }
    setEditModalVisible(false);
  };

  return (
    <LinearGradient colors={['#DEEDE6','#90C0C1']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>ActivaMente</Text>
        <TouchableOpacity style={styles.profileIconWrap}>
          <MaterialCommunityIcons name="account-circle" size={32} color="#DEEDE6" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.pageTitle}>Gestión de Usuarios</Text>
          <Text style={styles.pageSubtitle}>
            Administra los usuarios del sistema, sus roles y estados.
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color="rgba(39, 105, 90, 0.6)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, correo o rol..."
            placeholderTextColor="rgba(39, 105, 90, 0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <ActivityIndicator color="#27695A" size="large" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#8E3F3F" />
            <Text style={styles.emptyStateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadUsers(searchQuery)}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-search-outline" size={28} color="rgba(39, 105, 90, 0.6)" />
            <Text style={styles.emptyStateText}>No se encontraron usuarios.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {users.map((user) => (
              <View key={user.id} style={[styles.userCard, { borderLeftColor: borderColorFor(user.role, user.isActive) }]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.userInfoLeft}>
                    <View style={styles.userInitialsAvatar}>
                      <Text style={[styles.userInitialsText, { color: user.role === 'admin' ? '#8E3F3F' : '#27695A' }]}>
                        {initialsFor(user.fullName)}
                      </Text>
                    </View>
                    <View style={styles.userDetails}>
                      <Text style={styles.userName}>{user.fullName}</Text>
                      <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                  </View>

                  <View style={[
                    styles.statusPill,
                    !user.isActive && styles.statusPillInactive
                  ]}>
                    <View style={[
                      styles.statusDot,
                      !user.isActive && styles.statusDotInactive
                    ]} />
                    <Text style={[
                      styles.statusText,
                      !user.isActive && styles.statusTextInactive
                    ]}>{user.isActive ? 'ACTIVO' : 'INACTIVO'}</Text>
                  </View>
                </View>

                <View style={styles.cardBottomRow}>
                  <View style={styles.roleContainer}>
                    <MaterialCommunityIcons
                      name={user.role === 'admin' ? 'shield-account-outline' : 'briefcase-outline'}
                      size={14}
                      color={user.role === 'admin' ? '#8E3F3F' : "rgba(39, 105, 90, 0.7)"}
                    />
                    <Text style={[
                      styles.roleText,
                      user.role === 'admin' && { color: '#8E3F3F' }
                    ]}>{user.role}</Text>
                  </View>

                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() => openEditModal(user)}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={16} color="#27695A" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() => handleToggleStatus(user)}
                      disabled={togglingId === user.id}
                    >
                      {togglingId === user.id ? (
                        <ActivityIndicator size="small" color="#27695A" />
                      ) : user.isActive ? (
                        <MaterialCommunityIcons name="cancel" size={16} color="rgba(39, 105, 90, 0.6)" />
                      ) : (
                        <MaterialCommunityIcons name="check-circle-outline" size={16} color="#27695A" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push(routes.createUser as any)}
      >
        <MaterialCommunityIcons name="account-plus" size={24} color="#fff" />
      </TouchableOpacity>

      <AdminNavbar active="users" />

      {/* Edit User Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Editar Usuario</Text>

            {editingUser && (
              <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Nombre Completo</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingUser.fullName}
                  onChangeText={(text) => setEditingUser({...editingUser, fullName: text})}
                  placeholder="Ej. Juan Pérez"
                />

                <Text style={styles.inputLabel}>Correo Electrónico</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingUser.email}
                  onChangeText={(text) => setEditingUser({...editingUser, email: text})}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="ejemplo@correo.com"
                />

                <Text style={styles.inputLabel}>Rol del Usuario</Text>
                <View style={styles.rolesContainer}>
                  {ROLES.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.rolePill,
                        editingUser.role === role && styles.rolePillActive
                      ]}
                      onPress={() => setEditingUser({...editingUser, role})}
                    >
                      <Text style={[
                        styles.rolePillText,
                        editingUser.role === role && styles.rolePillTextActive
                      ]}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.editHint}>
                  Los cambios de perfil son locales por ahora. El estado (activo/inactivo) sí se guarda en el servidor.
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.modalButtonSave]}
                    onPress={handleSaveEdit}
                  >
                    <Text style={styles.modalButtonTextSave}>Guardar Cambios</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
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
    paddingBottom: 80, 
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: "PromptRegular",
    fontSize: 14,
    color: "#27695A",
  },
  listContainer: {
    gap: 16,
  },
  userCard: {
    backgroundColor: 'rgba(222,237,230,0.85)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userInitialsAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DEEDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitialsText: {
    fontSize: 16,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  userEmail: {
    fontSize: 11,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.6)",
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(180, 225, 205, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusPillInactive: {
    backgroundColor: 'rgba(220, 220, 220, 0.8)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27695A',
  },
  statusDotInactive: {
    backgroundColor: '#666',
  },
  statusText: {
    fontSize: 9,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  statusTextInactive: {
    color: '#666',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleText: {
    fontSize: 11,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.7)",
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DEEDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  loadMoreText: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "rgba(39, 105, 90, 0.7)",
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 10,
  },
  emptyStateText: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.8)",
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#286B5A',
  },
  retryButtonText: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },
  editHint: {
    fontSize: 11,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.6)",
    marginTop: 14,
    lineHeight: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#286B5A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  
  /* Modal Styles */
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
    fontSize: 20,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginBottom: 20,
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
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  rolePill: {
    backgroundColor: '#EAF4F0',
    borderWidth: 1,
    borderColor: '#DEEDE6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rolePillActive: {
    backgroundColor: '#27695A',
    borderColor: '#27695A',
  },
  rolePillText: {
    fontSize: 12,
    fontFamily: "PromptRegular",
    color: "#27695A",
  },
  rolePillTextActive: {
    color: '#DEEDE6',
    fontFamily: "PromptBold",
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
  }
});
