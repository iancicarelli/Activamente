// screens/admin/AdminProfileScreen.tsx — perfil del admin: editar nombre/cargo/
// teléfono (placeholder chileno, HC-10), cambiar contraseña, cerrar sesión.
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen, Banner, Card, Button, Field, InfoRow, Badge, FormModal, LoadingView, ErrorView, SectionTitle, confirm, useToast } from "../../components/ui";
import { ChangePasswordModal } from "../../components/ChangePasswordModal";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { useFocusEffect } from "expo-router";
import { logout } from "../../services/authService";
import { getAdminProfile, splitFullName, updateAdminProfile, AdminProfile } from "../../services/profileService";
import { formatMemberSince } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";
import { initialsFor } from "../../utils/text";

export default function AdminProfileScreen() {
  const toast = useToast();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form, setForm] = useState({ name: "", jobTitle: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getAdminProfile());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();

  const openEdit = () => {
    setForm({ name: fullName, jobTitle: profile?.job_title ?? "", phone: profile?.phone ?? "" });
    setEditVisible(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateAdminProfile({ ...splitFullName(form.name), job_title: form.jobTitle.trim(), phone: form.phone.trim() });
      setProfile(updated);
      setEditVisible(false);
      toast("Perfil actualizado");
    } catch (e) {
      toast(getErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (await confirm("¿Cerrar sesión?", "Tendrás que ingresar de nuevo.", { confirmText: "Cerrar sesión", destructive: true })) logout();
  };

  return (
    <Screen>
      <Banner title="Mi perfil" subtitle="Información personal y seguridad" />
      {loading ? (
        <LoadingView />
      ) : error || !profile ? (
        <ErrorView message={error ?? "No pudimos cargar tu perfil."} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.header}>
              <View style={styles.avatar}>
                <Text style={styles.initials}>{initialsFor(fullName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{fullName || "Sin nombre"}</Text>
                <Text style={styles.role}>{profile.job_title || "Administrador"}</Text>
                <View style={{ marginTop: 6 }}>
                  <Badge label={profile.is_active ? "Activo" : "Inactivo"} tone={profile.is_active ? "success" : "danger"} />
                </View>
              </View>
            </View>
            <View style={styles.divider} />
            <InfoRow icon="email-outline" label="Correo" value={profile.email} />
            <InfoRow icon="phone-outline" label="Teléfono" value={profile.phone || "No establecido"} />
            <InfoRow icon="calendar-account-outline" label="Miembro desde" value={formatMemberSince(profile.created_at)} />
          </Card>

          <SectionTitle>Ajustes de cuenta</SectionTitle>
          <Button title="Editar perfil" icon="pencil-outline" variant="outline" onPress={openEdit} style={styles.action} />
          <Button title="Cambiar contraseña" icon="lock-outline" variant="outline" onPress={() => setPasswordVisible(true)} style={styles.action} />
          <Button title="Cerrar sesión" icon="logout" variant="danger" onPress={handleLogout} style={styles.action} testID="logout" />
        </ScrollView>
      )}

      <FormModal visible={editVisible} title="Editar perfil" onClose={() => setEditVisible(false)} onSubmit={save} submitting={saving} submitDisabled={!form.name.trim()}>
        <Field label="Nombre completo" icon="account-outline" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} />
        <Field label="Cargo" icon="briefcase-outline" value={form.jobTitle} onChangeText={(t) => setForm((f) => ({ ...f, jobTitle: t }))} placeholder="Ej: Administrador de plataforma" />
        <Field label="Teléfono" icon="phone-outline" value={form.phone} onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))} keyboardType="phone-pad" placeholder="+56 9 1234 5678" />
      </FormModal>
      <ChangePasswordModal
        visible={passwordVisible}
        onClose={() => setPasswordVisible(false)}
        onSuccess={() => {
          setPasswordVisible(false);
          toast("Contraseña actualizada");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center" },
  initials: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.textPrimary },
  name: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary },
  role: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 12 },
  action: { marginBottom: 10 },
});
