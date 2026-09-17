import { computeDv, formatRut, isValidRut, looksLikeRut, normalizeRut } from "../../utils/rut";

describe("rut", () => {
  test("formatRut a medida que se escribe", () => {
    expect(formatRut("")).toBe("");
    expect(formatRut("1")).toBe("1");
    expect(formatRut("12")).toBe("1-2");
    expect(formatRut("123456785")).toBe("12.345.678-5");
    expect(formatRut("12345678k")).toBe("12.345.678-K");
    expect(formatRut("12.345.678-5xx")).toBe("12.345.678-5");
  });
  test("normalizeRut", () => expect(normalizeRut("12.345.678-k")).toBe("12345678K"));
  test.each([["12345678", "5"], ["98765432", "5"], ["11111111", "1"], ["7", "8"], ["1", "9"]])("dv de %s = %s", (b, dv) => expect(computeDv(b)).toBe(dv));
  test("isValidRut", () => {
    expect(isValidRut("12.345.678-5")).toBe(true);
    expect(isValidRut("12345678-9")).toBe(false);
    expect(isValidRut("abc")).toBe(false);
    expect(isValidRut("")).toBe(false);
  });
  test("looksLikeRut distingue email de rut", () => {
    expect(looksLikeRut("pedro@test.com")).toBe(false);
    expect(looksLikeRut("12.345.678-5")).toBe(true);
    expect(looksLikeRut("123456785")).toBe(true);
    expect(looksLikeRut("pedro")).toBe(false);
  });
});
