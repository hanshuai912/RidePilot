import { StyleSheet } from "react-native";
import { colors } from "../../../theme/colors";
import { layout } from "../../../theme/layout";
import { radii } from "../../../theme/radius";
import { spacing } from "../../../theme/spacing";

export const segmentListStyles = StyleSheet.create({
  touch: {
    minHeight: layout.tapMin,
    minWidth: layout.tapMin,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { width: "100%", gap: spacing.md },
  rows: { width: "100%", gap: spacing.md },
  dropIndicator: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.card,
  },
  segment: {
    width: "100%",
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.surface1,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    padding: spacing.lg,
  },
  segmentBody: {
    flex: 1,
    minWidth: 0,
    minHeight: layout.tapMin,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.brandSubtle },
  segmentTitle: { paddingVertical: spacing.md },
  metaRow: {
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  intensity: {
    maxWidth: "100%",
    flexShrink: 1,
    color: colors.brand,
    backgroundColor: colors.brandSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  addButton: {
    minHeight: layout.buttonHeight,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  addLabel: { color: colors.brand },
});
