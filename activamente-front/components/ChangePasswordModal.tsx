// components/ChangePasswordModal.tsx — cambio de contraseña (cualquier rol).
import React, { useState } from "react";
import { Field } from "./ui/Field";
import { FormModal } from "./ui/FormModal";
import { InlineError } from "./ui/States";
import { changePassword } from "../services/profileService";
import { getErrorMessage } from "../utils/errors";

export function ChangePasswordModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextError = next.length > 0 && next.length < 6 ? "Mínimo 6 caracteres." : null;
  const confirmError = confirm.length > 0 && confirm !== next ? "Las contraseñas no coinciden." : null;
  const valid = current.length > 0 && next.length >= 6 && confirm === next;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await changePassword({ current_password: current, new_password: next });
      reset();
      onSuccess();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      visible={visible}
      title="Cambiar contraseña"
      onClose={() => {
        reset();
        onClose();
      }}
      onSubmit={submit}
      submitText="Actualizar"
      submitting={saving}
      submitDisabled={!valid}
    >
      <Field label="Contraseña actual" value={current} onChangeText={setCurrent} secureTextEntry icon="lock-outline" />
      <Field label="Nueva contraseña" value={next} onChangeText={setNext} secureTextEntry icon="lock-plus-outline" error={nextError} hint="Mínimo 6 caracteres" />
      <Field label="Confirmar nueva contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry icon="lock-check-outline" error={confirmError} />
      <InlineError message={error} />
    </FormModal>
  );
}
