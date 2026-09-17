// screens/specialist/SpecialistProfileScreen.tsx — perfil propio: editar
// nombre/especialidad/teléfono, cambiar contraseña y cerrar sesión.
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Screen, Banner, Card, Button, Field, InfoRow, FormModal, LoadingView, ErrorView, SectionTitle, confirm, useToast } from "../../components/ui";
import { ChangePasswordModal } from "../../components/ChangePasswordModal";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { logout } from "../../services/authService";
import { getSpecialistProfile, splitFullName, updateSpecialistProfile, SpecialistProfile } from "../../services/profileService";
import { getErrorMessage } from "../../utils/errors";

export default function SpecialistProfileScreen() {
  const toast = useToast();
  const [profile, setProfile] = useState<SpecialistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form, setForm] = useState({ name: "", specialty: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getSpecialistProfile());
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
    setForm({ name: fullName, specialty: profile?.specialty ?? "", phone: profile?.phone ?? "" });
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const updated = await updateSpecialistProfile({ ...splitFullName(form.name), specialty: form.specialty.trim(), phone: form.phone.trim() });
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
      <Banner overline="Panel profesional" title="Mi perfil" />
      {loading ? (
        <LoadingView />
      ) : error || !profile ? (
        <ErrorView message={error ?? "No pudimos cargar tu perfil."} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card style={styles.header}>
            <MaterialCommunityIcons name="account-circle-outline" size={72} color={Colors.textPrimary} />
            <Text style={styles.name}>{fullName || "Sin nombre"}</Text>
            <View style={styles.pill}>
              <MaterialCommunityIcons name="stethoscope" size={16} color={Colors.textOnDark} />
              <Text style={styles.pillText}>{profile.specialty || "Especialista"}</Text>
            </View>
          </Card>

          <SectionTitle>Información personal</SectionTitle>
          <Card>
            <InfoRow icon="email-outline" label="Correo" value={profile.email} />
            <InfoRow icon="phone-outline" label="Teléfono" value={profile.phone || "No establecido"} />
            <InfoRow icon="card-account-details-outline" label="RUT" value={profile.rut || "No establecido"} />
          </Card>

          <SectionTitle>Ajustes de cuenta</SectionTitle>
          <Button title="Editar perfil" icon="pencil-outline" variant="outline" onPress={openEdit} style={styles.action} />
          <Button title="Cambiar contraseña" icon="lock-outline" variant="outline" onPress={() => setPasswordVisible(true)} style={styles.action} />
          <Button title="Cerrar sesión" icon="logout" variant="danger" onPress={handleLogout} style={styles.action} testID="logout" />
        </ScrollView>
      )}

      <FormModal visible={editVisible} title="Editar perfil" onClose={() => setEditVisible(false)} onSubmit={saveEdit} submitting={saving} submitDisabled={!form.name.trim()}>
        <Field label="Nombre completo" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} icon="account-outline" />
        <Field label="Especialidad" value={form.specialty} onChangeText={(t) => setForm((f) => ({ ...f, specialty: t }))} icon="medal-outline" />
        <Field label="Teléfono" value={form.phone} onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))} icon="phone-outline" keyboardType="phone-pad" placeholder="+56 9 1234 5678" />
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
  header: { alignItems: "center", paddingVertical: 22 },
  name: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.btnTeal, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  pillText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.textOnDark },
  action: { marginBottom: 10 },
});
