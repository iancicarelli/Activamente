// app/_layout.tsx — root layout (BT-07):
//   * carga las fuentes UNA vez (antes cada pantalla llamaba useFonts),
//   * mantiene el splash hasta tener fuentes + sesión restaurada,
//   * guard de auth/rol: sin sesión → login; con sesión → home de su rol,
//   * al expirar el token (401) o desactivarse la cuenta (403) redirige al
//     login con el motivo (UX-03 / EP-07),
//   * GestureHandlerRootView + SafeAreaProvider + ToastProvider globales.

import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "../components/ui/Toast";
import { HOME_BY_ROLE, SEGMENT_BY_ROLE } from "../router/routes";
import { AuthSession, ClearReason, getSession, hydrateAuth, subscribe } from "../services/authStore";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PromptRegular: require("../assets/fonts/Prompt-Regular.ttf"),
    PromptBold: require("../assets/fonts/Prompt-SemiBold.ttf"),
  });
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(getSession());
  const [clearReason, setClearReason] = useState<ClearReason | null>(null);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrateAuth()
      .then((s) => setSession(s))
      .finally(() => setAuthReady(true));
    return subscribe((s, reason) => {
      setSession(s);
      if (reason) setClearReason(reason);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded && authReady) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, authReady]);

  // Guard de navegación.
  useEffect(() => {
    if (!fontsLoaded || !authReady) return;
    const first = segments[0] as string | undefined;
    if (!session) {
      if (first) {
        router.replace(clearReason ? { pathname: "/", params: { reason: clearReason } } : "/");
        setClearReason(null);
      }
      return;
    }
    if (first !== SEGMENT_BY_ROLE[session.role]) {
      router.replace(HOME_BY_ROLE[session.role]);
    }
  }, [session, segments, fontsLoaded, authReady, clearReason, router]);

  if (!fontsLoaded || !authReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
