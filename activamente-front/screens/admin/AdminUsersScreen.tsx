// screens/admin/AdminUsersScreen.tsx — gestión de usuarios: búsqueda, filtro
// por rol, paginación "cargar más" (EP-11), editar real (HC-09/BT-10) y
// activar/desactivar.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Badge, SearchBar, LoadingView, EmptyState, ErrorView, confirm, useToast } from "../../components/ui";
import { SetPasswordModal } from "../../components/SetPasswordModal";
import { UserEditModal } from "../../components/UserEditModal";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { listUsers, setUserStatus, AdminUser, ROLE_LABEL, RoleEs } from "../../services/userService";
import { getErrorMessage } from "../../utils/errors";
import { initialsFor } from "../../utils/text";

const PAGE = 25;
const ROLE_FILTERS: { label: string; role?: RoleEs }[] = [{ label: "Todos" }, { label: "Pacientes", role: "paciente" }, { label: "Especialistas", role: "especialista" }, { label: "Admins", role: "admin" }];

export default function AdminUsersScreen() {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleEs | undefined>(undefined);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);

  const load = useCallback(
    async (offset = 0) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const page = await listUsers({ search, role: roleFilter, limit: PAGE, offset });
        setUsers((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
        setHasMore(page.hasMore);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, roleFilter]
  );

  // Recarga con debounce SOLO cuando cambian búsqueda/filtro (el montaje lo cubre useFocusEffect).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = setTimeout(() => void load(0), 300);
    return () => clearTimeout(handle);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(0);
    }, [load])
  );

  const toggle = async (u: AdminUser) => {
    const action = u.isActive ? "desactivar" : "activar";
    if (!(await confirm("Confirmar", `¿Quieres ${action} a ${u.fullName}?`, { confirmText: "Confirmar", destructive: u.isActive }))) return;
    setTogglingId(u.id);
    try {
      const updated = await setUserStatus(u.id, !u.isActive);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast(updated.isActive ? "Usuario activado" : "Usuario desactivado");
    } catch (e) {
      toast(getErrorMessage(e), "error");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Screen>
      <Banner title="Gestión de usuarios" subtitle={total ? `${total} ${total === 1 ? "usuario" : "usuarios"}` : "Roles, estados y datos"} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar por nombre o correo" />
        <View style={styles.filters}>
          {ROLE_FILTERS.map((f) => {
            const active = roleFilter === f.role;
            return (
              <TouchableOpacity key={f.label} style={[styles.filter, active && styles.filterActive]} onPress={() => setRoleFilter(f.role)} accessibilityRole="radio" accessibilityState={{ selected: active }}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <LoadingView />
        ) : error ? (
          <ErrorView message={error} onRetry={() => load(0)} />
        ) : users.length === 0 ? (
          <EmptyState icon="account-search-outline" title="Sin resultados" message="Prueba con otro nombre o filtro." />
        ) : (
          <>
            {users.map((u) => (
              <Card key={u.id} style={[styles.card, { borderLeftColor: !u.isActive ? "#A9A9A9" : u.role === "admin" ? Colors.btnDanger : Colors.btnTeal }]}>
                <View style={styles.top}>
                  <View style={styles.avatar}>
                    <Text style={styles.initials}>{initialsFor(u.fullName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{u.fullName}</Text>
                    <Text style={styles.email}>{u.email}</Text>
                    <Text style={styles.email}>{[ROLE_LABEL[u.role], u.rut].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <Badge label={u.isActive ? "Activo" : "Inactivo"} tone={u.isActive ? "success" : "danger"} />
                </View>
                <View style={styles.actions}>
                  <Button title="Editar" icon="pencil-outline" size="sm" variant="outline" onPress={() => setEditing(u)} style={{ flex: 1 }} />
                  <Button title="Clave" icon="lock-reset" size="sm" variant="outline" onPress={() => setPasswordFor(u)} style={{ flex: 1 }} accessibilityLabel={`Cambiar contraseña de ${u.fullName}`} />
                  <Button
                    title={u.isActive ? "Desactivar" : "Activar"}
                    icon={u.isActive ? "cancel" : "check-circle-outline"}
                    size="sm"
                    variant={u.isActive ? "danger" : "primary"}
                    onPress={() => toggle(u)}
                    loading={togglingId === u.id}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
            {hasMore && <Button title={`Cargar más (${users.length} de ${total})`} variant="outline" onPress={() => load(users.length)} loading={loadingMore} />}
          </>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push(routes.createUser)} accessibilityRole="button" accessibilityLabel="Crear usuario">
        <MaterialCommunityIcons name="account-plus" size={26} color={Colors.textOnDark} />
      </TouchableOpacity>

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
  scroll: { padding: 16, paddingBottom: 100 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  filter: { paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: "rgba(222,237,230,0.6)", alignItems: "center", justifyContent: "center" },
  filterActive: { backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border },
  filterText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  filterTextActive: { fontFamily: Fonts.bold, color: Colors.textPrimary },
  card: { borderLeftWidth: 4 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center" },
  initials: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  name: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  email: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.btnDark, alignItems: "center", justifyContent: "center", elevation: 6 },
});
