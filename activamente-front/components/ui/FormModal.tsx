// components/ui/FormModal.tsx — modal centrado con título y acciones.
import React from "react";
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { Button } from "./Button";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitText?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  children: React.ReactNode;
};

export function FormModal({ visible, title, onClose, onSubmit, submitText = "Guardar", submitting, submitDisabled, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <View style={styles.container}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          <View style={styles.actions}>
            <Button title="Cancelar" variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={submitting} />
            <Button title={submitText} variant="dark" onPress={onSubmit} style={{ flex: 1 }} loading={submitting} disabled={submitDisabled} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", alignItems: "center", padding: 20 },
  container: { width: "100%", backgroundColor: Colors.cardBg, borderRadius: 16, padding: 22, elevation: 5 },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 14, textAlign: "center" },
  actions: { flexDirection: "row", gap: 12, marginTop: 18 },
});
