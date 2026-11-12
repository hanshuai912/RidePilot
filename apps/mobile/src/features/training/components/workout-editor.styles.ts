import { StyleSheet } from "react-native";
import { colors } from "../../../theme/colors";

export const editorStyles = StyleSheet.create({
  page: { gap: 24, paddingTop: 12 },
  context: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  section: { gap: 12 },
  fields: { gap: 16 },
  field: { gap: 8 },
  overview: { gap: 16 },
  totals: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { flex: 1, minWidth: 96, gap: 4 },
  value: { color: colors.brand, fontVariant: ["tabular-nums"] },
  actions: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
