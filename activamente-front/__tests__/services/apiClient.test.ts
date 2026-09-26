import { apiFetch, ApiError } from "../../services/apiClient";
import { __resetAuthForTests, getSession, setAuth, subscribe } from "../../services/authStore";
import { isTermsPending, setTermsPending } from "../../services/termsStore";

const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

describe("apiFetch", () => {
  beforeEach(() => {
    __resetAuthForTests();
    (global as any).fetch = jest.fn();
  });

  test("adjunta el Bearer y parsea JSON", async () => {
    setAuth({ token: "tok", role: "PATIENT", userId: "u1", expiresAt: Date.now() + 10_000 });
    (fetch as jest.Mock).mockResolvedValue(ok({ a: 1 }));
    const data = await apiFetch<{ a: number }>("/api/me");
    expect(data).toEqual({ a: 1 });
    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  test("auth:false no manda token", async () => {
    setAuth({ token: "tok", role: "PATIENT", userId: "u1", expiresAt: Date.now() + 10_000 });
    (fetch as jest.Mock).mockResolvedValue(ok({}));
    await apiFetch("/api/auth/login", { method: "POST", auth: false, body: { x: 1 } });
    const [, init] = (fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.body).toBe(JSON.stringify({ x: 1 }));
  });

  test("401 limpia la sesión con motivo 'expired' y lanza ApiError con el detail", async () => {
    setAuth({ token: "tok", role: "PATIENT", userId: "u1", expiresAt: Date.now() + 10_000 });
    const listener = jest.fn();
    subscribe(listener);
    (fetch as jest.Mock).mockResolvedValue(ok({ detail: "Tu sesión expiró." }, 401));
    await expect(apiFetch("/api/me")).rejects.toMatchObject({ status: 401, message: "Tu sesión expiró." });
    expect(getSession()).toBeNull();
    expect(listener).toHaveBeenCalledWith(null, "expired");
  });

  test("403 de cuenta desactivada limpia con 'forbidden'", async () => {
    setAuth({ token: "tok", role: "PATIENT", userId: "u1", expiresAt: Date.now() + 10_000 });
    const listener = jest.fn();
    subscribe(listener);
    (fetch as jest.Mock).mockResolvedValue(ok({ detail: "Cuenta desactivada." }, 403));
    await expect(apiFetch("/api/me")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledWith(null, "forbidden");
  });

  test("403 de permisos NO limpia la sesión", async () => {
    setAuth({ token: "tok", role: "PATIENT", userId: "u1", expiresAt: Date.now() + 10_000 });
    (fetch as jest.Mock).mockResolvedValue(ok({ detail: "Solo especialistas." }, 403));
    await expect(apiFetch("/api/patients/")).rejects.toMatchObject({ status: 403 });
    expect(getSession()).not.toBeNull();
  });

  test("422 de pydantic usa el primer msg", async () => {
    (fetch as jest.Mock).mockResolvedValue(ok({ detail: [{ msg: "Value error, La fecha de fin no puede ser anterior." }] }, 422));
    await expect(apiFetch("/api/routines", { method: "POST", body: {} })).rejects.toMatchObject({ message: "La fecha de fin no puede ser anterior." });
  });

  test("sin red → ApiError status 0 con mensaje humano", async () => {
    (fetch as jest.Mock).mockRejectedValue(new TypeError("Network request failed"));
    await expect(apiFetch("/api/me")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("Sin conexión") });
  });

  test("403 con X-Terms-Required marca los términos como pendientes (el layout lleva a /terms)", async () => {
    setTermsPending(false);
    setAuth({ token: "tok", role: "PATIENT", userId: "u1", expiresAt: Date.now() + 10_000 });
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ detail: "Debes aceptar los términos de uso para continuar." }),
      headers: { get: (h: string) => (h === "X-Terms-Required" ? "1" : null) },
    });
    await expect(apiFetch("/api/me")).rejects.toMatchObject({ status: 403 });
    expect(isTermsPending()).toBe(true);
    expect(getSession()).not.toBeNull(); // no cierra la sesión
    setTermsPending(false);
  });
});
