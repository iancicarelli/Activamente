// components/ui/Toast.tsx — toast global (provider en app/_layout.tsx, hook useToast).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts, FontSize } from "../../constants/theme";

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType } | null;

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      setToast({ message, type });
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setToast(null));
      }, 3000);
    },
    [opacity]
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const bg = useMemo(
    () => ({ success: Colors.btnTeal, error: Colors.btnDanger, info: Colors.btnDark })[toast?.type ?? "info"],
    [toast?.type]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { opacity, backgroundColor: bg, bottom: 90 + insets.bottom }]}
        >
          <MaterialCommunityIcons
            name={toast.type === "error" ? "alert-circle-outline" : "check-circle-outline"}
            size={22}
            color={Colors.textOnDark}
          />
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { flex: 1, fontFamily: Fonts.bold, color: Colors.textOnDark, fontSize: FontSize.md },
});

// Fallback sin provider (tests unitarios): un View plano.
export const ToastHost = View;
