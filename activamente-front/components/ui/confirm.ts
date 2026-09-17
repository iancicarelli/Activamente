// components/ui/confirm.ts — diálogo de confirmación como Promise sobre Alert.
import { Alert } from "react-native";

export function confirm(
  title: string,
  message: string,
  { confirmText = "Confirmar", cancelText = "Cancelar", destructive = false } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}
