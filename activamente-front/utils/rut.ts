// utils/rut.ts — RUT chileno: formateo mientras se escribe, normalización y DV.

export const normalizeRut = (value: string): string =>
  (value ?? "").replace(/[^0-9kK]/g, "").toUpperCase();

// "123456785" → "12.345.678-5" (a medida que se escribe).
export const formatRut = (value: string): string => {
  const clean = normalizeRut(value).slice(0, 9);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean;
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${dv}`;
};

export const computeDv = (body: string): string => {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return "0";
  if (remainder === 10) return "K";
  return String(remainder);
};

export const isValidRut = (value: string): boolean => {
  const clean = normalizeRut(value);
  if (clean.length < 2 || !/^\d+$/.test(clean.slice(0, -1))) return false;
  return computeDv(clean.slice(0, -1)) === clean.slice(-1);
};

// Heurística: si el texto tiene "@" es email; si tiene solo dígitos/K es RUT.
export const looksLikeRut = (value: string): boolean =>
  !value.includes("@") && /^[0-9.\-\skK]+$/.test(value.trim()) && normalizeRut(value).length >= 2;
