// constants/theme.ts
// Única fuente de verdad de colores, tipografía y espaciado (UX-01 / UX-10).
// Todo componente de pantalla debe leer de acá; cero hex en las pantallas.

export const Colors = {
  bannerBg: "#49A2A5",
  bannerTitle: "#DEEDE6",
  bannerSubtitle: "#DEEDE6",

  textPrimary: "#27695A",
  // Contraste AA sobre #DEEDE6 (antes eran alphas 0.6 / 0.35 que no pasaban).
  textSecondary: "#3B7A69",
  textMuted: "#4E8776",
  textOnDark: "#DEEDE6",
  textOnPrimary: "#FFFFFF",

  background: "#DEEDE6",
  cardBg: "#DEEDE6",
  cardBgAlt: "#EAF4F0",
  border: "#49A2A5",
  divider: "rgba(39, 105, 90, 0.15)",

  btnPrimary: "#7BB899",
  btnDark: "#27695A",
  btnDanger: "#E75756",
  btnTeal: "#49A2A5",
  btnDisabled: "rgba(39, 105, 90, 0.25)",

  success: "#2E8B57",
  warningBg: "#FEF3C7",
  warningText: "#92400E",
  dangerBg: "rgba(231, 87, 86, 0.12)",
  dangerText: "#9B2C2C",
  infoBg: "rgba(73, 162, 165, 0.15)",

  // Semáforo de métricas de bienestar (encuestas 1-5).
  metricGoodBg: "rgba(123, 184, 153, 0.35)",
  metricWarnBg: "#FEF3C7",
  metricBadBg: "rgba(231, 87, 86, 0.2)",
  alertBorder: "#E75756",

  overlay: "rgba(0,0,0,0.45)",
  videoBg: "#000000",
} as const;

export const GradientColors = ["#DEEDE6", "#90C0C1"] as const;

export const Fonts = {
  regular: "PromptRegular",
  bold: "PromptBold",
} as const;

// Escala tipográfica. `patient` es la escala grande para adulto mayor (UX-10):
// cuerpo ≥ 20, etiquetas ≥ 18, títulos ≥ 28, número de reps ≥ 48.
export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  title: 28,
  hero: 34,
  counter: 64,
  patient: {
    label: 18,
    body: 20,
    button: 24,
    title: 28,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// Touch targets ≥ 56 dp para paciente, 48 para staff (UX-10).
export const Touch = {
  patient: 56,
  staff: 48,
} as const;

export const BannerStyle = {
  backgroundColor: Colors.bannerBg,
  borderBottomLeftRadius: 24,
  borderBottomRightRadius: 24,
  paddingBottom: 20,
  paddingHorizontal: 20,
  width: "100%" as const,
};
