import { StyleSheet } from "react-native";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";
import { radii } from "../../../theme/radius";

export const styles = StyleSheet.create({
  card: { padding: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 2,
  },
  segmentButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  activeSegment: { backgroundColor: colors.surfaceElevated },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  periodLabel: { flex: 1, textAlign: "center" },
  navButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  weekdays: { flexDirection: "row", marginBottom: spacing.xs },
  weekday: { width: "14.285714%", textAlign: "center" },
  day: {
    width: "14.285714%",
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
  },
  markers: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 6 },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
