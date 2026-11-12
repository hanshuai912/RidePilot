import { StyleSheet } from "react-native";
import { colors, layout, radii, spacing } from "../../../theme/tokens";

export const chatStyles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  turn: { gap: spacing.md, marginBottom: spacing.xl },
  time: { textAlign: "center", marginBottom: spacing.xs },
  userRow: { alignItems: "flex-end", paddingLeft: spacing.xxxl },
  assistantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.brandSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  assistantContent: { flexShrink: 1, gap: spacing.xs },
  bubble: {
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userBubble: {
    backgroundColor: colors.brandSubtle,
    borderTopRightRadius: radii.sm,
  },
  assistantBubble: {
    backgroundColor: colors.surface1,
    borderTopLeftRadius: radii.sm,
  },
  failure: { gap: spacing.sm },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: { textAlign: "center" },
  hint: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    textAlign: "center",
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingVertical: spacing.md,
    textAlignVertical: "top",
  },
  send: { minWidth: layout.tapMin, minHeight: 48 },
  footer: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
