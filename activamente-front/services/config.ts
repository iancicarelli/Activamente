// services/config.ts
import { Platform } from "react-native";

// Base URL of the FastAPI backend. Override it with the EXPO_PUBLIC_API_URL
// env var (e.g. when running on a physical device, point it at your LAN IP).
//
// Defaults (solo en desarrollo):
//  - Android emulator reaches the host machine through 10.0.2.2
//  - iOS simulator / web reach it through localhost
//
// En un build de release (perfiles `preview` / `production` de eas.json) la URL sale SOLO de
// eas.json: el .env local no se sube a EAS. Sin ella, o si no es HTTPS, o si todavía tiene el
// placeholder DOMINIO, la app se cierra al abrir en vez de apuntar en silencio a 10.0.2.2
// (el manifest de release además bloquea HTTP sin cifrar).
export function resolveApiBaseUrl(fromEnv: string | undefined, isDev: boolean, os: string): string {
  if (isDev) return fromEnv ?? `http://${os === "android" ? "10.0.2.2" : "localhost"}:8420`;
  if (!fromEnv || !fromEnv.startsWith("https://") || fromEnv.includes("DOMINIO")) {
    throw new Error(`EXPO_PUBLIC_API_URL inválida para un build de release: "${fromEnv ?? ""}". Revisa el perfil en eas.json.`);
  }
  return fromEnv.replace(/\/+$/, "");
}

// `process.env.EXPO_PUBLIC_API_URL` con acceso literal: Expo lo reemplaza al empaquetar.
export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__, Platform.OS);
