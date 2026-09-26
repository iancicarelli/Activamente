// screens/admin/AdminMainScreen.tsx — panel principal del admin: totales
// reales (paginación del backend), accesos rápidos y últimos usuarios con
// acciones directas (BT-09). El ícono de perfil navega al perfil (BT-08).
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Badge, LoadingView, ErrorView, SectionTitle, confirm, useToast } from "../../components/ui";
import { DeletionRequestsCard } from "../../components/DeletionRequestsCard";
import { SetPasswordModal } from "../../components/SetPasswordModal";
import { UserEditModal } from "../../components/UserEditModal";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { listUsers, setUserStatus, AdminUser, ROLE_LABEL, RoleEs } from "../../services/userService";
import { getErrorMessage } from "../../utils/errors";
import { initialsFor } from "../../utils/text";

const FILTERS: { label: string; role?: RoleEs }[] = [{ label: "Todos" }, { label: "Pacientes", role: "paciente" }, { label: "Especialistas", role: "especialista" }];

export default function AdminMainScreen() {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState(FILTERS[0]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [inactive, setInactive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, all] = await Promise.all([listUsers({ role: filter.role, limit: 8 }), listUsers({ limit: 100 })]);
      setUsers(page.items);
      setTotal(all.total);
      setInactive(all.items.filter((u) => !u.isActive).length);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggle = async (u: AdminUser) => {
    const action = u.isActive ? "desactivar" : "activar";
    if (!(await confirm("Confirmar", `¿Quieres ${action} a ${u.fullName}?`, { confirmText: "Confirmar", destructive: u.isActive }))) return;
    try {
      const updated = await setUserStatus(u.id, !u.isActive);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setInactive((n) => n + (updated.isActive ? -1 : 1));
      toast(updated.isActive ? "Usuario activado" : "Usuario desactivado");
    } catch (e) {
      toast(getErrorMessage(e), "error");
    }
  };

  const actions = (u: AdminUser) => {
    // Android muestra como máximo 3 botones: se cierra tocando fuera (cancelable).
    Alert.alert(u.fullName, u.email, [
      { text: "Editar", onPress: () => setEditing(u) },
      { text: "Cambiar contraseña", onPress: () => setPasswordFor(u) },
      { text: u.isActive ? "Desactivar" : "Activar", style: u.isActive ? "destructive" : "default", onPress: () => toggle(u) },
    ], { cancelable: true });
  };

  return (
    <Screen>
      <Banner
        title="ActivaMente"
        subtitle="Panel de administración"
        right={
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push(routes.adminProfile)} accessibilityRole="button" accessibilityLabel="Mi perfil">
            <MaterialCommunityIcons name="account-circle" size={34} color={Colors.textOnDark} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.stats}>
          <Card style={styles.stat}>
            <MaterialCommunityIcons name="account-group" size={28} color={Colors.textPrimary} />
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Usuarios</Text>
          </Card>
          <Card style={styles.stat}>
            <MaterialCommunityIcons name="account-check" size={28} color={Colors.success} />
            <Text style={styles.statValue}>{Math.max(0, total - inactive)}</Text>
            <Text style={styles.statLabel}>Activos</Text>
          </Card>
          <Card style={styles.stat}>
            <MaterialCommunityIcons name="account-cancel" size={28} color={Colors.btnDanger} />
            <Text style={[styles.statValue, { color: Colors.btnDanger }]}>{inactive}</Text>
            <Text style={styles.statLabel}>Inactivos</Text>
          </Card>
        </View>

        <DeletionRequestsCard onResolved={load} />

        <SectionTitle>Acciones rápidas</SectionTitle>
        <View style={styles.actions}>
          <Button title="Crear usuario" icon="account-plus" variant="dark" onPress={() => router.push(routes.createUser)} style={{ flex: 1 }} />
          <Button title="Gestionar" icon="account-cog" variant="teal" onPress={() => router.push(routes.adminUsers)} style={{ flex: 1 }} />
        </View>

        <SectionTitle>Últimos usuarios</SectionTitle>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f.label} style={[styles.filter, filter.label === f.label && styles.filterActive]} onPress={() => setFilter(f)} accessibilityRole="radio" accessibilityState={{ selected: filter.label === f.label }}>
              <Text style={[styles.filterText, filter.label === f.label && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <LoadingView />
        ) : error ? (
          <ErrorView message={error} onRetry={load} />
        ) : users.length === 0 ? (
          <Text style={styles.empty}>No hay usuarios para mostrar.</Text>
        ) : (
          users.map((u) => (
            <Card key={u.id} style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{initialsFor(u.fullName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{u.fullName}</Text>
                <Text style={styles.userRole}>{ROLE_LABEL[u.role]}</Text>
              </View>
              <Badge label={u.isActive ? "Activo" : "Inactivo"} tone={u.isActive ? "success" : "danger"} />
              <TouchableOpacity onPress={() => actions(u)} style={styles.more} accessibilityRole="button" accessibilityLabel={`Acciones para ${u.fullName}`}>
                <MaterialCommunityIcons name="dots-vertical" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </Card>
          ))
        )}
        <Button title="Ver todos los usuarios" variant="ghost" onPress={() => router.push(routes.adminUsers)} />
      </ScrollView>
      <UserEditModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={(u) => {
          setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));
          setEditing(null);
          toast("Usuario actualizado");
        }}
      />
      <SetPasswordModal
        user={passwordFor}
        onClose={() => setPasswordFor(null)}
        onSaved={(u) => {
          setPasswordFor(null);
          toast(`Contraseña de ${u.fullName} actualizada`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  profileBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 6 },
  statValue: { fontSize: FontSize.title, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: 4 },
  statLabel: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary },
  actions: { flexDirection: "row", gap: 10, marginBottom: 8 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 12 },
  filter: { paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: "rgba(222,237,230,0.6)", alignItems: "center", justifyContent: "center" },
  filterActive: { backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border },
  filterText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  filterTextActive: { fontFamily: Fonts.bold, color: Colors.textPrimary },
  userCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center" },
  initials: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textPrimary },
  userName: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  userRole: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary },
  more: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: "center", marginVertical: 24 },
});
