import { colors } from "../../../theme/tokens";

// P01 uses the approved auth.css palette, which is slightly warmer than the app foundation tokens.
export const authColors = {
  ...colors,
  brand: "#D2C18F",
  textSecondary: "#ADB2AA",
  textMuted: "#858D84",
  sheet: "#222722",
  inputPlaceholder: "#777F77",
} as const;
