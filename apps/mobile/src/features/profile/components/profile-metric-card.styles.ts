import { StyleSheet } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";
import { radii } from "../../../theme/radius";
import { typography } from "../../../theme/typography";

export const profileMetricStyles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.brandSubtle,
  },
  content: { flex: 1, minWidth: 0 },
  title: { fontSize: typography.body, lineHeight: 22, fontWeight: "500" },
  value: {
    fontSize: typography.caption,
    lineHeight: 20,
    fontWeight: "500",
    color: colors.brand,
    fontVariant: ["tabular-nums"],
  },
  description: {
    fontSize: typography.label,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
