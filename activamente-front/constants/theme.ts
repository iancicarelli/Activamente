export const Colors = {
  bannerBg: "#49A2A5",
  bannerTitle: "#DEEDE6",
  bannerSubtitle: "#DEEDE6",

  textPrimary: "#27695A",
  textSecondary: "rgba(39, 105, 90, 0.6)",
  textMuted: "rgba(39, 105, 90, 0.35)",
  textOnDark: "#DEEDE6",

  cardBg: "#DEEDE6",
  cardBgAlt: "#EAF4F0",

  btnPrimary: "#7BB899",
  btnDark: "#27695A",
  btnDanger: "#E75756",
  btnTeal: "#49A2A5",
} as const;

export const GradientColors = ["#DEEDE6", "#90C0C1"] as const;

export const BannerStyle = {
  backgroundColor: Colors.bannerBg,
  borderBottomLeftRadius: 24,
  borderBottomRightRadius: 24,
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  paddingTop: 54,
  paddingBottom: 24,
  paddingHorizontal: 20,
  width: "100%" as const,
};

export const Fonts = {
  regular: "PromptRegular",
  bold: "PromptBold",
} as const;
