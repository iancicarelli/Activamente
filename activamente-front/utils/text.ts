// utils/text.ts
export const initialsFor = (fullName: string): string => {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].substring(0, 2)).toUpperCase();
};

export const firstName = (fullName: string): string => (fullName ?? "").trim().split(/\s+/)[0] ?? "";

// Partimos un párrafo en oraciones para listas numeradas (instrucciones).
export const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 0);
