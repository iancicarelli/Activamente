// components/UserEditModal.tsx — editar usuario (admin) contra PATCH /api/users/{id} (HC-09).
import React, { useEffect, useState } from "react";
import { Field } from "./ui/Field";
import { FormModal } from "./ui/FormModal";
import { InlineError } from "./ui/States";
import { AdminUser, updateUser } from "../services/userService";
import { getErrorMessage } from "../utils/errors";
import { formatRut, isValidRut, normalizeRut } from "../utils/rut";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UserEditModal({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: (u: AdminUser) => void }) {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", rut: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setForm({ fullName: user.fullName, email: user.email, phone: user.phone ?? "", rut: user.rut ? formatRut(user.rut) : "" });
      setError(null);
    }
  }, [user]);

  const errors = {
    name: form.fullName.trim().length < 2 ? "Escribe el nombre completo." : null,
    email: !EMAIL_RE.test(form.email.trim()) ? "Correo inválido." : null,
    rut: normalizeRut(form.rut).length > 0 && !isValidRut(form.rut) ? "RUT inválido." : null,
  };
  const valid = !errors.name && !errors.email && !errors.rut;

  const submit = async () => {
    if (!user || !valid) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateUser(user.id, {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        ...(user.role !== "admin" ? { rut: normalizeRut(form.rut) ? form.rut : "" } : {}),
      });
      onSaved(updated);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal visible={!!user} title="Editar usuario" onClose={onClose} onSubmit={submit} submitting={saving} submitDisabled={!valid}>
      <Field label="Nombre completo" icon="account-outline" value={form.fullName} onChangeText={(t) => setForm((f) => ({ ...f, fullName: t }))} error={errors.name} />
      <Field label="Correo" icon="email-outline" value={form.email} onChangeText={(t) => setForm((f) => ({ ...f, email: t }))} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
      <Field label="Teléfono" icon="phone-outline" value={form.phone} onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))} keyboardType="phone-pad" placeholder="+56 9 1234 5678" />
      {user?.role !== "admin" && (
        <Field label="RUT" icon="card-account-details-outline" value={form.rut} onChangeText={(t) => setForm((f) => ({ ...f, rut: formatRut(t) }))} autoCapitalize="characters" maxLength={12} error={errors.rut} />
      )}
      <InlineError message={error} />
    </FormModal>
  );
}
