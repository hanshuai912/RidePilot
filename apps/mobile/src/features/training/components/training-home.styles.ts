import { textStyles } from "../../../theme/typography";
import { StyleSheet } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";
import { radii } from "../../../theme/radius";

export const styles = StyleSheet.create({
  page: { gap: spacing.xl },
  daySection: { gap: spacing.md },
  dayHeading: { gap: spacing.xs, flex: 1 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  todayButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  brand: { color: colors.brand },
  courseCard: { padding: 0, overflow: "hidden" },
  courseContent: { padding: spacing.lg, gap: spacing.sm },
  courseTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  courseActions: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  restCard: {
    minHeight: 144,
    padding: spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  restIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  restCopy: { flex: 1, gap: spacing.sm },
  restDescription: { ...textStyles.caption },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    minHeight: 232,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.card,
    backgroundColor: colors.surface2,
  },
  emptyCopy: { gap: spacing.sm, alignItems: "center" },
  centerText: { textAlign: "center" },
  emptyDescription: {
    textAlign: "center",
    ...textStyles.caption,
    maxWidth: 280,
  },
  addRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface1,
  },
});
