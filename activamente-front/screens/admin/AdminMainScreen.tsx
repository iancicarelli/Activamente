import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useFocusEffect, useRouter } from "expo-router";
import AdminNavbar from "../../components/AdminNavbar";
import { listUsers, AdminUser, RoleEs } from "../../services/userService";
import { routes } from "../../router/routes";

// Maps the role filter pills to the backend role labels.
const FILTERS: { label: string; role?: RoleEs }[] = [
  { label: "Todos" },
  { label: "Paciente", role: "paciente" },
  { label: "Especialista", role: "especialista" },
];

const ROLE_LABEL: Record<RoleEs, string> = {
  admin: "Administrador",
  especialista: "Especialista",
  paciente: "Paciente",
};

const initialsFor = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  if (!parts[0]) return "?";
  return (parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : parts[0].substring(0, 2)
  ).toUpperCase();
};

export default function AdminMainScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time the dashboard regains focus (e.g. after creating a user).
  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );

  if (!fontsLoaded) return null;

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const activePct = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;

  const activeRole = FILTERS.find((f) => f.label === activeFilter)?.role;
  const visibleUsers = activeRole
    ? users.filter((u) => u.role === activeRole)
    : users;

  return (
    <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>ActivaMente</Text>
        <TouchableOpacity style={styles.profileIconWrap}>
          <MaterialCommunityIcons name="account-circle" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Panel Principal Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Panel Principal</Text>
          <Text style={styles.sectionSubtitle}>Resumen de actividad y gestión del sistema.</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {/* Total Usuarios */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Total Usuarios</Text>
                <Text style={styles.statValue}>{totalUsers}</Text>
              </View>
              <MaterialCommunityIcons name="account-group" size={28} color="#27695A" />
            </View>
          </View>

          {/* Usuarios Activos */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Usuarios Activos</Text>
                <Text style={styles.statValue}>{activeUsers}</Text>
              </View>
              <MaterialCommunityIcons name="account-check" size={28} color="#27695A" />
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${activePct}%` }]} />
            </View>
          </View>

          {/* Usuarios Inactivos */}
          <View style={[styles.statCard, styles.statCardInactive]}>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Usuarios Inactivos</Text>
                <Text style={[styles.statValue, { color: '#8E3F3F' }]}>{inactiveUsers}</Text>
              </View>
              <MaterialCommunityIcons name="account-cancel" size={28} color="#8E3F3F" />
            </View>
          </View>
        </View>

        {/* Acciones Rápidas */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        </View>
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#286B5A' }]}
            onPress={() => router.push(routes.createUser as any)}
          >
            <MaterialCommunityIcons name="account-plus" size={20} color="#fff" style={styles.actionIcon} />
            <Text style={styles.actionButtonText}>Crear usuario</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#64A694' }]}
            onPress={() => router.push("/admin-users" as any)}
          >
            <MaterialCommunityIcons name="account-cog" size={20} color="#0D472A" style={styles.actionIcon} />
            <Text style={[styles.actionButtonText, { color: '#27695A' }]}>Gestionar usuarios</Text>
          </TouchableOpacity>
        </View>

        {/* Resumen de Usuarios */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resumen de Usuarios</Text>
        </View>
        
        {/* Filters */}
        <View style={styles.filtersContainer}>
          {FILTERS.map(({ label }) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.filterPill,
                activeFilter === label && styles.filterPillActive
              ]}
              onPress={() => setActiveFilter(label)}
            >
              {label === 'Todos' && <MaterialCommunityIcons name="filter-variant" size={14} color="#0D472A" style={{marginRight: 4}} />}
              <Text style={[
                styles.filterPillText,
                activeFilter === label && styles.filterPillTextActive
              ]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* User List */}
        {loading ? (
          <ActivityIndicator color="#27695A" size="large" style={{ marginTop: 30 }} />
        ) : visibleUsers.length === 0 ? (
          <Text style={styles.emptyText}>No hay usuarios para mostrar.</Text>
        ) : (
          <View style={styles.userListContainer}>
            {visibleUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userInfoLeft}>
                  <View style={styles.userInitialsAvatar}>
                    <Text style={styles.userInitialsText}>{initialsFor(user.fullName)}</Text>
                  </View>
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{user.fullName}</Text>
                    <Text style={styles.userRole}>{ROLE_LABEL[user.role]}</Text>
                  </View>
                </View>
                <View style={styles.userInfoRight}>
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
                    ]}>{user.isActive ? 'Activo' : 'Inactivo'}</Text>
                  </View>

                  <TouchableOpacity style={styles.moreOptions} onPress={() => router.push("/admin-users" as any)}>
                    <MaterialCommunityIcons name="dots-vertical" size={20} color="#27695A" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push("/admin-users" as any)}>
              <Text style={styles.viewAllText}>Ver todos los usuarios</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Admin Navbar */}
      <AdminNavbar active="home" />

      <TouchableOpacity style={styles.backToSplash} onPress={() => router.replace("/" as any)}>
        <MaterialCommunityIcons name="home-outline" size={18} color="#27695A" />
      </TouchableOpacity>
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
  backToSplash: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(222,237,230,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileIconWrap: {
    backgroundColor: '#DEEDE6',
    borderRadius: 20,
    padding: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginBottom: 16,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.7)",
    marginTop: 4,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'rgba(222,237,230,0.85)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  statCardInactive: {
    backgroundColor: 'rgba(231,87,86,0.15)',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.7)",
  },
  statValue: {
    fontSize: 32,
    fontFamily: "PromptBold",
    color: "#27695A",
    marginTop: 4,
    lineHeight: 38,
  },
  statTrendText: {
    fontSize: 11,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(39, 105, 90, 0.1)",
    marginTop: 16,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#27695A",
  },
  actionsContainer: {
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: "PromptBold",
    color: "#DEEDE6",
  },

  filtersContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(222,237,230,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: '#DEEDE6',
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.7)",
  },
  filterPillTextActive: {
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  userListContainer: {
    gap: 12,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(222,237,230,0.7)',
    borderRadius: 16,
    padding: 12,
  },
  userInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInitialsAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DEEDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitialsText: {
    fontSize: 14,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  userDetails: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 13,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  userRole: {
    fontSize: 11,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.6)",
  },
  userInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
    moreOptions: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: 'rgba(225, 160, 160, 0.8)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27695A',
  },
  statusDotInactive: {
    backgroundColor: '#8E3F3F',
  },
  statusText: {
    fontSize: 10,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  statusTextInactive: {
    color: '#8E3F3F',
  },

  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: "PromptBold",
    color: "#27695A",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "PromptRegular",
    color: "rgba(39, 105, 90, 0.7)",
    textAlign: "center",
    marginTop: 24,
  }
});
