// screens/specialist/PatientListScreen.tsx — "Mis pacientes": solo asignados
// (EP-01), búsqueda en servidor, "cargar más" (EP-11), badges de alerta/nuevo/
// deshabilitado y acciones grandes.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, Badge, SearchBar, LoadingView, EmptyState, ErrorView, confirm, useToast } from "../../components/ui";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { routes } from "../../router/routes";
import { getPatients, unassignPatient, PatientListItem } from "../../services/patientService";
import { getErrorMessage } from "../../utils/errors";

const PAGE = 20;

function PatientCard({ patient, onInfo, onRoutines, onRemove }: { patient: PatientListItem; onInfo: () => void; onRoutines: () => void; onRemove: () => void }) {
  return (
    <Card style={patient.alertKind === "wellbeing" ? styles.alertCard : undefined}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account-outline" size={26} color={Colors.btnTeal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{patient.fullName}</Text>
          <Text style={styles.meta}>{[patient.rut, patient.age != null ? `${patient.age} años` : null].filter(Boolean).join(" · ") || "Sin datos"}</Text>
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn} accessibilityRole="button" accessibilityLabel="Quitar de mi lista" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="account-minus-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.badges}>
        {!patient.isActive && <Badge label="Cuenta deshabilitada" tone="danger" icon="cancel" />}
        {patient.hasAlert && (
          <Badge
            label={patient.alertMessage ?? "Alerta"}
            tone={patient.alertKind === "wellbeing" ? "danger" : "warning"}
            icon={patient.alertKind === "wellbeing" ? "heart-pulse" : "alert-outline"}
          />
        )}
        {patient.isNew && <Badge label="Sin sesiones aún" tone="info" icon="star-outline" />}
      </View>
      <View style={styles.actions}>
        <Button title="Ficha" icon="account-details-outline" variant="outline" onPress={onInfo} style={{ flex: 1 }} />
        <Button title="Rutinas" icon="clipboard-list-outline" onPress={onRoutines} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export default function PatientListScreen() {
  const router = useRouter();
  const toast = useToast();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search: string, offset = 0) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const page = await getPatients({ search, limit: PAGE, offset });
      setPatients((prev) => (offset === 0 ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  // Búsqueda con debounce SOLO al cambiar el texto (el montaje lo cubre useFocusEffect).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = setTimeout(() => void load(query), 350);
    return () => clearTimeout(handle);
  }, [query, load]);

  const remove = async (p: PatientListItem) => {
    const ok = await confirm("¿Quitar de tu lista?", `${p.fullName} dejará de aparecer en tus pacientes. Su cuenta no se modifica.`, { confirmText: "Quitar", destructive: true });
    if (!ok) return;
    try {
      await unassignPatient(p.id);
      setPatients((prev) => prev.filter((x) => x.id !== p.id));
      toast("Paciente quitado de tu lista");
    } catch (e) {
      toast(getErrorMessage(e), "error");
    }
  };

  return (
    <Screen>
      <Banner
        overline="Panel profesional"
        title="Mis pacientes"
        right={
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push(routes.assignPatient)} accessibilityRole="button" accessibilityLabel="Agregar paciente">
            <MaterialCommunityIcons name="account-plus" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar por nombre o correo" />
        {loading ? (
          <LoadingView />
        ) : error ? (
          <ErrorView message={error} onRetry={() => load(query)} />
        ) : patients.length === 0 ? (
          <EmptyState icon="account-search-outline" title={query ? "Sin resultados" : "Aún no tienes pacientes"} message={query ? "Prueba con otro nombre." : "Agrega uno con el botón + buscando su RUT."} />
        ) : (
          <>
            {patients.map((p) => (
              <PatientCard
                key={p.id}
                patient={p}
                onInfo={() => router.push({ pathname: routes.medicalRecord, params: { patientId: p.id } })}
                onRoutines={() => router.push({ pathname: routes.routineList, params: { patientId: p.id } })}
                onRemove={() => remove(p)}
              />
            ))}
            {hasMore && <Button title="Cargar más" variant="outline" onPress={() => load(query, patients.length)} loading={loadingMore} />}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 24 },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.btnPrimary, alignItems: "center", justifyContent: "center" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.cardBgAlt, alignItems: "center", justifyContent: "center" },
  name: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  removeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  alertCard: { borderWidth: 2, borderColor: Colors.alertBorder },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
});
