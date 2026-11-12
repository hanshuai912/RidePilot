import type { TextStyle } from "react-native";

// Semantic text roles shared by native styles and UI components.
export const typography = {
  display: 32,
  pageTitle: 28,
  title: 22,
  section: 18,
  navigation: 17,
  card: 16,
  body: 16,
  caption: 14,
  label: 13,
  button: 16,
  chart: 12,
} as const;

export type TextVariant = keyof typeof typography;

export const textStyles = {
  display: { fontSize: typography.display, lineHeight: 38, fontWeight: "600" },
  pageTitle: {
    fontSize: typography.pageTitle,
    lineHeight: 34,
    fontWeight: "600",
  },
  title: { fontSize: typography.title, lineHeight: 28, fontWeight: "600" },
  section: { fontSize: typography.section, lineHeight: 24, fontWeight: "600" },
  navigation: {
    fontSize: typography.navigation,
    lineHeight: 24,
    fontWeight: "600",
  },
  card: { fontSize: typography.card, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: typography.body, lineHeight: 24, fontWeight: "400" },
  caption: { fontSize: typography.caption, lineHeight: 20, fontWeight: "400" },
  label: { fontSize: typography.label, lineHeight: 18, fontWeight: "500" },
  button: { fontSize: typography.button, lineHeight: 22, fontWeight: "600" },
  chart: { fontSize: typography.chart, lineHeight: 16, fontWeight: "500" },
} as const satisfies Record<TextVariant, TextStyle>;
