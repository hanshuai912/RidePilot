export const colors = {
  background: "#0D0F0E",
  surface1: "#191C1A",
  surface2: "#232723",
  surfaceElevated: "#292E29",
  border: "#313731",
  divider: "#292F29",
  brand: "#C9BA91",
  brandOn: "#171913",
  brandSubtle: "#373628",
  textPrimary: "#EFF0E9",
  textSecondary: "#A2A99F",
  textMuted: "#787F77",
  positive: "#90AD98",
  warning: "#D9A66F",
  negative: "#CF837B",
  neutral: "#8B948C",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  card: 18,
  pill: 999,
} as const;

export const typography = {
  display: 32,
  title: 24,
  section: 20,
  card: 17,
  body: 16,
  caption: 13,
  label: 12,
} as const;

export const layout = {
  tapMin: 44,
  buttonHeight: 52,
  screenGutter: 16,
} as const;

export const darkTheme = {
  colors,
  spacing,
  radii,
  typography,
  layout,
} as const;

export type DarkTheme = typeof darkTheme;
