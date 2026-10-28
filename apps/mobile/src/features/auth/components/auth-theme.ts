import { colors } from "../../../theme/tokens";

// P01 uses the approved auth.css palette, which is slightly warmer than the app foundation tokens.
export const authColors = {
  ...colors,
  sheet: colors.surface2,
  inputPlaceholder: colors.textMuted,
} as const;
