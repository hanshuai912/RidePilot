import { colors } from "./colors";
import { layout } from "./layout";
import { radii } from "./radius";
import { spacing } from "./spacing";
import { typography } from "./typography";

export { colors } from "./colors";
export { layout } from "./layout";
export { radii } from "./radius";
export { spacing } from "./spacing";
export { typography } from "./typography";

export const darkTheme = {
  colors,
  layout,
  radii,
  spacing,
  typography,
} as const;
export type DarkTheme = typeof darkTheme;
