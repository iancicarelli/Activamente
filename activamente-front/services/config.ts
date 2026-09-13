// services/config.ts
import { Platform } from "react-native";

// Base URL of the FastAPI backend. Override it with the EXPO_PUBLIC_API_URL
// env var (e.g. when running on a physical device, point it at your LAN IP).
//
// Defaults:
//  - Android emulator reaches the host machine through 10.0.2.2
//  - iOS simulator / web reach it through localhost
const DEFAULT_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? `http://${DEFAULT_HOST}:8420`;
