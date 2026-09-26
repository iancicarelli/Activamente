// screens/patient/PatientProfileScreen.tsx — perfil del paciente (UX-18):
// datos reales de GET /api/me (HC-03), especialistas asignados con botón
// "Llamar", próxima cita, privacidad (releer los términos y pedir que se borre la cuenta,
// Ley 21.719), cambio de contraseña y "Cerrar sesión" grande.
import React, { useCallback, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Screen, Banner, Card, Button, InfoRow, LoadingView, ErrorView, SectionTitle, confirm, useToast } from "../../components/ui";
import { ChangePasswordModal } from "../../components/ChangePasswordModal";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { logout } from "../../services/authService";
import { getMe, MeResponse } from "../../services/meService";
import { getNextAppointment, Appointment } from "../../services/appointmentService";
import { getMyDeletionRequest, requestAccountDeletion, DeletionRequest } from "../../services/privacyService";
import { routes } from "../../router/routes";
import { formatLongDate, toDateString } from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";

export default function PatientProfileScreen() {
  const toast = useToast();
  const router = useRouter();
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, appt, del] = await Promise.all([
        getMe(),
        getNextAppointment().catch(() => null),
        getMyDeletionRequest().catch(() => null),
      ]);
      setMe(profile);
      setAppointment(appt);
      setDeletion(del);
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

  const handleLogout = async () => {
    const ok = await confirm("¿Cerrar sesión?", "Tendrás que ingresar tu correo o RUT y contraseña la próxima vez.", { confirmText: "Cerrar sesión", destructive: true });
    if (ok) logout();
  };

  const askDeletion = async () => {
    const ok = await confirm(
      "¿Eliminar tu cuenta?",
      "Se enviará una solicitud al administrador. Si la aprueba, se borrarán tu cuenta y todos tus datos (sesiones, encuestas, rutinas y citas) y no se podrán recuperar.",
      { confirmText: "Enviar solicitud", destructive: true }
    );
    if (!ok) return;
    setRequesting(true);
    try {
      setDeletion(await requestAccountDeletion());
      toast("Solicitud enviada");
    } catch (e) {
      toast(getErrorMessage(e), "error");
    } finally {
      setRequesting(false);
    }
  };

  const call = (phone: string | null) => {
    if (!phone) return;
    void Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`);
  };

  return (
    <Screen>
      <Banner title="Mi perfil" big />
      {loading ? (
        <LoadingView />
      ) : error || !me ? (
        <ErrorView message={error ?? "No pudimos cargar tu perfil."} onRetry={load} big />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Card style={styles.header}>
            <MaterialCommunityIcons name="account-circle" size={84} color={Colors.textPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{me.full_name}</Text>
              {me.patient?.age != null && <Text style={styles.sub}>{me.patient.age} años</Text>}
              {me.patient?.rut && <Text style={styles.sub}>RUT {me.patient.rut}</Text>}
            </View>
          </Card>

          <SectionTitle big>Mis datos</SectionTitle>
          <Card>
            <InfoRow big icon="email-outline" label="Correo" value={me.email} />
            <InfoRow big icon="phone-outline" label="Teléfono" value={me.patient?.phone || "No registrado"} />
            <InfoRow big icon="map-marker-outline" label="Dirección" value={me.patient?.address || "No registrada"} />
          </Card>

          <SectionTitle big>Mi especialista</SectionTitle>
          {me.patient?.specialists.length ? (
            me.patient.specialists.map((s) => (
              <Card key={s.id}>
                <View style={styles.specialistRow}>
                  <MaterialCommunityIcons name="stethoscope" size={44} color={Colors.btnTeal} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.specialistName}>{s.full_name}</Text>
                    <Text style={styles.sub}>{s.specialty || "Especialista"}</Text>
                    {s.phone && <Text style={styles.sub}>{s.phone}</Text>}
                  </View>
                </View>
                {s.phone ? <Button title="Llamar" size="patient" icon="phone" variant="teal" onPress={() => call(s.phone)} style={{ marginTop: 12 }} /> : null}
              </Card>
            ))
          ) : (
            <Card>
              <Text style={styles.sub}>Todavía no tienes un especialista asignado.</Text>
            </Card>
          )}

          {appointment && (
            <>
              <SectionTitle big>Próxima cita</SectionTitle>
              <Card>
                <InfoRow big icon="calendar-clock" label="Cuándo" value={`${formatLongDate(appointment.date)}, ${appointment.time}`} />
                <InfoRow big icon="account-outline" label="Con" value={appointment.specialistName} />
              </Card>
            </>
          )}

          <SectionTitle big>Privacidad</SectionTitle>
          <Card>
            <Button title="Ver términos y privacidad" size="patient" variant="outline" icon="file-document-outline" onPress={() => router.push(routes.terms)} />
            {deletion?.status === "PENDING" ? (
              <Text style={[styles.sub, { marginTop: 12 }]} testID="deletion-pending">
                Pediste eliminar tu cuenta el {formatLongDate(toDateString(new Date(deletion.requested_at)))}. El administrador está revisando tu solicitud.
              </Text>
            ) : (
              <>
                {deletion?.status === "REJECTED" && (
                  <Text style={[styles.sub, { marginTop: 12 }]}>Tu última solicitud de eliminación no fue aprobada. Si tienes dudas, habla con tu especialista.</Text>
                )}
                <Button
                  title="Solicitar eliminación de mi cuenta"
                  size="patient"
                  variant="ghost"
                  icon="account-remove-outline"
                  onPress={askDeletion}
                  loading={requesting}
                  style={{ marginTop: 12 }}
                  testID="request-deletion"
                />
              </>
            )}
          </Card>

          <Button title="Cambiar contraseña" size="patient" variant="outline" icon="lock-outline" onPress={() => setPasswordVisible(true)} style={{ marginTop: 8 }} />
          <Button title="Cerrar sesión" size="patient" variant="danger" icon="logout" onPress={handleLogout} style={{ marginTop: 12 }} testID="logout" />
        </ScrollView>
      )}
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
  name: { fontSize: FontSize.title, fontFamily: Fonts.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.patient.body, fontFamily: Fonts.regular, color: Colors.textPrimary, marginTop: 2 },
  specialistRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  specialistName: { fontSize: FontSize.patient.body, fontFamily: Fonts.bold, color: Colors.textPrimary },
});
