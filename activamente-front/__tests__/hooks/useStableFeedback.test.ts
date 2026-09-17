import { act, renderHook } from "@testing-library/react-native";
import { MIN_HOLD_MS, useStableFeedback } from "../../hooks/useStableFeedback";

describe("useStableFeedback", () => {
  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => jest.useRealTimers());

  test("mantiene el mensaje al menos 1.5 s salvo cambio de ok o rep", () => {
    const { result } = renderHook(() => useStableFeedback());
    act(() => result.current.push({ text: "Baja más", ok: true }));
    expect(result.current.feedback.text).toBe("Baja más");

    jest.setSystemTime(500);
    act(() => result.current.push({ text: "Sigue bajando", ok: true }));
    expect(result.current.feedback.text).toBe("Baja más"); // aún no pasó el tiempo

    act(() => result.current.push({ text: "Estira los codos", ok: false }));
    expect(result.current.feedback.text).toBe("Estira los codos"); // cambio de ok entra ya

    jest.setSystemTime(500 + MIN_HOLD_MS + 1);
    act(() => result.current.push({ text: "¡Bien!", ok: false }));
    expect(result.current.feedback.text).toBe("¡Bien!");

    act(() => result.current.push({ text: "¡Repetición completada!", ok: true }, true));
    expect(result.current.feedback.text).toBe("¡Repetición completada!");
  });
});
