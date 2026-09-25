import { resolveApiBaseUrl } from "../../services/config";

describe("resolveApiBaseUrl", () => {
  test("en desarrollo usa la variable o el host del emulador/simulador", () => {
    expect(resolveApiBaseUrl("http://192.168.1.88:8420", true, "android")).toBe("http://192.168.1.88:8420");
    expect(resolveApiBaseUrl(undefined, true, "android")).toBe("http://10.0.2.2:8420");
    expect(resolveApiBaseUrl(undefined, true, "ios")).toBe("http://localhost:8420");
  });

  test("en release exige HTTPS con dominio real", () => {
    expect(resolveApiBaseUrl("https://api.ejemplo.cl/", false, "android")).toBe("https://api.ejemplo.cl");
    for (const bad of [undefined, "", "http://192.168.1.88:8420", "https://api.DOMINIO"]) {
      expect(() => resolveApiBaseUrl(bad, false, "android")).toThrow(/EXPO_PUBLIC_API_URL/);
    }
  });
});
