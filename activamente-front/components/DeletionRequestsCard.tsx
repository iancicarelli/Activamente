// components/DeletionRequestsCard.tsx — solicitudes de eliminación de cuenta pendientes, en el
// panel del admin (Ley 21.719). Aprobar BORRA al paciente y todos sus datos (backend:
// POST /api/admins/deletion-requests/{id}/approve). Sin pendientes no se muestra nada.
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card, Button, SectionTitle, confirm, useToast } from "./ui";
import { Colors, Fonts, FontSize } from "../constants/theme";
import {
  approveDeletionRequest,
  DeletionRequestAdminItem,
  listDeletionRequests,
  rejectDeletionRequest,
} from "../services/privacyService";
import { formatLongDate, toDateString } from "../utils/dates";
import { getErrorMessage } from "../utils/errors";

export function DeletionRequestsCard({ onResolved }: { onResolved?: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<DeletionRequestAdminItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listDeletionRequests("PENDING"));
    } catch {
      setItems([]); // el panel sigue funcionando aunque esto falle
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const resolve = async (r: DeletionRequestAdminItem, approve: boolean) => {
    const who = r.full_name ?? "este paciente";
    const ok = approve
      ? await confirm(
          "Eliminar cuenta",
          `Se borrarán definitivamente ${who} y todos sus datos (sesiones, encuestas, rutinas y citas). No se puede deshacer.`,
          { confirmText: "Eliminar todo", destructive: true }
        )
      : await confirm("Rechazar solicitud", `¿Rechazar la solicitud de ${who}? Su cuenta y sus datos se mantienen.`, { confirmText: "Rechazar" });
    if (!ok) return;
    setBusy(r.id);
    try {
      await (approve ? approveDeletionRequest(r.id) : rejectDeletionRequest(r.id));
      toast(approve ? "Cuenta eliminada" : "Solicitud rechazada");
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      onResolved?.();
    } catch (e) {
      toast(getErrorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null;

  return (
    <>
      <SectionTitle>{`Solicitudes de eliminación (${items.length})`}</SectionTitle>
      {items.map((r) => (
        <Card key={r.id} testID={`deletion-${r.id}`}>
          <Text style={styles.name}>{r.full_name ?? "Usuario ya eliminado"}</Text>
          <Text style={styles.sub}>{[r.rut && `RUT ${r.rut}`, r.email].filter(Boolean).join(" · ")}</Text>
          <Text style={styles.sub}>Pedida el {formatLongDate(toDateString(new Date(r.requested_at)))}</Text>
          {r.reason ? <Text style={styles.reason}>“{r.reason}”</Text> : null}
          <View style={styles.actions}>
            <Button title="Rechazar" variant="outline" onPress={() => resolve(r, false)} disabled={busy !== null} style={{ flex: 1 }} />
            <Button title="Eliminar" variant="danger" icon="delete-outline" onPress={() => resolve(r, true)} loading={busy === r.id} disabled={busy !== null} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  reason: { fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textPrimary, marginTop: 8, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
});
