// components/SetPasswordModal.tsx — el admin fija una contraseña nueva a otro
// usuario (PUT /api/users/{id}/password). No pide la actual.
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Field } from "./ui/Field";
import { FormModal } from "./ui/FormModal";
import { InlineError } from "./ui/States";
import { Colors, Fonts, FontSize } from "../constants/theme";
import { AdminUser, setUserPassword } from "../services/userService";
import { getErrorMessage } from "../utils/errors";

const MIN = 6;

export function SetPasswordModal({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: (u: AdminUser) => void }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNext("");
    setConfirm("");
    setVisible(false);
    setError(null);
  }, [user]);

  const nextError = next.length > 0 && next.length < MIN ? `Mínimo ${MIN} caracteres.` : null;
  const confirmError = confirm.length > 0 && confirm !== next ? "Las contraseñas no coinciden." : null;
  const valid = next.length >= MIN && confirm === next;

  const submit = async () => {
    if (!user || !valid) return;
    setSaving(true);
    setError(null);
    try {
      await setUserPassword(user.id, next);
      onSaved(user);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (
    <TouchableOpacity onPress={() => setVisible((v) => !v)} accessibilityRole="button" accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <MaterialCommunityIcons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={Colors.btnTeal} />
    </TouchableOpacity>
  );

  return (
    <FormModal visible={!!user} title="Cambiar contraseña" onClose={onClose} onSubmit={submit} submitText="Guardar" submitting={saving} submitDisabled={!valid}>
      <Text style={styles.who}>{user ? `${user.fullName} · ${user.email}` : ""}</Text>
      <Field label="Nueva contraseña" value={next} onChangeText={setNext} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} icon="lock-plus-outline" right={toggle} error={nextError} hint={`Mínimo ${MIN} caracteres`} testID="new-password" />
      <Field label="Confirmar contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} icon="lock-check-outline" error={confirmError} testID="confirm-password" />
      <Text style={styles.note}>Comunícale la nueva contraseña al usuario; podrá cambiarla desde su perfil.</Text>
      <InlineError message={error} />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  who: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: "center", marginTop: -6, marginBottom: 12 },
  note: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 6 },
});
